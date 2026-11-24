begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

select ok((select relrowsecurity from pg_class where oid='public.account_deletion_requests'::regclass), 'account deletion requests have RLS enabled');
select ok(has_table_privilege('authenticated','public.account_deletion_requests','select'), 'users can read their own request records');
select ok(not has_table_privilege('anon','public.account_deletion_requests','select'), 'anonymous users cannot read deletion requests');
select ok(not has_table_privilege('authenticated','public.account_deletion_requests','insert'), 'users cannot forge deletion requests directly');
select ok(not exists (select 1 from pg_constraint where conrelid='public.account_deletion_requests'::regclass and confrelid='auth.users'::regclass), 'deletion request audit survives removal of the auth user');
select ok(has_function_privilege('authenticated','public.request_my_account_deletion()','execute'), 'authenticated users can request account deletion');
select ok(not has_function_privilege('anon','public.request_my_account_deletion()','execute'), 'anonymous users cannot request deletion for an account');
select ok(has_function_privilege('authenticated','public.get_my_account_deletion_request()','execute'), 'users can check their own request status');
select ok(has_function_privilege('authenticated','public.cancel_my_account_deletion_request()','execute'), 'users can cancel a request before approval');
select ok(has_function_privilege('authenticated','public.admin_list_account_deletion_requests(integer)','execute'), 'moderators can list deletion requests through a guarded function');
select ok(not has_function_privilege('anon','public.admin_list_account_deletion_requests(integer)','execute'), 'anonymous users cannot list deletion requests');
select ok(has_function_privilege('authenticated','public.admin_review_account_deletion_request(uuid,text,text)','execute'), 'moderators can review deletion requests through a guarded function');
select ok(has_function_privilege('authenticated','public.admin_complete_account_deletion_request(uuid)','execute'), 'moderators can complete approved deletion requests through a guarded function');
select ok(not has_function_privilege('anon','public.admin_complete_account_deletion_request(uuid)','execute'), 'anonymous users cannot complete deletion requests');
select ok(not has_function_privilege('authenticated','app_private.account_deletion_blockers(uuid)','execute'), 'clients cannot inspect arbitrary account deletion dependencies');
select ok(not has_function_privilege('authenticated','app_private.delete_account_data(uuid)','execute'), 'clients cannot invoke the internal account deletion worker');
select ok(
  pg_get_functiondef('public.delete_my_account()'::regprocedure) ilike '%request_my_account_deletion%'
  and pg_get_functiondef('public.delete_my_account()'::regprocedure) not ilike '%delete from auth.users%'
  and pg_get_functiondef('public.delete_my_account()'::regprocedure) not ilike '%delete from public.finance_invoices%',
  'legacy delete RPC now queues a request and does not directly delete auth users or finance invoices'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='reporter_anonymized')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='moderation_actions' and column_name='actor_anonymized'),
  'report and moderation audit records support anonymization'
);

select * from finish();
rollback;
