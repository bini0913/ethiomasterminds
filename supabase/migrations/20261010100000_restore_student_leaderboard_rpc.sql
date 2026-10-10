-- Restore the RPC consumed by src/lib/leaderboardApi.ts. Without this function,
-- the client falls back to profile SELECT policies and can see only its own row.
CREATE OR REPLACE FUNCTION public.get_student_leaderboard()
RETURNS TABLE (
 id uuid, name text, username text, avatar text, avatar_config jsonb, grade integer,
 xp integer, season_xp integer, level integer, rank text, badges text[], streak integer,
 accuracy numeric, matches_played integer, wins integer, losses integer, contributions integer,
 weekly_score integer, monthly_score integer, total_xp integer, coins integer, active_title text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 WITH attempt_stats AS (
  SELECT qa.user_id,
   count(*) FILTER (WHERE qa.created_at >= now()-interval '7 days')::integer weekly_attempts,
   count(*) FILTER (WHERE qa.created_at >= now()-interval '7 days' AND qa.is_correct)::integer weekly_correct,
   count(*) FILTER (WHERE qa.created_at >= now()-interval '30 days')::integer monthly_attempts,
   count(*) FILTER (WHERE qa.created_at >= now()-interval '30 days' AND qa.is_correct)::integer monthly_correct
  FROM public.question_attempts qa WHERE qa.created_at >= now()-interval '30 days' GROUP BY qa.user_id
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
 LEFT JOIN attempt_stats a ON a.user_id=p.id
 LEFT JOIN public.user_streaks us ON us.user_id=p.id
 LEFT JOIN public.multiplayer_ranked_stats m ON m.user_id=p.id
 WHERE auth.uid() IS NOT NULL
 ORDER BY coalesce(p.season_xp,p.xp,0) DESC,p.id;
$$;
REVOKE ALL ON FUNCTION public.get_student_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_leaderboard() TO authenticated;
