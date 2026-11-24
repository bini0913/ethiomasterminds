begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select ok(to_regclass('public.user_blocks') is not null, 'user_blocks table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.user_blocks'::regclass), 'user_blocks has row-level security enabled');
select ok(has_table_privilege('authenticated', 'public.user_blocks', 'select'), 'authenticated users can read their own block list');
select ok(has_table_privilege('authenticated', 'public.user_blocks', 'insert'), 'authenticated users can create blocks');
select ok(has_table_privilege('authenticated', 'public.user_blocks', 'delete'), 'authenticated users can remove their own blocks');
select ok(not has_table_privilege('anon', 'public.user_blocks', 'select'), 'anonymous users cannot read block relationships');
select ok(not has_table_privilege('anon', 'public.user_blocks', 'insert'), 'anonymous users cannot create block relationships');
select ok(has_function_privilege('authenticated', 'public.is_blocked_with(uuid)', 'EXECUTE'), 'authenticated users can evaluate a block against themselves for RLS');
select ok(not has_function_privilege('authenticated', 'public.are_users_blocked(uuid,uuid)', 'EXECUTE'), 'authenticated users cannot probe arbitrary user pairs');
select ok(has_function_privilege('service_role', 'public.are_users_blocked(uuid,uuid)', 'EXECUTE'), 'trusted notification service can evaluate block pairs');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'messages' and policyname = 'involved users can view messages'), 'direct-message reads have a block-aware RLS policy');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'study_call_participants' and policyname = 'users invite friends to own call'), 'Study Mode call invitations have a block-aware RLS policy');

select * from finish();
rollback;
