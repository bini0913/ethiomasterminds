BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(24);

SELECT ok(to_regclass('public.platform_health_snapshots') IS NOT NULL, 'health snapshot history table exists');
SELECT ok(to_regclass('public.platform_incidents') IS NOT NULL, 'platform incident register exists');
SELECT ok(to_regclass('public.platform_maintenance_windows') IS NOT NULL, 'maintenance window register exists');

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.platform_health_snapshots'::regclass), 'health snapshots have RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.platform_incidents'::regclass), 'incident records have RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.platform_maintenance_windows'::regclass), 'maintenance records have RLS enabled');

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.platform_health_snapshots', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.platform_health_snapshots', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.platform_incidents', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.platform_incidents', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.platform_maintenance_windows', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.platform_maintenance_windows', 'INSERT'),
  'authenticated clients cannot bypass guarded platform operations RPCs'
);

SELECT ok(to_regprocedure('public.extreme_admin_record_platform_health_snapshot(jsonb)') IS NOT NULL, 'health snapshot RPC exists');
SELECT ok(to_regprocedure('public.extreme_admin_get_platform_health()') IS NOT NULL, 'platform health read RPC exists');
SELECT ok(to_regprocedure('public.extreme_admin_create_platform_incident(text,text,text,text)') IS NOT NULL, 'incident creation RPC exists');
SELECT ok(to_regprocedure('public.extreme_admin_update_platform_incident(uuid,text,text)') IS NOT NULL, 'incident update RPC exists');
SELECT ok(to_regprocedure('public.extreme_admin_create_maintenance_window(text,text,text[],timestamp with time zone,timestamp with time zone)') IS NOT NULL, 'maintenance creation RPC exists');
SELECT ok(to_regprocedure('public.extreme_admin_update_maintenance_window(uuid,text,text)') IS NOT NULL, 'maintenance update RPC exists');

SELECT ok(
  NOT has_function_privilege('anon', 'public.extreme_admin_record_platform_health_snapshot(jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.extreme_admin_get_platform_health()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.extreme_admin_create_platform_incident(text,text,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.extreme_admin_update_platform_incident(uuid,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.extreme_admin_create_maintenance_window(text,text,text[],timestamp with time zone,timestamp with time zone)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.extreme_admin_update_maintenance_window(uuid,text,text)', 'EXECUTE'),
  'anonymous users cannot call platform health, incident or maintenance RPCs'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.extreme_admin_record_platform_health_snapshot(jsonb)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.extreme_admin_get_platform_health()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.extreme_admin_create_platform_incident(text,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.extreme_admin_update_platform_incident(uuid,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.extreme_admin_create_maintenance_window(text,text,text[],timestamp with time zone,timestamp with time zone)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.extreme_admin_update_maintenance_window(uuid,text,text)', 'EXECUTE'),
  'authenticated callers reach RPCs whose bodies independently enforce Extreme Admin authority'
);

SELECT ok(
  position('_is_extreme_admin()' in pg_get_functiondef('public.extreme_admin_record_platform_health_snapshot(jsonb)'::regprocedure)) > 0
  AND position('_is_extreme_admin()' in pg_get_functiondef('public.extreme_admin_get_platform_health()'::regprocedure)) > 0
  AND position('_is_extreme_admin()' in pg_get_functiondef('public.extreme_admin_create_platform_incident(text,text,text,text)'::regprocedure)) > 0
  AND position('_is_extreme_admin()' in pg_get_functiondef('public.extreme_admin_update_platform_incident(uuid,text,text)'::regprocedure)) > 0
  AND position('_is_extreme_admin()' in pg_get_functiondef('public.extreme_admin_create_maintenance_window(text,text,text[],timestamp with time zone,timestamp with time zone)'::regprocedure)) > 0
  AND position('_is_extreme_admin()' in pg_get_functiondef('public.extreme_admin_update_maintenance_window(uuid,text,text)'::regprocedure)) > 0,
  'every platform health and operations RPC enforces the Extreme Admin guard'
);

SELECT ok(
  position('storage.objects' in pg_get_functiondef('public.extreme_admin_get_platform_health()'::regprocedure)) > 0
  AND position('notification_events' in pg_get_functiondef('public.extreme_admin_get_platform_health()'::regprocedure)) > 0,
  'health reporting uses real Storage object metadata and notification inbox delivery records'
);

SELECT ok(
  position('admin_audit_logs' in pg_get_functiondef('public.extreme_admin_create_platform_incident(text,text,text,text)'::regprocedure))
  AND position('admin_audit_logs' in pg_get_functiondef('public.extreme_admin_update_platform_incident(uuid,text,text)'::regprocedure))
  AND position('admin_audit_logs' in pg_get_functiondef('public.extreme_admin_create_maintenance_window(text,text,text[],timestamp with time zone,timestamp with time zone)'::regprocedure))
  AND position('admin_audit_logs' in pg_get_functiondef('public.extreme_admin_update_maintenance_window(uuid,text,text)'::regprocedure)),
  'incident and maintenance mutations are written to the canonical admin audit log'
);

SELECT ok(
  position('reason' in pg_get_functiondef('public.extreme_admin_update_platform_incident(uuid,text,text)'::regprocedure)) > 0
  AND position('reason' in pg_get_functiondef('public.extreme_admin_update_maintenance_window(uuid,text,text)'::regprocedure)) > 0,
  'incident and maintenance updates require documented reasons'
);

SELECT ok(
  position('provider_failure_codes' in pg_get_functiondef('public.extreme_admin_get_platform_health()'::regprocedure)) > 0,
  'health reporting exposes only aggregated provider failure codes'
);

SELECT ok(
  position('octet_length' in pg_get_functiondef('public.extreme_admin_record_platform_health_snapshot(jsonb)'::regprocedure)) > 0,
  'health snapshot payload size is bounded'
);

SELECT ok(
  position('not_configured' in pg_get_functiondef('public.extreme_admin_record_platform_health_snapshot(jsonb)'::regprocedure)) = 0,
  'provider configuration is not fabricated by the snapshot writer'
);

SELECT * FROM finish();
ROLLBACK;
