-- Public, read-only leaderboard projection. SECURITY DEFINER is required because
-- profile/attempt/streak RLS intentionally limits direct reads to the current user.
CREATE OR REPLACE FUNCTION public.get_student_leaderboard()
RETURNS TABLE (
  id uuid,
  name text,
  username text,
  avatar text,
  avatar_config jsonb,
  grade integer,
  xp integer,
  season_xp integer,
  level integer,
  rank text,
  badges text[],
  streak integer,
  accuracy numeric,
  matches_played integer,
  wins integer,
  losses integer,
  contributions integer,
  weekly_score integer,
  monthly_score integer,
  total_xp integer,
  coins integer,
  active_title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH attempt_stats AS (
    SELECT
      qa.user_id,
      count(*) FILTER (WHERE qa.created_at >= now() - interval '7 days')::integer AS weekly_attempts,
      count(*) FILTER (WHERE qa.created_at >= now() - interval '7 days' AND qa.is_correct)::integer AS weekly_correct,
      count(*) FILTER (WHERE qa.created_at >= now() - interval '30 days')::integer AS monthly_attempts,
      count(*) FILTER (WHERE qa.created_at >= now() - interval '30 days' AND qa.is_correct)::integer AS monthly_correct
    FROM public.question_attempts qa
    WHERE qa.created_at >= now() - interval '30 days'
    GROUP BY qa.user_id
  )
  SELECT
    p.id,
    coalesce(nullif(trim(p.name), ''), nullif(trim(p.username), ''), 'Learner')::text AS name,
    coalesce(nullif(trim(p.username), ''), nullif(trim(p.name), ''), 'learner')::text AS username,
    p.avatar,
    p.avatar_config,
    nullif(regexp_replace(coalesce(p.grade, ''), '[^0-9]', '', 'g'), '')::integer AS grade,
    coalesce(p.xp, 0)::integer AS xp,
    coalesce(p.season_xp, p.xp, 0)::integer AS season_xp,
    coalesce(p.level, 1)::integer AS level,
    p.rank,
    coalesce(p.badges, ARRAY[]::text[]) AS badges,
    coalesce(us.current_streak, 0)::integer AS streak,
    CASE WHEN coalesce(a.monthly_attempts, 0) > 0
      THEN round((a.monthly_correct::numeric / a.monthly_attempts) * 100, 1)
      ELSE 0::numeric
    END AS accuracy,
    coalesce(mrs.matches_played, 0)::integer AS matches_played,
    coalesce(mrs.wins, 0)::integer AS wins,
    greatest(coalesce(mrs.matches_played, 0) - coalesce(mrs.wins, 0), 0)::integer AS losses,
    0::integer AS contributions,
    (coalesce(a.weekly_attempts, 0) * 10 + coalesce(a.weekly_correct, 0) * 5)::integer AS weekly_score,
    (coalesce(a.monthly_attempts, 0) * 10 + coalesce(a.monthly_correct, 0) * 5)::integer AS monthly_score,
    coalesce(p.xp, 0)::integer AS total_xp,
    0::integer AS coins,
    NULL::text AS active_title
  FROM public.profiles p
  LEFT JOIN attempt_stats a ON a.user_id = p.id
  LEFT JOIN public.user_streaks us ON us.user_id = p.id
  LEFT JOIN public.multiplayer_ranked_stats mrs ON mrs.user_id = p.id
  WHERE auth.uid() IS NOT NULL
  ORDER BY coalesce(p.season_xp, p.xp, 0) DESC, p.id;
$$;

REVOKE ALL ON FUNCTION public.get_student_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_leaderboard() TO authenticated;
COMMENT ON FUNCTION public.get_student_leaderboard() IS
  'Returns only public leaderboard fields and aggregate activity for authenticated users; does not expose private profile fields or raw attempts.';
