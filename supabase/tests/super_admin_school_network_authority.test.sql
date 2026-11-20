BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

SELECT ok(EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin'), 'super_admin is a distinct application role');
SELECT ok(to_regclass('public.school_networks') IS NOT NULL, 'the school network boundary exists');
SELECT ok(EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'exactly_one_extreme_admin'), 'Extreme Admin has a database account limit');
SELECT ok(EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'exactly_one_super_admin'), 'Super Admin has a database account limit');
SELECT ok(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schools' AND column_name = 'network_id'), 'schools carry an immutable network boundary');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schools_network_id_fkey'), 'schools cannot reference an unknown network');
SELECT ok(to_regprocedure('public.super_admin_get_network_dashboard()') IS NOT NULL, 'network dashboard RPC exists');
SELECT ok(to_regprocedure('public.super_admin_list_network_schools(text,integer,integer)') IS NOT NULL, 'network directory RPC exists');
SELECT ok(to_regprocedure('public.super_admin_register_school(text,text)') IS NOT NULL, 'school registration RPC exists');
SELECT ok(to_regprocedure('public.super_admin_set_school_status(uuid,text)') IS NOT NULL, 'school status RPC exists');
SELECT ok(has_function_privilege('authenticated', 'public.super_admin_get_network_dashboard()', 'execute'), 'authenticated users can reach the guarded dashboard contract');
SELECT ok(has_function_privilege('authenticated', 'public.super_admin_register_school(text,text)', 'execute'), 'authenticated users can reach the guarded registration contract');
SELECT ok(NOT has_function_privilege('anon', 'public.super_admin_register_school(text,text)', 'execute'), 'anonymous users cannot register schools');
SELECT ok(position('_is_network_authority' IN pg_get_functiondef('public.super_admin_register_school(text,text)'::regprocedure)) > 0, 'registration is backend-authorized');
SELECT ok(position('network_id = public.school_network_id()' IN pg_get_functiondef('public.super_admin_list_network_schools(text,integer,integer)'::regprocedure)) > 0, 'directory reads are network scoped');
SELECT ok(position('admin_audit_logs' IN pg_get_functiondef('public.super_admin_register_school(text,text)'::regprocedure)) > 0, 'registration persists an audit record');
SELECT ok(position('network_id = public.school_network_id()' IN pg_get_functiondef('public.super_admin_set_school_status(uuid,text)'::regprocedure)) > 0, 'status updates reject out-of-network schools');
SELECT ok(position('super_admin' IN pg_get_functiondef('public.school_attach_account(uuid,uuid,uuid,text,text,text,integer,uuid,bigint,uuid[],uuid[],jsonb)'::regprocedure)) > 0, 'trusted Manager provisioning accepts the distinct Super Admin');

SELECT * FROM finish();
ROLLBACK;
