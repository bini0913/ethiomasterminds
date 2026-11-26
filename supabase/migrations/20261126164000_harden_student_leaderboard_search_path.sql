-- Keep the server-side student leaderboard on a pg_catalog-only search path.
-- All application schemas are explicitly qualified in the function body.
ALTER FUNCTION public.get_student_leaderboard() SET search_path = pg_catalog;
