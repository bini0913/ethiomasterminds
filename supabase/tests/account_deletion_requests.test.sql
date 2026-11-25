begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

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

select ok(to_regclass('deletion_private.external_deletion_request_rate_limits') is not null, 'external deletion rate-limit storage exists in a private schema');
select ok((select relrowsecurity from pg_class where oid = 'deletion_private.external_deletion_request_rate_limits'::regclass), 'external deletion rate-limit storage has RLS enabled');
select ok(not has_schema_privilege('anon', 'deletion_private', 'USAGE') and not has_schema_privilege('authenticated', 'deletion_private', 'USAGE'), 'client roles cannot access the dedicated deletion rate-limit schema');
select ok(not has_table_privilege('anon', 'deletion_private.external_deletion_request_rate_limits', 'select'), 'anonymous clients cannot read rate-limit keys');
select ok(not has_table_privilege('authenticated', 'deletion_private.external_deletion_request_rate_limits', 'select'), 'authenticated clients cannot read rate-limit keys');
select ok(has_function_privilege('service_role', 'public.consume_external_deletion_rate_limit(text,text,integer,integer)', 'EXECUTE'), 'service role can consume external deletion rate limits');
select ok(not has_function_privilege('anon', 'public.consume_external_deletion_rate_limit(text,text,integer,integer)', 'EXECUTE'), 'anonymous clients cannot call the rate limiter');
select ok(has_function_privilege('service_role', 'public.submit_external_deletion_request(text,text,text)', 'EXECUTE'), 'service role can submit external deletion requests');
select ok(not has_function_privilege('anon', 'public.submit_external_deletion_request(text,text,text)', 'EXECUTE'), 'anonymous clients cannot call the privileged intake RPC directly');
select ok(not has_function_privilege('authenticated', 'public.submit_external_deletion_request(text,text,text)', 'EXECUTE'), 'authenticated clients cannot forge external web requests');
select ok((select pg_get_constraintdef(oid) like '%external_web%' from pg_constraint where conrelid = 'public.account_deletion_requests'::regclass and conname = 'account_deletion_requests_source_check'), 'request source constraint permits external web intake');
select ok(position('A resolution note is required' in pg_get_functiondef('public.extreme_admin_update_account_deletion_request(uuid,text,text)'::regprocedure)) > 0, 'deletion requests require a resolution note before completion');

select ok(exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'account_deletion_requests' and column_name = 'previous_account_status'), 'deletion requests retain the pre-request account status');
select ok(exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'account_deletion_requests' and column_name = 'suspension_applied_by_request'), 'deletion requests record whether they caused the suspension');
select ok(position('v_account_status = ''active''' in pg_get_functiondef('public.request_my_account_deletion()'::regprocedure)) > 0, 'in-app deletion requests only suspend accounts that were active');
select ok(position('suspension_applied_by_request' in pg_get_functiondef('public.extreme_admin_update_account_deletion_request(uuid,text,text)'::regprocedure)) > 0, 'rejection rollback is limited to suspensions applied by the deletion request');
select ok(position('and account_status = ''suspended''' in pg_get_functiondef('public.extreme_admin_update_account_deletion_request(uuid,text,text)'::regprocedure)) > 0, 'rejection rollback preserves a later moderation status change');
select ok(position('A verification note is required' in pg_get_functiondef('public.extreme_admin_update_account_deletion_request(uuid,text,text)'::regprocedure)) > 0, 'deletion review transitions require an auditable verification or resolution note');
select ok(position('A closed deletion request cannot be changed' in pg_get_functiondef('public.extreme_admin_update_account_deletion_request(uuid,text,text)'::regprocedure)) > 0, 'completed or rejected deletion requests cannot be reopened or overwritten');

select * from finish();
rollback;
