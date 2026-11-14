-- Server-authoritative wallet actions, achievement progress and mission claims.
-- Student clients may read their own economy state but cannot mint or move rewards directly.

CREATE OR REPLACE FUNCTION public.initialize_user_currency()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_wallet public.user_currency%rowtype;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  INSERT INTO public.user_currency(user_id, coins, gems)
  VALUES (v_user_id, 100, 10)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.user_currency
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('coins', v_wallet.coins, 'gems', v_wallet.gems);
END;
$function$;

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

  ELSIF p_action = 'spend_gems' THEN
    IF v_wallet.gems < v_amount THEN RAISE EXCEPTION 'Insufficient gems'; END IF;
    UPDATE public.user_currency SET gems = gems - v_amount, updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;

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

  ELSIF p_action = 'convert_coins_to_gems' THEN
    IF v_amount < 100 THEN RAISE EXCEPTION 'Minimum conversion is 100 coins'; END IF;
    IF v_wallet.coins < v_amount THEN RAISE EXCEPTION 'Insufficient coins'; END IF;
    v_delta := floor(v_amount / 100.0)::integer;
    UPDATE public.user_currency
    SET coins = coins - v_amount, gems = gems + v_delta, updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;

  ELSIF p_action = 'convert_coins_to_xp' THEN
    IF v_amount < 10 THEN RAISE EXCEPTION 'Minimum conversion is 10 coins'; END IF;
    IF v_wallet.coins < v_amount THEN RAISE EXCEPTION 'Insufficient coins'; END IF;
    v_delta := v_amount * 10;
    UPDATE public.user_currency
    SET coins = coins - v_amount, updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;
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

  ELSIF p_action = 'claim_daily_reward' THEN
    INSERT INTO public.user_streaks(user_id, current_streak, longest_streak, last_activity_date)
    VALUES (v_user_id, 0, 0, NULL)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_streak
    FROM public.user_streaks
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_streak.last_activity_date = current_date THEN
      RETURN jsonb_build_object('success', false, 'duplicate', true,
        'coins', v_wallet.coins, 'gems', v_wallet.gems, 'streak', v_streak.current_streak);
    END IF;

    v_previous_streak := coalesce(v_streak.current_streak, 0);
    IF v_streak.last_activity_date = current_date - 1 THEN
      v_new_streak := v_previous_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;
    v_reward := 25 + v_previous_streak * 5;

    UPDATE public.user_streaks
    SET current_streak = v_new_streak,
        longest_streak = greatest(longest_streak, v_new_streak),
        last_activity_date = current_date,
        updated_at = now()
    WHERE user_id = v_user_id;

    UPDATE public.user_currency
    SET coins = coins + v_reward, updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;

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

    RETURN jsonb_build_object('success', true, 'delta', v_delta,
      'message', CASE WHEN v_delta > 0 THEN 'Won ' || v_delta || ' coins!' ELSE 'Better luck next time' END,
      'coins', v_wallet.coins, 'gems', v_wallet.gems);
  END IF;

  RETURN jsonb_build_object('success', true, 'coins', v_wallet.coins, 'gems', v_wallet.gems);
END;
$function$;

