-- Complete server-verified daily challenge, mission assignment and wallet audit workflows.

ALTER TABLE public.user_streaks
  ADD COLUMN IF NOT EXISTS last_daily_reward_date date;

CREATE UNIQUE INDEX IF NOT EXISTS daily_missions_type_title_uidx
  ON public.daily_missions (mission_type, title);
CREATE UNIQUE INDEX IF NOT EXISTS user_missions_user_mission_date_uidx
  ON public.user_missions (user_id, mission_id, mission_date);

INSERT INTO public.daily_missions
  (title, description, mission_type, target_value, reward_xp, reward_coins, icon, is_active)
VALUES
  ('Complete 1 quiz', 'Finish one approved quiz today', 'quiz', 1, 15, 5, 'book-open', true),
  ('Complete 3 quizzes', 'Finish three approved quizzes today', 'quiz', 3, 30, 10, 'graduation-cap', true),
  ('Get a perfect score', 'Earn a perfect score on an approved quiz', 'perfect_score', 1, 20, 10, 'trophy', true)
ON CONFLICT (mission_type, title) DO UPDATE SET
  description = EXCLUDED.description,
  target_value = EXCLUDED.target_value,
  reward_xp = EXCLUDED.reward_xp,
  reward_coins = EXCLUDED.reward_coins,
  icon = EXCLUDED.icon,
  is_active = true;

