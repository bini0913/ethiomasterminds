BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(32);

SELECT ok(to_regprocedure('public.super_admin_list_network_people(uuid,text,text,integer,integer)') IS NOT NULL, 'network people directory RPC exists');
SELECT ok(to_regprocedure('public.super_admin_get_school_analytics(uuid)') IS NOT NULL, 'school analytics RPC exists');
SELECT ok(to_regprocedure('public.super_admin_get_network_finance()') IS NOT NULL, 'network finance RPC exists');
SELECT ok(to_regprocedure('public.super_admin_get_network_audit_logs(integer,integer)') IS NOT NULL, 'network audit RPC exists');
SELECT ok(to_regprocedure('public.super_admin_set_school_membership_status(uuid,text,text)') IS NOT NULL, 'staff membership status RPC exists');
SELECT ok(to_regprocedure('public.super_admin_get_network_settings()') IS NOT NULL, 'network settings read RPC exists');
SELECT ok(to_regprocedure('public.super_admin_update_network_name(text)') IS NOT NULL, 'network settings write RPC exists');
SELECT ok(has_function_privilege('authenticated', 'public.super_admin_list_network_people(uuid,text,text,integer,integer)', 'execute'), 'authenticated role can reach the guarded directory contract');
SELECT ok(NOT has_function_privilege('anon', 'public.super_admin_list_network_people(uuid,text,text,integer,integer)', 'execute'), 'anonymous role cannot reach the directory contract');
SELECT ok(position('_is_super_admin' IN pg_get_functiondef('public.super_admin_list_network_people(uuid,text,text,integer,integer)'::regprocedure)) > 0, 'people directory requires Super Admin');
SELECT ok(position('school_network_id' IN pg_get_functiondef('public.super_admin_list_network_people(uuid,text,text,integer,integer)'::regprocedure)) > 0, 'people directory is network scoped');
SELECT ok(position('_is_super_admin' IN pg_get_functiondef('public.super_admin_get_school_analytics(uuid)'::regprocedure)) > 0, 'analytics requires Super Admin');
SELECT ok(position('network_id = public.school_network_id()' IN pg_get_functiondef('public.super_admin_get_school_analytics(uuid)'::regprocedure)) > 0, 'analytics rejects out-of-network schools');
SELECT ok(position('network_id = public.school_network_id()' IN pg_get_functiondef('public.super_admin_get_network_finance()'::regprocedure)) > 0, 'finance rollup is network scoped');
SELECT ok(position('admin_audit_logs' IN pg_get_functiondef('public.super_admin_set_school_membership_status(uuid,text,text)'::regprocedure)) > 0, 'staff status changes persist audit records');
SELECT ok(position('school_role NOT IN' IN pg_get_functiondef('public.super_admin_set_school_membership_status(uuid,text,text)'::regprocedure)) > 0, 'staff status mutation rejects non-staff memberships');
SELECT ok(position('network_key = true' IN pg_get_functiondef('public.super_admin_get_network_settings()'::regprocedure)) > 0, 'settings read is limited to the singleton network');
SELECT ok(position('admin_audit_logs' IN pg_get_functiondef('public.super_admin_update_network_name(text)'::regprocedure)) > 0, 'settings mutation persists audit records');
SELECT ok(position('currency_totals' IN pg_get_functiondef('public.super_admin_get_network_finance()'::regprocedure)) > 0, 'network finance returns currency-separated totals');
SELECT ok(position('outstanding_by_currency' IN pg_get_functiondef('public.super_admin_get_school_analytics(uuid)'::regprocedure)) > 0, 'school analytics returns currency-separated outstanding balances');



SELECT ok(position('recent_invoices' IN pg_get_functiondef('public.super_admin_get_network_finance()'::regprocedure)) > 0, 'network finance exposes recent invoice detail');
SELECT ok(position('recent_payments' IN pg_get_functiondef('public.super_admin_get_network_finance()'::regprocedure)) > 0, 'network finance exposes recent payment detail');
SELECT ok(position('pending_followup_records' IN pg_get_functiondef('public.super_admin_get_network_finance()'::regprocedure)) > 0, 'network finance exposes pending follow-up records');
SELECT ok(position('overdue_by_currency' IN pg_get_functiondef('public.super_admin_get_network_finance()'::regprocedure)) > 0, 'overdue balances remain currency-separated');
SELECT ok(position('school_behavior_reports' IN pg_get_functiondef('public.super_admin_get_network_alerts()'::regprocedure)) > 0, 'network alerts include pending behavior review counts');
SELECT ok(position('no active Manager' IN pg_get_functiondef('public.super_admin_get_network_alerts()'::regprocedure)) > 0, 'network alerts identify schools without active Managers');


SELECT ok(to_regprocedure('public.super_admin_attach_existing_account(uuid,uuid,text,text,text,uuid[])') IS NOT NULL, 'network-scoped existing-account assignment RPC exists');
SELECT ok(position('_is_super_admin' IN pg_get_functiondef('public.super_admin_attach_existing_account(uuid,uuid,text,text,text,uuid[])'::regprocedure)) > 0, 'existing-account assignment requires Super Admin');
SELECT ok(position('school_network_id' IN pg_get_functiondef('public.super_admin_attach_existing_account(uuid,uuid,text,text,text,uuid[])'::regprocedure)) > 0, 'existing-account assignment is restricted to the current network');
SELECT ok(position('admin_audit_logs' IN pg_get_functiondef('public.super_admin_attach_existing_account(uuid,uuid,text,text,text,uuid[])'::regprocedure)) > 0, 'existing-account assignments create an audit event');


SELECT ok(NOT has_function_privilege('anon', 'public.super_admin_attach_existing_account(uuid,uuid,text,text,text,uuid[])', 'execute'), 'anonymous role cannot assign existing school accounts');
SELECT ok(position('Only active accounts' IN pg_get_functiondef('public.super_admin_attach_existing_account(uuid,uuid,text,text,text,uuid[])'::regprocedure)) > 0, 'existing-account assignment rejects inactive global accounts');

SELECT * FROM finish();
ROLLBACK;
