-- Production hardening batch 3: close remaining study-session replay and admin-data RPC exposure paths.

-- A study session is a one-time reward event. The server derives the duration from
-- the real session clock and planned duration instead of trusting a client override.
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

REVOKE ALL ON FUNCTION public.complete_study_session(uuid, integer, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_study_session(uuid, integer, uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_study_session(uuid, integer, uuid, boolean) TO authenticated;

-- These functions return administrative season statistics and projected rewards.
-- They must never be callable by arbitrary authenticated/anonymous users.
CREATE OR REPLACE FUNCTION public.admin_get_current_season_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state public.season_runtime_state%ROWTYPE;
  v_total_users integer;
  v_total_xp bigint;
  v_top_name text;
BEGIN
  IF public.get_user_role(auth.uid()) NOT IN ('admin', 'manager', 'extreme_admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT *
    INTO v_state
  FROM public.season_runtime_state
  WHERE id = 1;

  SELECT COUNT(*), COALESCE(SUM(season_xp), 0)
    INTO v_total_users, v_total_xp
  FROM public.profiles
  WHERE season_xp > 0;

  SELECT name
    INTO v_top_name
  FROM public.profiles
  WHERE role = 'student'
  ORDER BY season_xp DESC NULLS LAST, created_at ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'season_name', v_state.current_season_name,
    'season_number', v_state.season_number,
    'started_at', v_state.started_at,
    'total_users', COALESCE(v_total_users, 0),
    'total_xp', COALESCE(v_total_xp, 0),
    'top_player', COALESCE(v_top_name, '—')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_season_rewards_preview(
  p_conversion_rate numeric DEFAULT 0.1,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  user_id uuid,
  name text,
  season_xp integer,
  projected_rank integer,
  projected_coins integer,
  projected_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role(auth.uid()) NOT IN ('admin', 'manager', 'extreme_admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_conversion_rate IS NULL OR p_conversion_rate < 0 OR p_conversion_rate > 100 THEN
    RAISE EXCEPTION 'Invalid conversion rate';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    COALESCE(p.season_xp, 0),
    ROW_NUMBER() OVER (ORDER BY p.season_xp DESC NULLS LAST, p.created_at ASC)::integer,
    GREATEST(
      0,
      FLOOR(COALESCE(p.season_xp, 0) * p_conversion_rate)
    )::integer,
    CASE
      WHEN ROW_NUMBER() OVER (ORDER BY p.season_xp DESC NULLS LAST, p.created_at ASC) = 1
        THEN 'Champion'
      WHEN ROW_NUMBER() OVER (ORDER BY p.season_xp DESC NULLS LAST, p.created_at ASC) <= 3
        THEN 'Podium'
      WHEN ROW_NUMBER() OVER (ORDER BY p.season_xp DESC NULLS LAST, p.created_at ASC) <= 10
        THEN 'Top 10'
      ELSE NULL
    END
  FROM public.profiles p
  WHERE p.role = 'student'
    AND COALESCE(p.season_xp, 0) > 0
  ORDER BY p.season_xp DESC NULLS LAST, p.created_at ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_current_season_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_current_season_stats() FROM anon;
REVOKE ALL ON FUNCTION public.admin_get_current_season_stats() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_current_season_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_get_season_rewards_preview(numeric, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_season_rewards_preview(numeric, integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_get_season_rewards_preview(numeric, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_season_rewards_preview(numeric, integer) TO authenticated;

-- The class leaderboard is an authenticated product surface, not an anonymous
-- data endpoint.
REVOKE EXECUTE ON FUNCTION public.get_class_competition_leaderboard(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_class_competition_leaderboard(integer) TO authenticated;
