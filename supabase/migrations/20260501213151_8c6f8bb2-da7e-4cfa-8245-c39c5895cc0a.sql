
-- ============================================================
-- STUDY MODE TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.study_competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  duration integer,
  planned_duration integer,
  mode text,
  status text NOT NULL DEFAULT 'active',
  competition_id uuid REFERENCES public.study_competitions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON public.study_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.study_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_tasks_user ON public.study_tasks(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.study_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.study_competitions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  total_study_time integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.study_live_status (
  user_id uuid PRIMARY KEY,
  is_studying boolean NOT NULL DEFAULT false,
  current_session_start timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.study_settings (
  user_id uuid PRIMARY KEY,
  default_study_time integer NOT NULL DEFAULT 25,
  default_break_time integer NOT NULL DEFAULT 5,
  auto_start_break boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_live_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions" ON public.study_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own tasks" ON public.study_tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone authed views competitions" ON public.study_competitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create competitions" ON public.study_competitions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators update competitions" ON public.study_competitions FOR UPDATE USING (auth.uid() = created_by OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "Anyone authed views participants" ON public.study_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users join competitions" ON public.study_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own participation" ON public.study_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone authed views live status" ON public.study_live_status FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own live status" ON public.study_live_status FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own study settings" ON public.study_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- complete_study_session RPC
CREATE OR REPLACE FUNCTION public.complete_study_session(
  p_session_id uuid,
  p_duration_override integer DEFAULT NULL,
  p_task_id uuid DEFAULT NULL,
  p_mark_task_complete boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session study_sessions%ROWTYPE;
  v_minutes integer;
  v_xp integer;
  v_coins integer;
BEGIN
  SELECT * INTO v_session FROM study_sessions WHERE id = p_session_id;
  IF v_session IS NULL THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF v_session.user_id <> auth.uid() THEN RAISE EXCEPTION 'Not your session'; END IF;

  v_minutes := COALESCE(p_duration_override,
    GREATEST(1, CEIL(EXTRACT(EPOCH FROM (now() - v_session.start_time))/60)::int));
  v_xp := v_minutes * 10;
  v_coins := GREATEST(1, v_minutes / 5);

  UPDATE study_sessions
     SET status = 'completed', end_time = now(), duration = v_minutes
   WHERE id = p_session_id;

  -- live status off
  INSERT INTO study_live_status (user_id, is_studying, current_session_start, updated_at)
  VALUES (auth.uid(), false, NULL, now())
  ON CONFLICT (user_id) DO UPDATE SET is_studying = false, current_session_start = NULL, updated_at = now();

  -- competition tally
  IF v_session.competition_id IS NOT NULL THEN
    INSERT INTO study_participants (competition_id, user_id, total_study_time)
    VALUES (v_session.competition_id, auth.uid(), v_minutes)
    ON CONFLICT (competition_id, user_id)
    DO UPDATE SET total_study_time = study_participants.total_study_time + v_minutes;
  END IF;

  -- task complete
  IF p_task_id IS NOT NULL AND p_mark_task_complete THEN
    UPDATE study_tasks SET completed = true WHERE id = p_task_id AND user_id = auth.uid();
  END IF;

  -- award XP (also credits coins automatically + season XP via trigger below)
  PERFORM add_xp(auth.uid(), v_xp);

  -- bonus coins on top of XP-derived coins
  INSERT INTO user_currency (user_id, coins) VALUES (auth.uid(), v_coins)
  ON CONFLICT (user_id) DO UPDATE SET coins = user_currency.coins + v_coins, updated_at = now();

  RETURN jsonb_build_object('minutes', v_minutes, 'xp_earned', v_xp, 'coins_earned', v_coins);
END;
$$;

-- ============================================================
-- SEASON SYSTEM
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS season_xp integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.season_runtime_state (
  id integer PRIMARY KEY DEFAULT 1,
  current_season_name text NOT NULL DEFAULT 'Season 1',
  season_number integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO public.season_runtime_state (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.season_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_name text NOT NULL,
  season_number integer NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL DEFAULT now(),
  ended_by uuid,
  reason text,
  total_users integer NOT NULL DEFAULT 0,
  total_xp bigint NOT NULL DEFAULT 0,
  top_user_id uuid,
  top_user_name text,
  conversion_rate numeric NOT NULL DEFAULT 0.1,
  results jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.season_runtime_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed views season state" ON public.season_runtime_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage season state" ON public.season_runtime_state FOR ALL USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "Anyone authed views season history" ON public.season_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage season history" ON public.season_history FOR ALL USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- Update add_xp to also accumulate season_xp
CREATE OR REPLACE FUNCTION public.add_xp(p_user_id uuid, p_amount integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_xp INTEGER;
  v_new_xp INTEGER;
  v_current_level INTEGER;
  v_new_level INTEGER;
  v_new_rank TEXT;
  v_leveled_up BOOLEAN := false;
  v_coins_to_add INTEGER := 0;
BEGIN
  SELECT xp, level INTO v_current_xp, v_current_level FROM profiles WHERE id = p_user_id;
  v_new_xp := COALESCE(v_current_xp,0) + p_amount;
  v_new_level := FLOOR(v_new_xp / 100) + 1;
  v_new_rank := calculate_rank(v_new_xp);
  v_leveled_up := v_new_level > COALESCE(v_current_level,1);

  UPDATE profiles
     SET xp = v_new_xp,
         level = v_new_level,
         rank = v_new_rank,
         season_xp = GREATEST(0, COALESCE(season_xp,0) + p_amount)
   WHERE id = p_user_id;

  IF p_amount > 0 THEN
    v_coins_to_add := FLOOR(p_amount / 100);
    IF v_coins_to_add > 0 THEN
      INSERT INTO user_currency (user_id, coins) VALUES (p_user_id, v_coins_to_add)
      ON CONFLICT (user_id) DO UPDATE
      SET coins = user_currency.coins + v_coins_to_add, updated_at = now();
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'previous_xp', v_current_xp, 'new_xp', v_new_xp, 'xp_gained', p_amount,
    'previous_level', v_current_level, 'new_level', v_new_level,
    'leveled_up', v_leveled_up, 'rank', v_new_rank,
    'coins_added', COALESCE(v_coins_to_add,0)
  );
END;
$$;

-- admin_update_user_xp (used by AdminPortal)
CREATE OR REPLACE FUNCTION public.admin_update_user_xp(
  p_user_identifier text, p_xp_amount integer, p_action text DEFAULT 'add'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid; v_delta integer;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  v_uid := _resolve_user_identifier(p_user_identifier);
  IF v_uid IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  v_delta := CASE WHEN p_action = 'remove' THEN -ABS(p_xp_amount) ELSE ABS(p_xp_amount) END;
  RETURN admin_adjust_xp(p_user_identifier, v_delta);
END;
$$;

-- Stats RPC
CREATE OR REPLACE FUNCTION public.admin_get_current_season_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_state season_runtime_state%ROWTYPE; v_total_users int; v_total_xp bigint; v_top_name text;
BEGIN
  SELECT * INTO v_state FROM season_runtime_state WHERE id = 1;
  SELECT COUNT(*), COALESCE(SUM(season_xp),0) INTO v_total_users, v_total_xp
    FROM profiles WHERE season_xp > 0;
  SELECT name INTO v_top_name FROM profiles ORDER BY season_xp DESC NULLS LAST LIMIT 1;
  RETURN jsonb_build_object(
    'season_name', v_state.current_season_name,
    'season_number', v_state.season_number,
    'started_at', v_state.started_at,
    'total_users', COALESCE(v_total_users,0),
    'total_xp', COALESCE(v_total_xp,0),
    'top_player', COALESCE(v_top_name,'—')
  );
END;
$$;

-- Preview RPC
CREATE OR REPLACE FUNCTION public.admin_get_season_rewards_preview(
  p_conversion_rate numeric DEFAULT 0.1, p_limit integer DEFAULT 10
) RETURNS TABLE(user_id uuid, name text, season_xp integer, projected_rank integer, projected_coins integer, projected_title text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, COALESCE(p.season_xp,0),
    ROW_NUMBER() OVER (ORDER BY p.season_xp DESC NULLS LAST)::int,
    GREATEST(0, FLOOR(COALESCE(p.season_xp,0) * COALESCE(p_conversion_rate,0.1)))::int,
    CASE
      WHEN ROW_NUMBER() OVER (ORDER BY p.season_xp DESC NULLS LAST) = 1 THEN 'Champion'
      WHEN ROW_NUMBER() OVER (ORDER BY p.season_xp DESC NULLS LAST) <= 3 THEN 'Podium'
      WHEN ROW_NUMBER() OVER (ORDER BY p.season_xp DESC NULLS LAST) <= 10 THEN 'Top 10'
      ELSE NULL
    END
  FROM profiles p
  WHERE COALESCE(p.season_xp,0) > 0
  ORDER BY p.season_xp DESC NULLS LAST
  LIMIT GREATEST(1, p_limit);
END;
$$;

-- End season RPC
CREATE OR REPLACE FUNCTION public.admin_end_season(
  p_conversion_rate numeric DEFAULT 0.1,
  p_reason text DEFAULT NULL,
  p_confirm_text text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_state season_runtime_state%ROWTYPE;
  v_total_users int; v_total_xp bigint;
  v_top_id uuid; v_top_name text;
  v_results jsonb;
  v_next_name text;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF UPPER(COALESCE(p_confirm_text,'')) <> 'CONFIRM' THEN
    RAISE EXCEPTION 'Confirmation text required';
  END IF;

  SELECT * INTO v_state FROM season_runtime_state WHERE id = 1;

  SELECT COUNT(*), COALESCE(SUM(season_xp),0) INTO v_total_users, v_total_xp
    FROM profiles WHERE season_xp > 0;
  SELECT id, name INTO v_top_id, v_top_name FROM profiles
    ORDER BY season_xp DESC NULLS LAST LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', p.id, 'name', p.name, 'season_xp', p.season_xp,
    'rank', rn, 'coins_awarded', FLOOR(p.season_xp * COALESCE(p_conversion_rate,0.1))::int
  ) ORDER BY rn), '[]'::jsonb) INTO v_results
  FROM (
    SELECT id, name, COALESCE(season_xp,0) AS season_xp,
           ROW_NUMBER() OVER (ORDER BY season_xp DESC NULLS LAST) AS rn
    FROM profiles WHERE COALESCE(season_xp,0) > 0
  ) p;

  -- Award conversion coins
  WITH ranked AS (
    SELECT id, FLOOR(COALESCE(season_xp,0) * COALESCE(p_conversion_rate,0.1))::int AS award
    FROM profiles WHERE COALESCE(season_xp,0) > 0
  )
  INSERT INTO user_currency (user_id, coins)
  SELECT id, award FROM ranked WHERE award > 0
  ON CONFLICT (user_id) DO UPDATE SET coins = user_currency.coins + EXCLUDED.coins, updated_at = now();

  -- Archive
  INSERT INTO season_history (season_name, season_number, started_at, ended_by, reason,
    total_users, total_xp, top_user_id, top_user_name, conversion_rate, results)
  VALUES (v_state.current_season_name, v_state.season_number, v_state.started_at, auth.uid(), p_reason,
    COALESCE(v_total_users,0), COALESCE(v_total_xp,0), v_top_id, v_top_name, COALESCE(p_conversion_rate,0.1), v_results);

  -- Reset season XP
  UPDATE profiles SET season_xp = 0;

  -- Start next season
  v_next_name := 'Season ' || (v_state.season_number + 1);
  UPDATE season_runtime_state
     SET current_season_name = v_next_name,
         season_number = v_state.season_number + 1,
         started_at = now()
   WHERE id = 1;

  RETURN jsonb_build_object('next_season', v_next_name, 'archived_users', COALESCE(v_total_users,0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_force_start_new_season(p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN admin_end_season(0.1, COALESCE(p_reason,'Forced start'), 'CONFIRM');
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_competitions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_live_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.season_runtime_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.season_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
