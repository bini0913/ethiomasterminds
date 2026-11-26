-- Honor profile visibility and stats privacy in server-side leaderboard projections.
-- The old RPCs bypassed profile RLS and ignored is_public/hide_stats.
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
SET search_path = pg_catalog, public
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

CREATE OR REPLACE FUNCTION public.get_public_leaderboard(_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, name text, username text, xp integer, level integer, avatar text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.id,p.name,p.username,p.xp,p.level,p.avatar
  FROM public.profiles p
  LEFT JOIN public.profile_privacy_settings privacy ON privacy.user_id=p.id
  WHERE auth.uid() IS NOT NULL
    AND coalesce(privacy.is_public,true)
    AND NOT coalesce(privacy.hide_stats,false)
  ORDER BY p.xp DESC NULLS LAST,p.created_at ASC
  LIMIT greatest(1,least(coalesce(_limit,50),100));
$$;

CREATE OR REPLACE FUNCTION public.get_public_student_profiles(p_user_ids uuid[])
RETURNS TABLE(id uuid,name text,username text,avatar text,level integer,xp integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT p.id,p.name,p.username,p.avatar,p.level,p.xp
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id=p.id AND ur.role='student'
  LEFT JOIN public.profile_privacy_settings privacy ON privacy.user_id=p.id
  WHERE auth.uid() IS NOT NULL
    AND p.id=ANY(coalesce(p_user_ids,'{}'::uuid[]))
    AND coalesce(privacy.is_public,true)
    AND NOT coalesce(privacy.hide_stats,false);
$$;

CREATE OR REPLACE FUNCTION public.get_early_leaderboard(
  p_scope text DEFAULT 'grade',
  p_period text DEFAULT 'all',
  p_category text DEFAULT 'overall'
)
RETURNS TABLE(username text,avatar text,level integer,score integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(nullif(p.username,''),'Learner') AS username,
    coalesce(p.avatar,'avatar-1') AS avatar,
    coalesce(p.level,1) AS level,
    CASE WHEN p_category='discover'
      THEN coalesce((SELECT count(*) FROM public.early_item_exposure e WHERE e.user_id=p.id),0)
      ELSE coalesce(p.season_xp,p.xp,0) END AS score
  FROM public.profiles p
  LEFT JOIN public.profile_privacy_settings privacy ON privacy.user_id=p.id
  WHERE auth.uid() IS NOT NULL
    AND (lower(coalesce(p.education_level,'')) IN ('early','kg','kindergarten')
      OR p.grade ~* '^(k|kg|kindergarten|grade[ ]?[0-4]|[0-4])$')
    AND coalesce(privacy.is_public,true)
    AND NOT coalesce(privacy.hide_stats,false)
  ORDER BY score DESC,username ASC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.get_student_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_leaderboard() TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_leaderboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_leaderboard(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.get_public_student_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_student_profiles(uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.get_early_leaderboard(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_early_leaderboard(text,text,text) TO authenticated;

-- The privacy migration replaces the function; re-apply the hardened path afterward.
ALTER FUNCTION public.get_student_leaderboard() SET search_path = pg_catalog;
