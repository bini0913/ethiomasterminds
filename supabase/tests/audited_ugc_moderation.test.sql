begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select ok(to_regclass('public.moderation_actions') is not null, 'moderation audit table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.moderation_actions'::regclass), 'moderation audit table has RLS enabled');
select ok(has_table_privilege('authenticated', 'public.moderation_actions', 'select'), 'authenticated role can request moderation audit reads subject to RLS');
select ok(not has_table_privilege('authenticated', 'public.moderation_actions', 'insert'), 'clients cannot forge moderation audit entries');
select ok(not has_table_privilege('anon', 'public.moderation_actions', 'select'), 'anonymous users cannot read moderation audit records');
select ok(not has_table_privilege('authenticated', 'public.reports', 'update'), 'clients cannot bypass audited report review');
select ok(has_function_privilege('authenticated', 'public.moderate_user_report(uuid,text,text)', 'EXECUTE'), 'signed-in moderators can invoke the role-guarded moderation RPC');
select ok(not has_function_privilege('anon', 'public.moderate_user_report(uuid,text,text)', 'EXECUTE'), 'anonymous users cannot invoke moderation actions');
select ok(has_function_privilege('authenticated', 'public.moderation_get_report_context(uuid[])', 'EXECUTE'), 'signed-in moderators can request scoped report context');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'), 'profile account-status updates are available through realtime');

select ok(to_regclass('public.moderation_content_archive') is not null, 'reported content evidence archive exists');
select ok((select relrowsecurity from pg_class where oid = 'public.moderation_content_archive'::regclass), 'moderation evidence archive has RLS enabled');
select ok(has_table_privilege('authenticated', 'public.moderation_content_archive', 'select'), 'authenticated moderator reads are subject to archive RLS');
select ok(not has_table_privilege('authenticated', 'public.moderation_content_archive', 'insert'), 'clients cannot forge archived moderation evidence');
select ok(not has_table_privilege('anon', 'public.moderation_content_archive', 'select'), 'anonymous users cannot read archived moderation evidence');
select ok(position('v_target_has_non_student_role' in pg_get_functiondef('public.moderate_user_report(uuid,text,text)'::regprocedure)) > 0, 'moderation RPC enforces non-student target role boundaries');

select * from finish();
rollback;
