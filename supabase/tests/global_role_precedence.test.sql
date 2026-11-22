begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select ok(
  position('ur.role = ''extreme_admin''' in pg_get_functiondef('public.get_user_role(uuid)'::regprocedure))
  < position('ur.role = ''super_admin''' in pg_get_functiondef('public.get_user_role(uuid)'::regprocedure)),
  'Extreme Admin remains the highest-priority global role'
);

select ok(
  position('ur.role = ''super_admin''' in pg_get_functiondef('public.get_user_role(uuid)'::regprocedure))
  < position('sm.school_role' in pg_get_functiondef('public.get_user_role(uuid)'::regprocedure)),
  'global Super Admin role is resolved before school memberships'
);

select ok(
  position('2 AS source_priority' in pg_get_functiondef('public.get_user_role(uuid)'::regprocedure))
  > position('ur.role = ''super_admin''' in pg_get_functiondef('public.get_user_role(uuid)'::regprocedure)),
  'school memberships are assigned a lower precedence than Super Admin'
);

select ok(
  position('sm.school_role <> ''admin''' in pg_get_functiondef('public.get_user_role(uuid)'::regprocedure)) > 0,
  'retired School Admin memberships remain excluded'
);

select ok(
  position('NOT public._is_extreme_admin()' in pg_get_functiondef('public.get_user_role(uuid)'::regprocedure)) > 0,
  'cross-user role lookup remains protected'
);

select * from finish();
rollback;
