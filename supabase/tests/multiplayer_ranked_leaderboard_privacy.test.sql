BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(7);

SELECT ok(
  has_function_privilege('authenticated','public.multiplayer_ranked_leaderboard(integer)','execute'),
  'authenticated users can still load the ranked multiplayer leaderboard'
);
SELECT ok(
  NOT has_function_privilege('anon','public.multiplayer_ranked_leaderboard(integer)','execute'),
  'anonymous users cannot load the ranked multiplayer leaderboard'
);
SELECT ok(
  position('profile_privacy_settings' IN pg_get_functiondef('public.multiplayer_ranked_leaderboard(integer)'::regprocedure)) > 0,
  'ranked multiplayer leaderboard reads profile privacy settings'
);
SELECT ok(
  position('is_public' IN pg_get_functiondef('public.multiplayer_ranked_leaderboard(integer)'::regprocedure)) > 0,
  'ranked multiplayer leaderboard respects public-profile opt-out'
);
SELECT ok(
  position('hide_stats' IN pg_get_functiondef('public.multiplayer_ranked_leaderboard(integer)'::regprocedure)) > 0,
  'ranked multiplayer leaderboard respects hidden statistics'
);
SELECT ok(
  position('auth.uid() IS NOT NULL' IN pg_get_functiondef('public.multiplayer_ranked_leaderboard(integer)'::regprocedure)) > 0,
  'ranked multiplayer leaderboard requires a signed-in caller'
);
SELECT ok(
  (SELECT proconfig @> ARRAY['search_path=pg_catalog, auth']
   FROM pg_proc WHERE oid='public.multiplayer_ranked_leaderboard(integer)'::regprocedure),
  'ranked multiplayer leaderboard uses a restricted search path'
);

SELECT * FROM finish();
ROLLBACK;
