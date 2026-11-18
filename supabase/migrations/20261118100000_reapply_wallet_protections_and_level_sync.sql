-- Restore lost wallet protections on top of the currently deployed wallet_action.
-- This migration is additive and preserves the current JSON response contract.

ALTER TABLE public.user_currency
  ADD COLUMN IF NOT EXISTS daily_transfer_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_transfer_date date NOT NULL DEFAULT (current_date),
  ADD COLUMN IF NOT EXISTS daily_exchange_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_exchange_date date NOT NULL DEFAULT (current_date);

ALTER TABLE public.user_currency
  DROP CONSTRAINT IF EXISTS user_currency_daily_transfer_sent_check,
  DROP CONSTRAINT IF EXISTS user_currency_daily_exchange_used_check;

ALTER TABLE public.user_currency
  ADD CONSTRAINT user_currency_daily_transfer_sent_check CHECK (daily_transfer_sent >= 0),
  ADD CONSTRAINT user_currency_daily_exchange_used_check CHECK (daily_exchange_used >= 0);

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
  v_exchange_action boolean := false;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  IF p_action IS NULL OR p_action NOT IN (
    'spend_coins','spend_gems','convert_xp_to_coins',
    'convert_coins_to_gems','convert_coins_to_xp',
    'transfer_coins','claim_daily_reward'
  ) THEN
    RAISE EXCEPTION 'Unsupported wallet action';
  END IF;

  IF p_action <> 'claim_daily_reward'
     AND (v_amount <= 0 OR v_amount > 1000000) THEN
    RAISE EXCEPTION 'Amount must be between 1 and 1000000';
  END IF;

  v_exchange_action := p_action IN ('convert_xp_to_coins','convert_coins_to_gems','convert_coins_to_xp');

  PERFORM 1 FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

  INSERT INTO public.user_currency(user_id, coins, gems)
  VALUES (v_user_id, 100, 10)
  ON CONFLICT (user_id) DO NOTHING;

  -- Lock both transfer wallets in UUID order before reading either balance.
  -- This prevents two friends transferring in opposite directions from deadlocking.
  IF p_action = 'transfer_coins' THEN
    IF p_receiver_id IS NULL OR p_receiver_id = v_user_id THEN
      RAISE EXCEPTION 'Choose a valid friend';
    END IF;
    INSERT INTO public.user_currency(user_id, coins, gems)
    VALUES (p_receiver_id, 100, 10)
    ON CONFLICT (user_id) DO NOTHING;
    PERFORM 1 FROM public.user_currency
    WHERE user_id IN (v_user_id, p_receiver_id)
    ORDER BY user_id
    FOR UPDATE;
  END IF;

  SELECT * INTO v_wallet
  FROM public.user_currency
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_wallet.daily_transfer_date < current_date THEN
    UPDATE public.user_currency
    SET daily_transfer_sent = 0, daily_transfer_date = current_date
    WHERE user_id = v_user_id;
    v_wallet.daily_transfer_sent := 0;
    v_wallet.daily_transfer_date := current_date;
  END IF;
  IF v_wallet.daily_exchange_date < current_date THEN
    UPDATE public.user_currency
    SET daily_exchange_used = 0, daily_exchange_date = current_date
    WHERE user_id = v_user_id;
    v_wallet.daily_exchange_used := 0;
    v_wallet.daily_exchange_date := current_date;
  END IF;

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
    IF v_wallet.daily_exchange_used + v_amount > 1000 THEN
      RAISE EXCEPTION 'Daily exchange limit reached (1000 units max)';
    END IF;
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
    SET coins = coins + v_delta,
        daily_exchange_used = daily_exchange_used + v_amount,
        daily_exchange_date = current_date,
        updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;
    INSERT INTO public.transactions(receiver_id, amount, type, source)
    VALUES (v_user_id, v_delta, 'conversion', 'wallet_action:xp_to_coins');

  ELSIF p_action = 'convert_coins_to_gems' THEN
    IF v_amount < 100 THEN RAISE EXCEPTION 'Minimum conversion is 100 coins'; END IF;
    IF v_wallet.daily_exchange_used + v_amount > 1000 THEN
      RAISE EXCEPTION 'Daily exchange limit reached (1000 units max)';
    END IF;
    IF v_wallet.coins < v_amount THEN RAISE EXCEPTION 'Insufficient coins'; END IF;
    v_delta := floor(v_amount / 100.0)::integer;
    UPDATE public.user_currency
    SET coins = coins - v_amount, gems = gems + v_delta,
        daily_exchange_used = daily_exchange_used + v_amount,
        daily_exchange_date = current_date, updated_at = now()
    WHERE user_id = v_user_id RETURNING * INTO v_wallet;
    INSERT INTO public.transactions(sender_id, amount, type, source)
    VALUES (v_user_id, v_amount, 'conversion', 'wallet_action:coins_to_gems');

  ELSIF p_action = 'convert_coins_to_xp' THEN
    IF v_amount < 10 THEN RAISE EXCEPTION 'Minimum conversion is 10 coins'; END IF;
    IF v_wallet.daily_exchange_used + v_amount > 1000 THEN
      RAISE EXCEPTION 'Daily exchange limit reached (1000 units max)';
    END IF;
    IF v_wallet.coins < v_amount THEN RAISE EXCEPTION 'Insufficient coins'; END IF;
    v_delta := v_amount * 10;
    UPDATE public.user_currency
    SET coins = coins - v_amount,
        daily_exchange_used = daily_exchange_used + v_amount,
        daily_exchange_date = current_date, updated_at = now()
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
    IF v_amount < 10 THEN RAISE EXCEPTION 'Minimum transfer is 10 coins'; END IF;
    IF v_wallet.daily_transfer_sent + v_amount > 500 THEN
      RAISE EXCEPTION 'Daily transfer limit reached (500 coins max)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.friends
      WHERE status = 'accepted'
        AND ((user_id = v_user_id AND friend_id = p_receiver_id)
          OR (user_id = p_receiver_id AND friend_id = v_user_id))
    ) THEN
      RAISE EXCEPTION 'Coins can only be sent to an accepted friend';
    END IF;
    IF v_wallet.coins < v_amount THEN RAISE EXCEPTION 'Insufficient coins'; END IF;

    UPDATE public.user_currency
    SET coins = coins - v_amount,
        daily_transfer_sent = daily_transfer_sent + v_amount,
        daily_transfer_date = current_date,
        updated_at = now()
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
  END IF;

  RETURN jsonb_build_object('success', true, 'coins', v_wallet.coins, 'gems', v_wallet.gems);
