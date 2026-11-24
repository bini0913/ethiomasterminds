begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select ok(to_regclass('public.user_policy_acceptances') is not null, 'versioned policy acceptance table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.user_policy_acceptances'::regclass), 'policy acceptance table has RLS enabled');
select ok(has_table_privilege('authenticated', 'public.user_policy_acceptances', 'select'), 'users can read their own acceptance records');
select ok(has_table_privilege('authenticated', 'public.user_policy_acceptances', 'insert'), 'users can record their own acceptance');
select ok(not has_table_privilege('authenticated', 'public.user_policy_acceptances', 'update'), 'acceptance records cannot be edited');
select ok(not has_table_privilege('authenticated', 'public.user_policy_acceptances', 'delete'), 'acceptance records cannot be removed by clients');
select ok(not has_table_privilege('anon', 'public.user_policy_acceptances', 'select'), 'anonymous users cannot read acceptance records');
select ok(has_function_privilege('authenticated', 'public.has_accepted_policy(text,text)', 'EXECUTE'), 'authenticated workflows can check the current user's acceptance');
select ok(not has_function_privilege('anon', 'public.has_accepted_policy(text,text)', 'EXECUTE'), 'anonymous users cannot check policy acceptance');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'social_posts' and policyname = 'authenticated can create post' and with_check ilike '%has_accepted_policy%'), 'social post creation requires the accepted policy version');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_policy_acceptances' and policyname = 'Users can record their own policy acceptances' and with_check ilike '%2026-11-24%' and with_check ilike '%community_terms%'), 'clients can only record acceptance for the published community terms version');

select * from finish();
rollback;
