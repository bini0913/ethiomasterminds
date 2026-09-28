-- Production reconciliation for the live Supabase project.
-- This project was bootstrapped from a reconciled baseline, so this migration
-- intentionally hardens the live schema without replaying unrelated historical
-- migrations that are already represented by the production baseline.

ALTER FUNCTION public.calculate_rank(integer) SET search_path = public;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname NOT IN ('get_email_by_username', 'get_public_leaderboard')
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM anon',
      r.schema_name, r.function_name, r.args
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.email::text
  FROM auth.users au
  JOIN public.profiles p ON p.id = au.id
  WHERE lower(trim(p.username)) = lower(trim(_username))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_email_by_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_leaderboard(_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, name text, username text, xp integer, level integer, avatar text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.username, p.xp, p.level, p.avatar
  FROM public.profiles p
  ORDER BY p.xp DESC NULLS LAST, p.created_at ASC
  LIMIT greatest(1, least(coalesce(_limit, 50), 100));
$$;

REVOKE ALL ON FUNCTION public.get_public_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_leaderboard(integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND (
      auth.uid() = _user_id
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    )
  ORDER BY CASE role
    WHEN 'manager' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'teacher' THEN 3
    WHEN 'student' THEN 4
  END
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_data(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR (
    auth.uid() <> _user_id
    AND NOT public.has_role(auth.uid(), 'admin')
    AND NOT public.has_role(auth.uid(), 'manager')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT jsonb_build_object(
    'profile', to_jsonb(p.*),
    'currency', to_jsonb(uc.*),
    'streak', to_jsonb(us.*)
  )
  INTO result
  FROM public.profiles p
  LEFT JOIN public.user_currency uc ON uc.user_id = p.id
  LEFT JOIN public.user_streaks us ON us.user_id = p.id
  WHERE p.id = _user_id;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_data(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_stats(_user_id uuid)
RETURNS TABLE(xp integer, level integer, coins integer, gems integer, current_streak integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.xp, p.level, coalesce(uc.coins, 0), coalesce(uc.gems, 0), coalesce(us.current_streak, 0)
  FROM public.profiles p
  LEFT JOIN public.user_currency uc ON uc.user_id = p.id
  LEFT JOIN public.user_streaks us ON us.user_id = p.id
  WHERE p.id = _user_id
    AND (
      auth.uid() = _user_id
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
    );
$$;

REVOKE ALL ON FUNCTION public.get_user_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_user_streak(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE last_date date;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  SELECT last_activity_date INTO last_date FROM public.user_streaks WHERE user_id = _user_id;
  IF last_date IS NULL THEN
    INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_activity_date)
    VALUES (_user_id, 1, 1, current_date)
    ON CONFLICT (user_id) DO UPDATE SET current_streak = 1, last_activity_date = current_date;
  ELSIF last_date = current_date THEN
    NULL;
  ELSIF last_date = current_date - 1 THEN
    UPDATE public.user_streaks
    SET current_streak = current_streak + 1,
        longest_streak = greatest(longest_streak, current_streak + 1),
        last_activity_date = current_date
    WHERE user_id = _user_id;
  ELSE
    UPDATE public.user_streaks
    SET current_streak = 1, last_activity_date = current_date
    WHERE user_id = _user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_streak(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_user_streak(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_analytics(
  p_user_id uuid, p_subject text, p_correct integer, p_total integer, p_avg_time numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF p_total IS NULL OR p_total < 0 OR p_correct IS NULL OR p_correct < 0 OR p_correct > p_total THEN
    RAISE EXCEPTION 'Invalid analytics values';
  END IF;
  INSERT INTO public.analytics (
    user_id, subject, total_correct, total_questions_attempted, accuracy, average_time_per_question
  )
  VALUES (
    p_user_id, p_subject, p_correct, p_total,
    p_correct::numeric / NULLIF(p_total, 0) * 100, p_avg_time
  )
  ON CONFLICT ON CONSTRAINT analytics_user_subject_unique DO UPDATE
  SET total_correct = analytics.total_correct + p_correct,
      total_questions_attempted = analytics.total_questions_attempted + p_total,
      accuracy = (analytics.total_correct + p_correct)::numeric /
                 NULLIF(analytics.total_questions_attempted + p_total, 0) * 100,
      average_time_per_question = (analytics.average_time_per_question + p_avg_time) / 2,
      last_updated = now();
END;
$$;

REVOKE ALL ON FUNCTION public.update_analytics(uuid,text,integer,integer,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_analytics(uuid,text,integer,integer,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ach record;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  FOR ach IN SELECT * FROM public.achievements LOOP
    INSERT INTO public.user_achievements (user_id, achievement_id, progress, completed)
    VALUES (_user_id, ach.id, 0, false)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.check_achievements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_achievements(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_study_session(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  UPDATE public.study_sessions
  SET status = 'completed',
      end_time = now(),
      duration = extract(epoch FROM (now() - start_time))::integer
  WHERE id = _session_id
    AND user_id = auth.uid()
    AND status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.complete_study_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_study_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_end_season()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  PERFORM public.admin_force_start_new_season('Season ' || (season_number + 1)::text)
  FROM public.season_runtime_state
  WHERE id = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_end_season() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_end_season() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_quizzes_grade_subject_difficulty_approved
  ON public.quizzes (grade, subject, difficulty, is_approved);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_order
  ON public.questions (quiz_id, order_index);


-- Internal SECURITY DEFINER helpers are invoked by trusted functions/RLS and are
-- not browser RPCs. Remove direct execution grants from client roles.
REVOKE ALL ON FUNCTION public._resolve_user_identifier(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_xp(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_extras() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_student_in_class(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_teacher_of_class(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_teacher_of_student(uuid, uuid) FROM PUBLIC, anon, authenticated;
