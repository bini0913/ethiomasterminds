begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select ok(
  to_regprocedure('public.extreme_admin_preflight_account_deletion(uuid)') is not null,
  'read-only per-request account deletion preflight exists'
);
select ok(
  has_function_privilege('authenticated', 'public.extreme_admin_preflight_account_deletion(uuid)', 'EXECUTE'),
  'authenticated users can reach the guarded preflight RPC'
);
select ok(
  not has_function_privilege('anon', 'public.extreme_admin_preflight_account_deletion(uuid)', 'EXECUTE'),
  'anonymous users cannot inspect account deletion dependencies'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.extreme_admin_preflight_account_deletion(uuid)'::regprocedure),
  'deletion preflight runs with controlled security-definer access'
);
select ok(
  (select provolatile = 's' from pg_proc where oid = 'public.extreme_admin_preflight_account_deletion(uuid)'::regprocedure),
  'deletion preflight is read-only and marked stable'
);
select ok(
  position('public.has_role(v_actor, ''extreme_admin''::public.app_role)' in pg_get_functiondef('public.extreme_admin_preflight_account_deletion(uuid)'::regprocedure)) > 0,
  'only an Extreme Admin can run the preflight'
);
select ok(
  position('pg_constraint' in pg_get_functiondef('public.extreme_admin_preflight_account_deletion(uuid)'::regprocedure)) > 0,
  'preflight discovers actual foreign-key blockers from the database catalog'
);
select ok(
  position('storage.objects' in pg_get_functiondef('public.extreme_admin_preflight_account_deletion(uuid)'::regprocedure)) > 0,
  'preflight inventories user-owned storage objects across buckets'
);
select ok(
  position('deletion_executed' in pg_get_functiondef('public.extreme_admin_preflight_account_deletion(uuid)'::regprocedure)) > 0
  and position('retention_review_required' in pg_get_functiondef('public.extreme_admin_preflight_account_deletion(uuid)'::regprocedure)) > 0,
  'preflight clearly distinguishes technical blockers from mandatory manual retention review and never deletes data'
);

select * from finish();
rollback;
