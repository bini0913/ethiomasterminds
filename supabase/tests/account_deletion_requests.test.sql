begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select ok(to_regclass('public.account_deletion_requests') is not null, 'account deletion request queue exists');
select ok((select relrowsecurity from pg_class where oid = 'public.account_deletion_requests'::regclass), 'account deletion requests have RLS enabled');
select ok(has_table_privilege('authenticated', 'public.account_deletion_requests', 'select'), 'signed-in users can request their own deletion status subject to RLS');
select ok(not has_table_privilege('authenticated', 'public.account_deletion_requests', 'insert'), 'clients cannot forge deletion requests directly');
select ok(not has_table_privilege('anon', 'public.account_deletion_requests', 'select'), 'anonymous users cannot read deletion requests');
select ok(to_regclass('public.account_deletion_request_events') is not null, 'deletion request audit events exist');
select ok((select relrowsecurity from pg_class where oid = 'public.account_deletion_request_events'::regclass), 'deletion request audit events have RLS enabled');
select ok(has_function_privilege('authenticated', 'public.request_my_account_deletion()', 'EXECUTE'), 'authenticated users can submit their own deletion request');
select ok(not has_function_privilege('anon', 'public.request_my_account_deletion()', 'EXECUTE'), 'anonymous users cannot submit in-app deletion requests');
select ok(not has_function_privilege('authenticated', 'public.delete_my_account()', 'EXECUTE'), 'unsafe direct deletion RPC is no longer executable by clients');
select ok(has_function_privilege('authenticated', 'public.extreme_admin_list_account_deletion_requests(text,integer)', 'EXECUTE'), 'signed-in users can call the role-guarded Extreme Admin queue RPC');
select ok(has_function_privilege('authenticated', 'public.extreme_admin_update_account_deletion_request(uuid,text,text)', 'EXECUTE'), 'signed-in users can call the role-guarded deletion review RPC');
select ok(has_function_privilege('authenticated', 'public.extreme_admin_create_external_deletion_request(text,text,text)', 'EXECUTE'), 'signed-in users can call the role-guarded external request logging RPC');

select * from finish();
rollback;
