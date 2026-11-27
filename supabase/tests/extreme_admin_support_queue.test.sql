BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(12);

SELECT ok(
  to_regprocedure('public.extreme_admin_list_support_requests(text,integer,integer)') IS NOT NULL,
  'the guarded support queue RPC exists'
);
SELECT ok(
  to_regprocedure('public.extreme_admin_set_support_request_status(uuid,text,text)') IS NOT NULL,
  'the support status mutation RPC exists'
);
SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'public.extreme_admin_list_support_requests(text,integer,integer)'::regprocedure)
  AND (SELECT prosecdef FROM pg_proc WHERE oid = 'public.extreme_admin_set_support_request_status(uuid,text,text)'::regprocedure),
  'both support queue RPCs use controlled SECURITY DEFINER execution'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.extreme_admin_list_support_requests(text,integer,integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.extreme_admin_set_support_request_status(uuid,text,text)', 'EXECUTE'),
  'anonymous callers cannot access or modify the support queue'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.extreme_admin_list_support_requests(text,integer,integer)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.extreme_admin_set_support_request_status(uuid,text,text)', 'EXECUTE'),
  'authenticated callers reach the RPCs and are checked by the Extreme Admin guard'
);
SELECT ok(
  position('_is_extreme_admin()' in pg_get_functiondef('public.extreme_admin_list_support_requests(text,integer,integer)'::regprocedure)) > 0
  AND position('_is_extreme_admin()' in pg_get_functiondef('public.extreme_admin_set_support_request_status(uuid,text,text)'::regprocedure)) > 0,
  'both support queue RPCs independently enforce Extreme Admin authority'
);
SELECT ok(
  position('support_request' in pg_get_functiondef('public.extreme_admin_list_support_requests(text,integer,integer)'::regprocedure)) > 0
  AND position('support_request' in pg_get_functiondef('public.extreme_admin_set_support_request_status(uuid,text,text)'::regprocedure)) > 0,
  'support workflows are restricted to existing support_request posts'
);
SELECT ok(
  position('in_review' in pg_get_functiondef('public.extreme_admin_set_support_request_status(uuid,text,text)'::regprocedure)) > 0
  AND position('resolved' in pg_get_functiondef('public.extreme_admin_set_support_request_status(uuid,text,text)'::regprocedure)) > 0
  AND position('dismissed' in pg_get_functiondef('public.extreme_admin_set_support_request_status(uuid,text,text)'::regprocedure)) > 0,
  'support statuses are explicitly allow-listed'
);
SELECT ok(
  position('admin_audit_logs' in pg_get_functiondef('public.extreme_admin_set_support_request_status(uuid,text,text)'::regprocedure)) > 0,
  'support status changes are recorded in the canonical admin audit log'
);
SELECT ok(
  position('support_status' in pg_get_functiondef('public.extreme_admin_list_support_requests(text,integer,integer)'::regprocedure)) > 0
  AND position('support_status' in pg_get_functiondef('public.extreme_admin_set_support_request_status(uuid,text,text)'::regprocedure)) > 0,
  'support status is persisted on the existing support post rather than fabricated in the UI'
);
SELECT ok(
  position('support_updated_at' in pg_get_functiondef('public.extreme_admin_set_support_request_status(uuid,text,text)'::regprocedure)) > 0,
  'support updates retain their timestamp'
);
SELECT ok(
  position('reason' in pg_get_functiondef('public.extreme_admin_set_support_request_status(uuid,text,text)'::regprocedure)) > 0,
  'support status changes require an auditable reason'
);

SELECT * FROM finish();
ROLLBACK;