-- Achievement progress is computed from durable server-side activity records.
CREATE OR REPLACE FUNCTION public.sync_student_achievement_progress(p_requirement_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_progress integer := 0;
  v_achievement record;
  v_existing public.user_achievements%rowtype;
  v_new_xp integer := 0;
  v_new_coins integer := 0;
  v_just_completed boolean := false;
  v_was_completed boolean := false;
  v_profile public.profiles%rowtype;
  v_wallet public.user_currency%rowtype;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_requirement_type NOT IN ('quizzes_completed','perfect_scores','friends_added') THEN
    RAISE EXCEPTION 'Unsupported achievement activity';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF p_requirement_type = 'quizzes_completed' THEN
    SELECT count(*)::integer INTO v_progress
    FROM public.quiz_results WHERE student_id = v_user_id;
  ELSIF p_requirement_type = 'perfect_scores' THEN
    SELECT count(*)::integer INTO v_progress
    FROM public.quiz_results
    WHERE student_id = v_user_id AND total_questions > 0
      AND correct_answers = total_questions;
  ELSE
    SELECT count(*)::integer INTO v_progress
    FROM public.friends
    WHERE status = 'accepted' AND (user_id = v_user_id OR friend_id = v_user_id);
  END IF;

  FOR v_achievement IN
    SELECT * FROM public.achievements
    WHERE requirement_type = p_requirement_type
  LOOP
    v_just_completed := false;
    v_was_completed := false;
    SELECT * INTO v_existing
    FROM public.user_achievements
    WHERE user_id = v_user_id AND achievement_id = v_achievement.id
    FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.user_achievements(user_id, achievement_id, progress, completed, unlocked_at)
      VALUES (v_user_id, v_achievement.id, least(v_progress, v_achievement.requirement_value),
        v_progress >= v_achievement.requirement_value,
        CASE WHEN v_progress >= v_achievement.requirement_value THEN now() ELSE NULL END)
      RETURNING * INTO v_existing;

      IF v_existing.completed THEN
        v_just_completed := true;
        v_new_xp := v_new_xp + greatest(0, coalesce(v_achievement.reward_xp,0));
        v_new_coins := v_new_coins + greatest(0, coalesce(v_achievement.reward_coins,0));
      END IF;
    ELSE
      v_was_completed := v_existing.completed;
      UPDATE public.user_achievements
      SET progress = greatest(progress, least(v_progress, v_achievement.requirement_value)),
          completed = completed OR v_progress >= v_achievement.requirement_value,
          unlocked_at = CASE WHEN NOT completed AND v_progress >= v_achievement.requirement_value
            THEN now() ELSE unlocked_at END
      WHERE id = v_existing.id
      RETURNING * INTO v_existing;

      IF NOT v_was_completed AND v_existing.completed THEN
        v_just_completed := true;
      END IF;
      IF v_just_completed THEN
        v_new_xp := v_new_xp + greatest(0, coalesce(v_achievement.reward_xp,0));
        v_new_coins := v_new_coins + greatest(0, coalesce(v_achievement.reward_coins,0));
      END IF;
    END IF;
  END LOOP;

  IF v_new_xp > 0 THEN
    UPDATE public.profiles
    SET xp = xp + v_new_xp,
        level = greatest(1, floor((xp + v_new_xp) / 100.0)::integer + 1),
        rank = public.calculate_rank(xp + v_new_xp),
        season_xp = season_xp + v_new_xp,
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  IF v_new_coins > 0 THEN
    INSERT INTO public.user_currency(user_id, coins, gems)
    VALUES (v_user_id, 100 + v_new_coins, 10)
    ON CONFLICT (user_id) DO UPDATE
      SET coins = public.user_currency.coins + EXCLUDED.coins - 100,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object('progress', v_progress, 'xp_awarded', v_new_xp, 'coins_awarded', v_new_coins);
END;
$function$;

-- Mission rewards are claimed exactly once and only after server-recorded completion.
CREATE OR REPLACE FUNCTION public.claim_daily_mission(p_mission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_assignment public.user_missions%rowtype;
  v_mission public.daily_missions%rowtype;
  v_wallet public.user_currency%rowtype;
  v_xp integer := 0;
  v_coins integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_mission_id IS NULL THEN RAISE EXCEPTION 'Mission id is required'; END IF;

  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  SELECT * INTO v_assignment
  FROM public.user_missions
  WHERE id = p_mission_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Mission not found'; END IF;
  IF v_assignment.claimed THEN
    RETURN jsonb_build_object('success', false, 'already_claimed', true);
  END IF;
  IF NOT v_assignment.completed THEN RAISE EXCEPTION 'Mission is not completed'; END IF;

  SELECT * INTO v_mission
  FROM public.daily_missions
  WHERE id = v_assignment.mission_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Mission is no longer active'; END IF;

  v_xp := greatest(0, coalesce(v_mission.reward_xp, 0));
  v_coins := greatest(0, coalesce(v_mission.reward_coins, 0));

  UPDATE public.user_missions SET claimed = true WHERE id = v_assignment.id;

  UPDATE public.profiles
  SET xp = xp + v_xp,
      level = greatest(1, floor((xp + v_xp) / 100.0)::integer + 1),
      rank = public.calculate_rank(xp + v_xp),
      season_xp = season_xp + v_xp,
      updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.user_currency(user_id, coins, gems)
  VALUES (v_user_id, 100 + v_coins, 10)
  ON CONFLICT (user_id) DO UPDATE
    SET coins = public.user_currency.coins + EXCLUDED.coins - 100,
        updated_at = now()
  RETURNING * INTO v_wallet;

  RETURN jsonb_build_object('success', true, 'xp_awarded', v_xp,
    'coins_awarded', v_coins, 'coins', v_wallet.coins);
END;
$function$;

-- The legacy helper had no caller identity check. It is internal-only now.
REVOKE ALL ON FUNCTION public.add_xp(uuid, integer) FROM PUBLIC, anon, authenticated;

-- Quiz results must be created by submit_quiz_result_secure, not direct client inserts.
DROP POLICY IF EXISTS "student inserts own result" ON public.quiz_results;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.quiz_results FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.quiz_results TO authenticated;

REVOKE ALL ON FUNCTION public.initialize_user_currency() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.initialize_user_currency() TO authenticated;
REVOKE ALL ON FUNCTION public.wallet_action(text, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_action(text, integer, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.sync_student_achievement_progress(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_student_achievement_progress(text) TO authenticated;
REVOKE ALL ON FUNCTION public.claim_daily_mission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_mission(uuid) TO authenticated;
