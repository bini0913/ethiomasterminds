BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(8);

SELECT ok(NOT has_function_privilege('anon', 'public.search_students_for_friend_requests(text)', 'EXECUTE'),
  'anonymous users cannot search student profiles');
SELECT ok(has_function_privilege('authenticated', 'public.search_students_for_friend_requests(text)', 'EXECUTE'),
  'authenticated users can use guarded student discovery');
SELECT ok(position('community_terms' in pg_get_functiondef('public.search_students_for_friend_requests(text)'::regprocedure)) > 0,
  'student discovery requires current community terms');
SELECT ok(position('friend_requests' in pg_get_functiondef('public.search_students_for_friend_requests(text)'::regprocedure)) > 0,
  'student discovery respects friend-request guardian controls');
SELECT ok(position('social' in pg_get_functiondef('public.search_students_for_friend_requests(text)'::regprocedure)) > 0,
  'student discovery respects social guardian controls');
SELECT ok(position('has_role_for_user(p.id' in pg_get_functiondef('public.search_students_for_friend_requests(text)'::regprocedure)) > 0,
  'search results are restricted to student accounts');
SELECT ok(position('are_users_blocked' in pg_get_functiondef('public.search_students_for_friend_requests(text)'::regprocedure)) > 0,
  'blocked accounts are excluded from student discovery');

SELECT ok(position('has_role_for_user(v_uid' in pg_get_functiondef('public.search_students_for_friend_requests(text)'::regprocedure)) > 0,
  'only student accounts can search for other students');

SELECT * FROM finish();
ROLLBACK;
