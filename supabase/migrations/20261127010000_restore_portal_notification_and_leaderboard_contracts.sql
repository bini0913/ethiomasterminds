-- Restore the user-owned notification preference contract used by the web and native clients.
-- This migration is intentionally additive and keeps all preference data behind per-user RLS.
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  daily_reminders boolean NOT NULL DEFAULT true,
  achievements boolean NOT NULL DEFAULT true,
  social boolean NOT NULL DEFAULT true,
  game_invites boolean NOT NULL DEFAULT true,
  new_content boolean NOT NULL DEFAULT true,
  streaks boolean NOT NULL DEFAULT true,
  study_reminders boolean NOT NULL DEFAULT true,
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_start time NOT NULL DEFAULT '21:00',
  quiet_end time NOT NULL DEFAULT '07:00',
  reminder_hour smallint NOT NULL DEFAULT 18 CHECK (reminder_hour BETWEEN 0 AND 23),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
REVOKE ALL ON TABLE public.notification_preferences FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_preferences TO authenticated;

-- The hardened functions deliberately use a pg_catalog-only search path. Resolve
-- auth.uid explicitly so the hardening does not turn authenticated calls into
-- runtime "function auth.uid does not exist" failures.
CREATE OR REPLACE FUNCTION public.get_student_leaderboard()
RETURNS TABLE (
  id uuid, name text, username text, avatar text, avatar_config jsonb, grade integer,
  xp integer, season_xp integer, level integer, rank text, badges text[], streak integer,
  accuracy numeric, matches_played integer, wins integer, losses integer, contributions integer,
  weekly_score integer, monthly_score integer, total_xp integer, coins integer, active_title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  WITH attempt_stats AS (
    SELECT qa.user_id,
      count(*) FILTER (WHERE qa.created_at >= now()-interval '7 days')::integer weekly_attempts,
      count(*) FILTER (WHERE qa.created_at >= now()-interval '7 days' AND qa.is_correct)::integer weekly_correct,
      count(*) FILTER (WHERE qa.created_at >= now()-interval '30 days')::integer monthly_attempts,
      count(*) FILTER (WHERE qa.created_at >= now()-interval '30 days' AND qa.is_correct)::integer monthly_correct
    FROM public.question_attempts qa
    WHERE qa.created_at >= now()-interval '30 days'
    GROUP BY qa.user_id
  )
  SELECT p.id,
    coalesce(nullif(trim(p.name),''),nullif(trim(p.username),''),'Learner')::text,
    coalesce(nullif(trim(p.username),''),nullif(trim(p.name),''),'learner')::text,
    p.avatar,p.avatar_config,
    CASE WHEN lower(trim(coalesce(p.grade,''))) IN ('k','kg','kindergarten') THEN 0
      ELSE nullif(regexp_replace(coalesce(p.grade,''),'[^0-9]','','g'),'')::integer END,
    coalesce(p.xp,0)::integer,coalesce(p.season_xp,p.xp,0)::integer,coalesce(p.level,1)::integer,
    p.rank,coalesce(p.badges,ARRAY[]::text[]),coalesce(us.current_streak,0)::integer,
    CASE WHEN coalesce(a.monthly_attempts,0)>0 THEN round((a.monthly_correct::numeric/a.monthly_attempts)*100,1) ELSE 0::numeric END,
    coalesce(m.matches_played,0)::integer,coalesce(m.wins,0)::integer,
    greatest(coalesce(m.matches_played,0)-coalesce(m.wins,0),0)::integer,0::integer,
    (coalesce(a.weekly_attempts,0)*10+coalesce(a.weekly_correct,0)*5)::integer,
    (coalesce(a.monthly_attempts,0)*10+coalesce(a.monthly_correct,0)*5)::integer,
    coalesce(p.xp,0)::integer,0::integer,NULL::text
  FROM public.profiles p
  LEFT JOIN public.profile_privacy_settings privacy ON privacy.user_id = p.id
  LEFT JOIN attempt_stats a ON a.user_id=p.id
  LEFT JOIN public.user_streaks us ON us.user_id=p.id
  LEFT JOIN public.multiplayer_ranked_stats m ON m.user_id=p.id
  WHERE auth.uid() IS NOT NULL
    AND coalesce(privacy.is_public, true)
    AND NOT coalesce(privacy.hide_stats, false)
  ORDER BY coalesce(p.season_xp,p.xp,0) DESC,p.id;
$$;
REVOKE ALL ON FUNCTION public.get_student_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_leaderboard() TO authenticated;
ALTER FUNCTION public.get_student_leaderboard() SET search_path = pg_catalog;

CREATE OR REPLACE FUNCTION public.upsert_notification_device(
  p_token text,
  p_platform text DEFAULT 'android',
  p_app_version text DEFAULT NULL,
  p_enabled boolean DEFAULT true
)
RETURNS public.notification_devices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_row public.notification_devices;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_token IS NULL OR length(trim(p_token)) < 20 THEN
    RAISE EXCEPTION 'Invalid notification token';
  END IF;
  INSERT INTO public.notification_devices(user_id, token, platform, app_version, enabled, last_seen_at, updated_at)
  VALUES (auth.uid(), trim(p_token), coalesce(p_platform, 'android'), p_app_version, coalesce(p_enabled, true), now(), now())
  ON CONFLICT (token) DO UPDATE SET
    user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, app_version = EXCLUDED.app_version,
    enabled = EXCLUDED.enabled, last_seen_at = now(), updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;
ALTER FUNCTION public.upsert_notification_device(text, text, text, boolean) SET search_path = pg_catalog;

CREATE OR REPLACE FUNCTION public.disable_notification_device(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  UPDATE public.notification_devices
     SET enabled = false, updated_at = now()
   WHERE token = p_token AND user_id = auth.uid();
$function$;
ALTER FUNCTION public.disable_notification_device(text) SET search_path = pg_catalog;