CREATE TABLE IF NOT EXISTS public.daily_challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_date date NOT NULL,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  is_correct boolean NOT NULL,
  xp_awarded integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_date)
);
ALTER TABLE public.daily_challenge_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.daily_challenge_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_daily_challenge_question()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_date date := (now() AT TIME ZONE 'Africa/Addis_Ababa')::date;
  v_total integer := 0;
  v_offset integer := 0;
  v_question record;
  v_attempt public.daily_challenge_attempts%rowtype;
  v_has_attempt boolean := false;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT count(*)::integer INTO v_total
  FROM public.quizzes z
  JOIN public.questions q ON q.quiz_id = z.id
  WHERE z.is_approved IS TRUE;

  IF v_total = 0 THEN RETURN jsonb_build_object('available', false); END IF;
  v_offset := (extract(year FROM v_date)::integer * 10000
    + extract(month FROM v_date)::integer * 100
    + extract(day FROM v_date)::integer) % v_total;

  SELECT q.id, q.question_text, q.options, q.explanation
  INTO v_question
  FROM public.quizzes z
  JOIN public.questions q ON q.quiz_id = z.id
  WHERE z.is_approved IS TRUE
  ORDER BY z.created_at DESC NULLS LAST, z.id ASC, q.order_index ASC NULLS LAST, q.id ASC
  OFFSET v_offset LIMIT 1;

  SELECT * INTO v_attempt
  FROM public.daily_challenge_attempts
  WHERE user_id = v_user_id AND challenge_date = v_date;
  v_has_attempt := FOUND;

  RETURN jsonb_build_object(
    'available', true,
    'question_id', v_question.id,
    'question_text', v_question.question_text,
    'options', coalesce(v_question.options, '[]'::jsonb),
    'explanation', v_question.explanation,
    'already_completed', v_has_attempt,
    'was_correct', CASE WHEN v_has_attempt THEN v_attempt.is_correct ELSE false END,
    'xp_awarded', CASE WHEN v_has_attempt THEN v_attempt.xp_awarded ELSE 0 END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_daily_challenge_answer(
  p_question_id uuid,
  p_answer text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_date date := (now() AT TIME ZONE 'Africa/Addis_Ababa')::date;
  v_total integer := 0;
  v_offset integer := 0;
  v_question record;
  v_correct boolean;
  v_existing public.daily_challenge_attempts%rowtype;
  v_inserted uuid;
  v_xp integer := 15;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_question_id IS NULL OR p_answer IS NULL THEN RAISE EXCEPTION 'Question and answer are required'; END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  SELECT count(*)::integer INTO v_total
  FROM public.quizzes z JOIN public.questions q ON q.quiz_id = z.id
  WHERE z.is_approved IS TRUE;
  IF v_total = 0 THEN RAISE EXCEPTION 'No approved daily challenge is available'; END IF;

  v_offset := (extract(year FROM v_date)::integer * 10000
    + extract(month FROM v_date)::integer * 100
    + extract(day FROM v_date)::integer) % v_total;
  SELECT q.id, q.correct_answer
  INTO v_question
  FROM public.quizzes z
  JOIN public.questions q ON q.quiz_id = z.id
  WHERE z.is_approved IS TRUE
  ORDER BY z.created_at DESC NULLS LAST, z.id ASC, q.order_index ASC NULLS LAST, q.id ASC
  OFFSET v_offset LIMIT 1;

  IF v_question.id IS DISTINCT FROM p_question_id THEN
    RAISE EXCEPTION 'This is not today''s assigned challenge';
  END IF;

  v_correct := p_answer = v_question.correct_answer;
  INSERT INTO public.daily_challenge_attempts(user_id, challenge_date, question_id, is_correct, xp_awarded)
  VALUES (v_user_id, v_date, v_question.id, v_correct, CASE WHEN v_correct THEN v_xp ELSE 0 END)
  ON CONFLICT (user_id, challenge_date) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN
    SELECT * INTO v_existing FROM public.daily_challenge_attempts
    WHERE user_id = v_user_id AND challenge_date = v_date;
    RETURN jsonb_build_object('success', false, 'already_submitted', true,
      'was_correct', v_existing.is_correct, 'xp_awarded', v_existing.xp_awarded);
  END IF;

  IF v_correct THEN
    UPDATE public.profiles
    SET xp = xp + v_xp,
        level = greatest(1, floor((xp + v_xp) / 100.0)::integer + 1),
        rank = public.calculate_rank(xp + v_xp),
        season_xp = season_xp + v_xp,
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'already_submitted', false,
    'correct', v_correct, 'correct_answer', v_question.correct_answer,
    'xp_awarded', CASE WHEN v_correct THEN v_xp ELSE 0 END);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_daily_challenge_question() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_challenge_question() TO authenticated;
REVOKE ALL ON FUNCTION public.submit_daily_challenge_answer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_daily_challenge_answer(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.wallet_action(
  p_action text,
  p_amount integer DEFAULT NULL,
  p_receiver_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_wallet public.user_currency%rowtype;
  v_profile public.profiles%rowtype;
  v_receiver_wallet public.user_currency%rowtype;
  v_streak public.user_streaks%rowtype;
  v_amount integer := coalesce(p_amount, 0);
  v_delta integer := 0;
  v_reward integer := 0;
  v_new_streak integer := 0;
  v_previous_streak integer := 0;
  v_outcome numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  IF p_action IS NULL OR p_action NOT IN (
    'spend_coins','spend_gems','convert_xp_to_coins',
    'convert_coins_to_gems','convert_coins_to_xp',
    'transfer_coins','claim_daily_reward','lucky_spin'
  ) THEN
    RAISE EXCEPTION 'Unsupported wallet action';
  END IF;

  IF p_action NOT IN ('claim_daily_reward','lucky_spin')
     AND (v_amount <= 0 OR v_amount > 1000000) THEN
    RAISE EXCEPTION 'Amount must be between 1 and 1000000';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

  INSERT INTO public.user_currency(user_id, coins, gems)
  VALUES (v_user_id, 100, 10)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.user_currency
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF p_action = 'spend_coins' THEN
    IF v_wallet.coins < v_amount THEN RAISE EXCEPTION 'Insufficient coins'; END IF;
    UPDATE public.user_currency SET coins = coins - v_amount, updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;
    INSERT INTO public.transactions(sender_id, amount, type, source)
    VALUES (v_user_id, v_amount, 'spend', 'wallet_action:spend_coins');

  ELSIF p_action = 'spend_gems' THEN
    IF v_wallet.gems < v_amount THEN RAISE EXCEPTION 'Insufficient gems'; END IF;
    UPDATE public.user_currency SET gems = gems - v_amount, updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;
    INSERT INTO public.transactions(sender_id, amount, type, source)
    VALUES (v_user_id, v_amount, 'spend', 'wallet_action:spend_gems');

  ELSIF p_action = 'convert_xp_to_coins' THEN
    IF v_amount < 100 THEN RAISE EXCEPTION 'Minimum XP exchange is 100'; END IF;
    IF v_profile.xp < v_amount THEN RAISE EXCEPTION 'Insufficient XP'; END IF;
    v_delta := floor(v_amount / 10.0)::integer;
    UPDATE public.profiles
    SET xp = xp - v_amount,
        level = greatest(1, floor((xp - v_amount) / 100.0)::integer + 1),
        rank = public.calculate_rank(greatest(0, xp - v_amount)),
        season_xp = greatest(0, season_xp - v_amount),
        updated_at = now()
    WHERE id = v_user_id;
    UPDATE public.user_currency
    SET coins = coins + v_delta, updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;
    INSERT INTO public.transactions(receiver_id, amount, type, source)
    VALUES (v_user_id, v_delta, 'conversion', 'wallet_action:xp_to_coins');

  ELSIF p_action = 'convert_coins_to_gems' THEN
    IF v_amount < 100 THEN RAISE EXCEPTION 'Minimum conversion is 100 coins'; END IF;
    IF v_wallet.coins < v_amount THEN RAISE EXCEPTION 'Insufficient coins'; END IF;
    v_delta := floor(v_amount / 100.0)::integer;
    UPDATE public.user_currency
    SET coins = coins - v_amount, gems = gems + v_delta, updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;
    INSERT INTO public.transactions(sender_id, amount, type, source)
    VALUES (v_user_id, v_amount, 'conversion', 'wallet_action:coins_to_gems');

  ELSIF p_action = 'convert_coins_to_xp' THEN
    IF v_amount < 10 THEN RAISE EXCEPTION 'Minimum conversion is 10 coins'; END IF;
    IF v_wallet.coins < v_amount THEN RAISE EXCEPTION 'Insufficient coins'; END IF;
    v_delta := v_amount * 10;
    UPDATE public.user_currency
    SET coins = coins - v_amount, updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;
    INSERT INTO public.transactions(sender_id, amount, type, source)
    VALUES (v_user_id, v_amount, 'conversion', 'wallet_action:coins_to_xp');
    UPDATE public.profiles
    SET xp = xp + v_delta,
        level = greatest(1, floor((xp + v_delta) / 100.0)::integer + 1),
        rank = public.calculate_rank(xp + v_delta),
        season_xp = season_xp + v_delta,
        updated_at = now()
    WHERE id = v_user_id;

  ELSIF p_action = 'transfer_coins' THEN
    IF p_receiver_id IS NULL OR p_receiver_id = v_user_id THEN
      RAISE EXCEPTION 'Choose a valid friend';
    END IF;
    IF v_amount < 10 THEN RAISE EXCEPTION 'Minimum transfer is 10 coins'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.friends
      WHERE status = 'accepted'
        AND ((user_id = v_user_id AND friend_id = p_receiver_id)
          OR (user_id = p_receiver_id AND friend_id = v_user_id))
    ) THEN
      RAISE EXCEPTION 'Coins can only be sent to an accepted friend';
    END IF;
    IF v_wallet.coins < v_amount THEN RAISE EXCEPTION 'Insufficient coins'; END IF;

    INSERT INTO public.user_currency(user_id, coins, gems)
    VALUES (p_receiver_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    PERFORM 1 FROM public.user_currency
    WHERE user_id IN (v_user_id, p_receiver_id)
    ORDER BY user_id FOR UPDATE;

    UPDATE public.user_currency
    SET coins = coins - v_amount, updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;

    UPDATE public.user_currency
    SET coins = coins + v_amount, updated_at = now()
    WHERE user_id = p_receiver_id RETURNING * INTO v_receiver_wallet;
    INSERT INTO public.transactions(sender_id, receiver_id, amount, type, source)
    VALUES (v_user_id, p_receiver_id, v_amount, 'transfer', 'wallet_action:friend_transfer');

  ELSIF p_action = 'claim_daily_reward' THEN
    INSERT INTO public.user_streaks(user_id, current_streak, longest_streak, last_activity_date)
    VALUES (v_user_id, 0, 0, NULL)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_streak
    FROM public.user_streaks
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_streak.last_daily_reward_date = current_date THEN
      RETURN jsonb_build_object('success', false, 'duplicate', true,
        'coins', v_wallet.coins, 'gems', v_wallet.gems, 'streak', v_streak.current_streak);
    END IF;

    v_previous_streak := coalesce(v_streak.current_streak, 0);
    IF v_streak.last_activity_date = current_date THEN
      v_new_streak := greatest(1, v_previous_streak);
    ELSIF v_streak.last_activity_date = current_date - 1 THEN
      v_new_streak := v_previous_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;
    v_reward := 25 + v_previous_streak * 5;

    UPDATE public.user_streaks
    SET current_streak = v_new_streak,
        longest_streak = greatest(longest_streak, v_new_streak),
        last_activity_date = current_date,
        last_daily_reward_date = current_date,
        updated_at = now()
    WHERE user_id = v_user_id;

    UPDATE public.user_currency
    SET coins = coins + v_reward, updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;
    INSERT INTO public.transactions(receiver_id, amount, type, source)
    VALUES (v_user_id, v_reward, 'reward', 'wallet_action:daily_reward');

    RETURN jsonb_build_object('success', true, 'reward_coins', v_reward,
      'coins', v_wallet.coins, 'gems', v_wallet.gems, 'streak', v_new_streak);

  ELSIF p_action = 'lucky_spin' THEN
    IF v_wallet.coins < 10 THEN RAISE EXCEPTION 'Need at least 10 coins to spin'; END IF;
    v_outcome := random();
    IF v_outcome > 0.9 THEN v_delta := 200;
    ELSIF v_outcome > 0.6 THEN v_delta := 50;
    ELSIF v_outcome > 0.3 THEN v_delta := 10;
    ELSE v_delta := -10;
    END IF;

    UPDATE public.user_currency
    SET coins = greatest(0, coins + v_delta), updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;
    INSERT INTO public.transactions(
      sender_id, receiver_id, amount, type, source
    ) VALUES (
      CASE WHEN v_delta < 0 THEN v_user_id ELSE NULL END,
      CASE WHEN v_delta > 0 THEN v_user_id ELSE NULL END,
      abs(v_delta), CASE WHEN v_delta > 0 THEN 'reward' ELSE 'spend' END,
      'wallet_action:lucky_spin'
    );

    RETURN jsonb_build_object('success', true, 'delta', v_delta,
      'message', CASE WHEN v_delta > 0 THEN 'Won ' || v_delta || ' coins!' ELSE 'Better luck next time' END,
      'coins', v_wallet.coins, 'gems', v_wallet.gems);
  END IF;

  RETURN jsonb_build_object('success', true, 'coins', v_wallet.coins, 'gems', v_wallet.gems);
END;
$function$;
