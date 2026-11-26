-- Apply the same profile privacy contract to the multiplayer ranked leaderboard.
-- The RPC is SECURITY DEFINER, so it must explicitly honor privacy settings
-- rather than relying on profiles RLS.
CREATE OR REPLACE FUNCTION public.multiplayer_ranked_leaderboard(p_limit integer DEFAULT 100)
RETURNS TABLE (
  user_id uuid,
  player_name text,
  total_points bigint,
  matches_played integer,
  wins integer,
  podiums integer,
  rank_position bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
  SELECT
    s.user_id,
    coalesce(p.name, p.username, 'Player') AS player_name,
    s.total_points,
    s.matches_played,
    s.wins,
    s.podiums,
    row_number() OVER (
      ORDER BY s.total_points DESC, s.wins DESC, s.updated_at ASC
    ) AS rank_position
  FROM public.multiplayer_ranked_stats s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN public.profile_privacy_settings privacy ON privacy.user_id = p.id
  WHERE auth.uid() IS NOT NULL
    AND coalesce(privacy.is_public, true)
    AND NOT coalesce(privacy.hide_stats, false)
  ORDER BY s.total_points DESC, s.wins DESC, s.updated_at ASC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 100));
$$;

REVOKE ALL ON FUNCTION public.multiplayer_ranked_leaderboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.multiplayer_ranked_leaderboard(integer) TO authenticated;
