begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select ok(has_function_privilege('authenticated','public.get_student_leaderboard()','execute'),'signed-in leaderboard RPC remains available');
select ok(not has_function_privilege('anon','public.get_student_leaderboard()','execute'),'anonymous users cannot call the leaderboard RPC');
select ok(position('profile_privacy_settings' in pg_get_functiondef('public.get_student_leaderboard()'::regprocedure)) > 0,'student leaderboard reads profile privacy settings');
select ok(position('is_public' in pg_get_functiondef('public.get_student_leaderboard()'::regprocedure)) > 0,'student leaderboard respects public-profile opt-out');
select ok(position('hide_stats' in pg_get_functiondef('public.get_student_leaderboard()'::regprocedure)) > 0,'student leaderboard respects hidden statistics');
select ok((select p.proconfig @> array['search_path=pg_catalog'] from pg_proc p where p.oid='public.get_student_leaderboard()'::regprocedure),'student leaderboard uses a pg_catalog-only search path');

select ok(has_function_privilege('authenticated','public.get_public_leaderboard(integer)','execute'),'public leaderboard remains available to signed-in users');
select ok(not has_function_privilege('anon','public.get_public_leaderboard(integer)','execute'),'anonymous users cannot call public leaderboard RPC');
select ok(position('profile_privacy_settings' in pg_get_functiondef('public.get_public_leaderboard(integer)'::regprocedure)) > 0,'public leaderboard applies profile privacy settings');
select ok(position('hide_stats' in pg_get_functiondef('public.get_public_leaderboard(integer)'::regprocedure)) > 0,'public leaderboard hides opted-out statistics');

select ok(position('profile_privacy_settings' in pg_get_functiondef('public.get_public_student_profiles(uuid[])'::regprocedure)) > 0,'public student-profile lookup applies privacy settings');
select ok(position('hide_stats' in pg_get_functiondef('public.get_public_student_profiles(uuid[])'::regprocedure)) > 0,'public student-profile lookup honors hidden statistics');

select ok(position('profile_privacy_settings' in pg_get_functiondef('public.get_early_leaderboard(text,text,text)'::regprocedure)) > 0,'early leaderboard applies profile privacy settings');

select * from finish();
rollback;
