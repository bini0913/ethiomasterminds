BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

SELECT ok(NOT has_table_privilege('anon','public.admin_audit_logs','SELECT'),'anon cannot directly read admin audit logs');
SELECT ok(NOT has_table_privilege('authenticated','public.admin_audit_logs','SELECT'),'authenticated clients cannot directly read admin audit logs');
SELECT ok(NOT has_table_privilege('anon','public.edge_request_rate_limits','SELECT'),'anon cannot directly read internal rate limits');
SELECT ok(NOT has_table_privilege('authenticated','public.edge_request_rate_limits','SELECT'),'authenticated clients cannot directly read internal rate limits');
SELECT ok(NOT has_table_privilege('anon','public.platform_settings','SELECT'),'anon cannot directly read platform settings');
SELECT ok(NOT has_table_privilege('authenticated','public.platform_settings','SELECT'),'authenticated clients cannot directly read platform settings');
SELECT ok(has_table_privilege('service_role','public.admin_audit_logs','SELECT'),'service role retains audit-log access');
SELECT ok(has_table_privilege('service_role','public.edge_request_rate_limits','SELECT'),'service role retains rate-limit access');
SELECT ok(has_table_privilege('service_role','public.platform_settings','SELECT'),'service role retains platform-settings access');

SELECT * FROM finish();
ROLLBACK;