END;
$function$;

REVOKE ALL ON FUNCTION public.wallet_action(text, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_action(text, integer, uuid) TO authenticated;

-- The Store UI no longer exposes lucky spin. Keep no authenticated RPC path for it.
DO $$
BEGIN
  IF to_regprocedure('public.perform_lucky_spin()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.perform_lucky_spin() FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;

-- Study rewards must update the derived level at the same time as XP.
CREATE OR REPLACE FUNCTION public.complete_study_session(
  p_session_id uuid,
  p_duration_override integer DEFAULT NULL,
  p_task_id uuid DEFAULT NULL,
  p_mark_task_complete boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.study_sessions%ROWTYPE;
  v_elapsed_minutes integer;
  v_minutes integer;
  v_xp integer;
  v_coins integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
    INTO v_session
  FROM public.study_sessions
  WHERE id = p_session_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'Study session has already been completed';
  END IF;

  v_elapsed_minutes := GREATEST(
    1,
    CEIL(EXTRACT(EPOCH FROM (now() - v_session.start_time)) / 60)::integer
  );

  -- Never accept a duration larger than the server-observed elapsed time or
  -- the planned session length. A smaller client value may only reduce reward.
  v_minutes := v_elapsed_minutes;
  IF v_session.planned_duration IS NOT NULL AND v_session.planned_duration > 0 THEN
    v_minutes := LEAST(v_minutes, v_session.planned_duration);
  END IF;
  IF p_duration_override IS NOT NULL THEN
    IF p_duration_override < 1 OR p_duration_override > v_elapsed_minutes + 1 THEN
      RAISE EXCEPTION 'Invalid study duration';
    END IF;
    v_minutes := LEAST(v_minutes, p_duration_override);
  END IF;

  v_minutes := GREATEST(1, v_minutes);
  v_xp := v_minutes * 10;
  v_coins := GREATEST(1, v_minutes / 5);

  UPDATE public.study_sessions
  SET status = 'completed',
      end_time = now(),
      duration = v_minutes
  WHERE id = v_session.id;

  INSERT INTO public.study_live_status (
    user_id, is_studying, current_session_start, updated_at
  )
  VALUES (auth.uid(), false, NULL, now())
  ON CONFLICT (user_id) DO UPDATE
  SET is_studying = false,
      current_session_start = NULL,
      updated_at = now();

  IF v_session.competition_id IS NOT NULL THEN
    INSERT INTO public.study_participants (
      competition_id, user_id, total_study_time
    )
    VALUES (v_session.competition_id, auth.uid(), v_minutes)
    ON CONFLICT (competition_id, user_id)
    DO UPDATE SET total_study_time =
      public.study_participants.total_study_time + EXCLUDED.total_study_time;
  END IF;

  IF p_task_id IS NOT NULL AND p_mark_task_complete THEN
    UPDATE public.study_tasks
    SET completed = true
    WHERE id = p_task_id
      AND user_id = auth.uid();
  END IF;

  PERFORM public.add_xp(auth.uid(), v_xp);

  -- Keep the derived progression fields correct even if add_xp is reconciled independently.
  UPDATE public.profiles
  SET level = greatest(1, floor(coalesce(xp, 0) / 100.0)::integer + 1),
      rank = public.calculate_rank(coalesce(xp, 0)),
      updated_at = now()
  WHERE id = auth.uid();

  INSERT INTO public.user_currency (user_id, coins)
  VALUES (auth.uid(), v_coins)
  ON CONFLICT (user_id) DO UPDATE
  SET coins = public.user_currency.coins + EXCLUDED.coins,
      updated_at = now();

  RETURN jsonb_build_object(
    'minutes', v_minutes,
    'xp_earned', v_xp,
    'coins_earned', v_coins
  );
END;
$$;
REVOKE ALL ON FUNCTION public.complete_study_session(uuid,integer,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_study_session(uuid,integer,uuid,boolean) TO authenticated;

-- Do not backfill profiles in a schema migration. The profile update trigger
-- intentionally requires an authenticated request context, which migrations
-- do not have. Progression is synchronized by the trusted reward RPCs above.
