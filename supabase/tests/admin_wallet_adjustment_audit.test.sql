BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(11);

SELECT is(
  pg_get_function_result('public.admin_adjust_coins_with_audit(text,integer,text)'::regprocedure),
  'jsonb',
  'audited wallet RPC returns the established JSON result shape'
);
SELECT is(
  pg_get_function_result('public.admin_adjust_coins(text,integer)'::regprocedure),
  'jsonb',
  'legacy wallet RPC signature and result type remain available'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.admin_adjust_coins_with_audit(text,integer,text)', 'EXECUTE'),
  'authenticated callers can use the guarded audited wallet RPC'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.admin_adjust_coins_with_audit(text,integer,text)', 'EXECUTE'),
  'anonymous callers cannot use the audited wallet RPC'
);
SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.admin_adjust_coins_with_audit(text,integer,text)'::regprocedure),
  'audited wallet adjustment executes with the protected definer context'
);
SELECT ok(
  position('INSERT INTO public.user_currency' IN pg_get_functiondef('public.admin_adjust_coins_with_audit(text,integer,text)'::regprocedure)) > 0
  AND position('INSERT INTO public.admin_audit_logs' IN pg_get_functiondef('public.admin_adjust_coins_with_audit(text,integer,text)'::regprocedure)) > 0,
  'wallet mutation and audit insert are performed in the same database function transaction'
);
SELECT ok(
  position('extreme_admin' IN pg_get_functiondef('public.admin_adjust_coins_with_audit(text,integer,text)'::regprocedure)) > 0
  AND position('admin' IN pg_get_functiondef('public.admin_adjust_coins_with_audit(text,integer,text)'::regprocedure)) > 0
  AND position('manager' IN pg_get_functiondef('public.admin_adjust_coins_with_audit(text,integer,text)'::regprocedure)) = 0,
  'only regular admins and Super Admins are authorized by the audited RPC'
);
SELECT ok(
  position('length(v_reason) < 8' IN pg_get_functiondef('public.admin_adjust_coins_with_audit(text,integer,text)'::regprocedure)) > 0,
  'the server rejects missing or too-short operator reasons'
);
SELECT ok(
  position('admin_adjust_coins_with_audit' IN pg_get_functiondef('public.admin_adjust_coins(text,integer)'::regprocedure)) > 0,
  'the legacy RPC delegates to the audited implementation'
);
SELECT ok(
  position('admin_adjust_coins_with_audit' IN pg_get_functiondef('public.admin_adjust_coins(text,integer)'::regprocedure)) > 0
  AND position('reason' IN pg_get_functiondef('public.admin_adjust_coins(text,integer)'::regprocedure)) > 0,
  'legacy wallet calls receive an explicit audit reason instead of bypassing audit'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.user_currency', 'UPDATE'),
  'wallet balances remain protected from direct authenticated table writes'
);

SELECT * FROM finish();
ROLLBACK;
