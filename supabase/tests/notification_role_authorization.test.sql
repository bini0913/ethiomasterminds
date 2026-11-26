begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select ok(
  to_regprocedure('public.platform_assign_role(uuid,public.app_role)') is not null,
  'platform role assignment RPC exists'
);
select ok(
  has_function_privilege('authenticated', 'public.platform_assign_role(uuid,public.app_role)', 'execute'),
  'authenticated callers can invoke the guarded role assignment RPC'
);
select ok(
  not has_function_privilege('anon', 'public.platform_assign_role(uuid,public.app_role)', 'execute'),
  'anonymous callers cannot assign platform roles'
);
select ok(
  position('_is_extreme_admin' in pg_get_functiondef('public.platform_assign_role(uuid,public.app_role)'::regprocedure)) > 0,
  'target-account role assignment requires the Extreme Admin authority check'
);
select ok(
  position('self-assign' in pg_get_functiondef('public.platform_assign_role(uuid,public.app_role)'::regprocedure)) > 0
    and position('student' in pg_get_functiondef('public.platform_assign_role(uuid,public.app_role)'::regprocedure)) > 0,
  'self-assignment is restricted to the student role'
);
select ok(
  position('top-level' in lower(pg_get_functiondef('public.platform_assign_role(uuid,public.app_role)'::regprocedure))) > 0
    and position('super_admin' in lower(pg_get_functiondef('public.platform_assign_role(uuid,public.app_role)'::regprocedure))) > 0,
  'ordinary role assignment cannot provision either top-level role'
);
select ok(
  position('DELETE FROM public.user_roles' in pg_get_functiondef('public.platform_assign_role(uuid,public.app_role)'::regprocedure)) > 0,
  'role transitions replace ordinary platform roles atomically'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'exactly_one_extreme_admin'),
  'Extreme Admin remains singleton constrained'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'exactly_one_super_admin'),
  'Super Admin remains singleton constrained'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'user_roles_one_platform_role_per_account_idx'),
  'top-level authorities remain mutually exclusive per account'
);

select ok(
  to_regprocedure('public.authorize_staff_push_notification(uuid,text)') is not null,
  'staff push authorization RPC exists'
);
select ok(
  has_function_privilege('authenticated', 'public.authorize_staff_push_notification(uuid,text)', 'execute'),
  'authenticated callers can request scoped staff notification authorization'
);
select ok(
  not has_function_privilege('anon', 'public.authorize_staff_push_notification(uuid,text)', 'execute'),
  'anonymous callers cannot request staff notification authorization'
);
select ok(
  position('author_id = auth.uid()' in pg_get_functiondef('public.authorize_staff_push_notification(uuid,text)'::regprocedure)) > 0,
  'staff notification source records must be owned by the caller'
);
select ok(
  position('c.teacher_id = auth.uid()' in pg_get_functiondef('public.authorize_staff_push_notification(uuid,text)'::regprocedure)) > 0,
  'teacher notifications are restricted to caller-owned classes'
);
select ok(
  position('school_memberships' in pg_get_functiondef('public.authorize_staff_push_notification(uuid,text)'::regprocedure)) > 0
    and position('student.school_id = actor.school_id' in pg_get_functiondef('public.authorize_staff_push_notification(uuid,text)'::regprocedure)) > 0,
  'teacher notifications require active same-school teacher and student memberships'
);
select ok(
  position('class_students' in pg_get_functiondef('public.authorize_staff_push_notification(uuid,text)'::regprocedure)) > 0,
  'teacher notification recipients are derived from class membership in the database'
);
select ok(
  position('notification_title' in pg_get_functiondef('public.authorize_staff_push_notification(uuid,text)'::regprocedure)) > 0
    and position('notification_body' in pg_get_functiondef('public.authorize_staff_push_notification(uuid,text)'::regprocedure)) > 0,
  'notification text is returned from the owned source record rather than caller input'
);
select ok(
  position('assigned_by = auth.uid()' in pg_get_functiondef('public.authorize_staff_push_notification(uuid,text)'::regprocedure)) > 0,
  'quiz assignment notifications are restricted to caller-owned assignments'
);
select ok(
  to_regclass('public.notification_events') is not null,
  'notification delivery events have a database record'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.notification_events'::regclass),
  'notification delivery events have RLS enabled'
);
select ok(
  not has_table_privilege('authenticated', 'public.notification_events', 'INSERT'),
  'authenticated clients cannot write delivery events directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.notification_events', 'UPDATE'),
  'authenticated clients cannot alter delivery events directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.notification_devices', 'UPDATE'),
  'authenticated clients cannot enable or disable arbitrary devices directly'
);

select * from finish();
rollback;
