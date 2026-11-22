BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'school_reject_platform_authority_membership'
      AND tgrelid = 'public.school_memberships'::regclass
      AND NOT tgisinternal
      AND (tgtype & 4) = 4
      AND (tgtype & 16) = 16
  ),
  'active school membership guard runs on INSERT and UPDATE'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'user_roles_reject_platform_authority_membership'
      AND tgrelid = 'public.user_roles'::regclass
      AND NOT tgisinternal
      AND (tgtype & 4) = 4
      AND (tgtype & 16) = 16
  ),
  'platform authority assignment is blocked for accounts with active school memberships'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'school_reject_platform_authority_appointment'
      AND tgrelid = 'public.school_leadership_appointments'::regclass
      AND NOT tgisinternal
      AND (tgtype & 4) = 4
      AND (tgtype & 16) = 16
  ),
  'active leadership appointments are guarded on INSERT and UPDATE'
);

SELECT ok(
  position('super_admin' in pg_get_functiondef('public.school_reject_platform_authority_membership()'::regprocedure)) > 0
  AND position('extreme_admin' in pg_get_functiondef('public.school_reject_platform_authority_membership()'::regprocedure)) > 0,
  'membership guard rejects both platform authority roles'
);

SELECT ok(
  position('school_memberships' in pg_get_functiondef('public.user_roles_reject_platform_authority_membership()'::regprocedure)) > 0
  AND position('active' in pg_get_functiondef('public.user_roles_reject_platform_authority_membership()'::regprocedure)) > 0,
  'platform authority cannot be assigned while an active school membership exists'
);

SELECT ok(
  position('school_memberships' in pg_get_functiondef('public.school_reject_platform_authority_appointment()'::regprocedure)) > 0
  AND position('user_roles' in pg_get_functiondef('public.school_reject_platform_authority_appointment()'::regprocedure)) > 0,
  'leadership appointment guard verifies active membership and platform role'
);

SELECT ok(
  to_regprocedure('public._school_is_platform_authority_user(uuid)') IS NOT NULL,
  'private platform-authority detector exists'
);

SELECT ok(
  position('_school_is_platform_authority_user' in pg_get_functiondef('public.school_can_view_membership(uuid)'::regprocedure)) > 0,
  'ordinary membership visibility hides platform authority accounts'
);

SELECT ok(
  position('_school_is_platform_authority_user' in pg_get_functiondef('public.school_can_view_leadership_appointment(uuid)'::regprocedure)) > 0,
  'leadership appointment visibility hides platform authority accounts'
);

SELECT ok(
  position('school_can_view_membership' in coalesce((
    SELECT qual FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'school_memberships'
      AND policyname = 'school_memberships_manager_update'
  ), '')) > 0,
  'School Managers cannot update hidden platform authority memberships'
);

SELECT ok(
  position('school_can_view_scoped_leadership_membership' in coalesce((
    SELECT qual FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'school_memberships'
      AND policyname = 'school_leadership_view_scoped_memberships'
  ), '')) > 0,
  'leadership staff directory policy hides platform authority memberships'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public._school_is_platform_authority_user(uuid)',
    'EXECUTE'
  ),
  'authenticated users cannot call the private platform-role detector directly'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.school_memberships membership
    JOIN public.user_roles platform_role
      ON platform_role.user_id = membership.user_id
     AND platform_role.role IN ('super_admin'::public.app_role, 'extreme_admin'::public.app_role)
    WHERE membership.status = 'active'
  ),
  0::bigint,
  'no platform authority account retains an active school membership'
);

SELECT is(
  (
    SELECT count(*)::bigint
    FROM public.school_leadership_appointments appointment
    JOIN public.school_memberships membership
      ON membership.id = appointment.membership_id
     AND membership.school_id = appointment.school_id
    JOIN public.user_roles platform_role
      ON platform_role.user_id = membership.user_id
     AND platform_role.role IN ('super_admin'::public.app_role, 'extreme_admin'::public.app_role)
    WHERE appointment.status = 'active'
  ),
  0::bigint,
  'no platform authority account retains an active school leadership appointment'
);

SELECT * FROM finish();
ROLLBACK;
