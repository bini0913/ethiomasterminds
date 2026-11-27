BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(10);

SELECT ok(
  to_regprocedure('public.extreme_admin_get_executive_metrics()') IS NOT NULL,
  'the executive metrics RPC exists'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.extreme_admin_get_executive_metrics()'::regprocedure),
  'executive metrics execute with a controlled SECURITY DEFINER context'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.extreme_admin_get_executive_metrics()', 'EXECUTE'),
  'anonymous users cannot execute executive metrics'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.extreme_admin_get_executive_metrics()', 'EXECUTE'),
  'authenticated callers can reach the RPC and are checked by its owner guard'
);

SELECT ok(
  position('_is_extreme_admin()' in pg_get_functiondef('public.extreme_admin_get_executive_metrics()'::regprocedure)) > 0,
  'executive metrics independently require Extreme Admin authority'
);

SELECT ok(
  position('user_presence' in pg_get_functiondef('public.extreme_admin_get_executive_metrics()'::regprocedure)) > 0
  AND position('daily_active_users' in pg_get_functiondef('public.extreme_admin_get_executive_metrics()'::regprocedure)) > 0,
  'activity metrics are based on recorded presence rather than registration totals'
);

SELECT ok(
  position('active_accounts' in pg_get_functiondef('public.extreme_admin_get_executive_metrics()'::regprocedure)) > 0
  AND position('user_account_controls' in pg_get_functiondef('public.extreme_admin_get_executive_metrics()'::regprocedure)) > 0,
  'active-account metrics respect the existing canonical account controls'
);

SELECT ok(
  to_regprocedure('public.extreme_admin_set_user_status(uuid,text,text)') IS NOT NULL,
  'the protected account status RPC exists with an audit reason'
);

SELECT ok(
  position('user_account_controls' in pg_get_functiondef('public.extreme_admin_set_user_status(uuid,text,text)'::regprocedure)) > 0
  AND position('profiles' in pg_get_functiondef('public.extreme_admin_set_user_status(uuid,text,text)'::regprocedure)) > 0,
  'account status changes synchronize canonical controls and profile-facing status'
);

SELECT ok(
  position('Revoke Super Admin authority before suspending or banning' in pg_get_functiondef('public.extreme_admin_set_user_status(uuid,text,text)'::regprocedure)) > 0
  AND position('extreme_admin_log' in pg_get_functiondef('public.extreme_admin_set_user_status(uuid,text,text)'::regprocedure)) > 0,
  'top-level authority protection and legacy audit history remain enforced'
);

SELECT * FROM finish();
ROLLBACK;
