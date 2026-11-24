begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select ok(to_regclass('public.reports') is not null, 'UGC reports table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.reports'::regclass), 'UGC reports have RLS enabled');
select ok(exists (
  select 1 from pg_trigger
  where tgrelid = 'public.reports'::regclass
    and tgname = 'enforce_report_submission_guard'
    and not tgisinternal
), 'report submission validation trigger exists');
select ok(to_regclass('public.reports_one_pending_per_reporter_item') is not null, 'duplicate pending reports are prevented by a unique index');
select ok(to_regprocedure('public.moderation_get_report_context(uuid[])') is not null, 'moderators can request report context through the guarded function');
select ok(to_regprocedure('public.moderate_user_report(uuid,text,text)') is not null, 'moderators can apply audited moderation actions');
select ok(not has_function_privilege('authenticated', 'public.enforce_report_submission()', 'EXECUTE'), 'clients cannot invoke the report validation trigger function directly');

select * from finish();
rollback;
