-- Retire the obsolete School Admin / Main Director model.
-- Existing rows remain available as history; new assignments are blocked.
BEGIN;

CREATE OR REPLACE FUNCTION public.school_protect_membership_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF ROW(NEW.school_id, NEW.user_id, NEW.school_role, NEW.student_number, NEW.school_username, NEW.age_at_enrollment, NEW.created_by)
     IS DISTINCT FROM
     ROW(OLD.school_id, OLD.user_id, OLD.school_role, OLD.student_number, OLD.school_username, OLD.age_at_enrollment, OLD.created_by) THEN
    IF NOT (
      coalesce(current_setting('app.school_membership_role_transition', true), '') = 'true'
      AND OLD.school_role = 'admin'
      AND NEW.school_role = 'finance'
      AND ROW(NEW.school_id, NEW.user_id, NEW.student_number, NEW.school_username, NEW.age_at_enrollment, NEW.created_by)
          IS NOT DISTINCT FROM
          ROW(OLD.school_id, OLD.user_id, OLD.student_number, OLD.school_username, OLD.age_at_enrollment, OLD.created_by)
    ) THEN
      RAISE EXCEPTION 'School membership identity and assigned student ID are immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.school_reject_retired_admin_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.school_role = 'admin' THEN
    RAISE EXCEPTION 'The School Admin membership is retired. Use the School Manager and leadership appointment workflow.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS school_reject_retired_admin_membership ON public.school_memberships;
CREATE TRIGGER school_reject_retired_admin_membership
BEFORE INSERT ON public.school_memberships
FOR EACH ROW EXECUTE FUNCTION public.school_reject_retired_admin_membership();

CREATE OR REPLACE FUNCTION public.school_reject_retired_main_director_appointment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.position = 'main_director' THEN
    RAISE EXCEPTION 'The Main Director designation is retired. Appoint a supported Director or school-wide Director instead.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS school_reject_retired_main_director_appointment ON public.school_leadership_appointments;
CREATE TRIGGER school_reject_retired_main_director_appointment
BEFORE INSERT ON public.school_leadership_appointments
FOR EACH ROW EXECUTE FUNCTION public.school_reject_retired_main_director_appointment();

-- Retire active legacy appointments without deleting their historical records.
UPDATE public.school_leadership_appointments
SET status = 'ended',
    end_date = GREATEST(CURRENT_DATE, start_date),
    change_reason = 'Retired obsolete Main Director designation; historical record retained.'
WHERE position = 'main_director'
  AND status = 'active';

-- Immediately disable active legacy Admin memberships so no remaining function
-- that still recognizes the historical role can grant it access.
UPDATE public.school_memberships
SET status = 'suspended',
    end_reason = 'Legacy School Admin role retired; awaiting Manager reassignment.',
    ended_at = NULL
WHERE school_role = 'admin'
  AND status = 'active';

DROP TRIGGER IF EXISTS school_require_full_main_director_permissions ON public.school_leadership_appointments;
DROP FUNCTION IF EXISTS public.school_require_full_main_director_permissions();

-- Legacy school Admin memberships no longer grant Admin authorization.
CREATE OR REPLACE FUNCTION public.school_is_admin(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT public._is_extreme_admin();
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role public.app_role;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF _user_id IS DISTINCT FROM auth.uid()
     AND coalesce(auth.role(), '') <> 'service_role'
     AND NOT public._is_extreme_admin() THEN
    RETURN NULL;
  END IF;

  SELECT candidate.role
  INTO v_role
  FROM (
    SELECT ur.role, 0 AS source_priority,
      CASE ur.role
        WHEN 'extreme_admin'::public.app_role THEN 0
        ELSE 10
      END AS role_priority
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'extreme_admin'::public.app_role

    UNION ALL

    SELECT sm.school_role::public.app_role, 1 AS source_priority,
      CASE sm.school_role
        WHEN 'manager' THEN 1
        WHEN 'finance' THEN 3
        WHEN 'teacher' THEN 4
        WHEN 'parent' THEN 5
        WHEN 'student' THEN 6
        ELSE 99
      END AS role_priority
    FROM public.school_memberships sm
    WHERE sm.user_id = _user_id
      AND sm.status = 'active'
      AND sm.school_role <> 'admin'

    UNION ALL

    SELECT ur.role, 2 AS source_priority,
      CASE ur.role
        WHEN 'manager'::public.app_role THEN 1
        WHEN 'admin'::public.app_role THEN 2
        WHEN 'finance'::public.app_role THEN 3
        WHEN 'teacher'::public.app_role THEN 4
        WHEN 'parent'::public.app_role THEN 5
        WHEN 'student'::public.app_role THEN 6
        ELSE 99
      END AS role_priority
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role <> 'extreme_admin'::public.app_role
  ) AS candidate
  ORDER BY candidate.source_priority, candidate.role_priority
  LIMIT 1;

  RETURN v_role;
END;
$function$;

-- Keep the Manager permission editor, but make retired appointments immutable history.
CREATE OR REPLACE FUNCTION public.school_update_leadership_permissions(
  p_appointment_id uuid,
  p_permissions text[],
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_appointment public.school_leadership_appointments%ROWTYPE;
  v_actor public.school_memberships%ROWTYPE;
  v_allowed_permissions text[] := ARRAY[
    'view_students', 'view_staff', 'view_attendance', 'review_attendance',
    'view_academics', 'review_assessments', 'review_results', 'view_curriculum',
    'manage_team_tasks', 'assign_team_tasks', 'view_reports', 'publish_announcements',
    'view_discipline', 'review_discipline', 'view_finance_summary', 'view_staff_evaluations', 'manage_meetings'
  ]::text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_appointment
  FROM public.school_leadership_appointments
  WHERE id = p_appointment_id
  FOR UPDATE;
  IF v_appointment.id IS NULL THEN RAISE EXCEPTION 'Leadership appointment not found'; END IF;

  SELECT * INTO v_actor
  FROM public.school_memberships
  WHERE school_id = v_appointment.school_id
    AND user_id = auth.uid()
    AND school_role = 'manager'
    AND status = 'active'
  LIMIT 1;
  IF v_actor.id IS NULL THEN RAISE EXCEPTION 'Only the School Manager can change leadership permissions'; END IF;
  IF v_appointment.position = 'main_director' THEN
    RAISE EXCEPTION 'Legacy Main Director appointments are retired and cannot be changed; the historical record is preserved';
  END IF;
  IF v_appointment.status = 'ended' THEN
    RAISE EXCEPTION 'Ended appointments are historical; create a new appointment to change permissions';
  END IF;
  IF NOT (COALESCE(p_permissions, ARRAY[]::text[]) <@ v_allowed_permissions) THEN
    RAISE EXCEPTION 'One or more permissions are not supported';
  END IF;

  IF v_appointment.position = 'hr_director' AND NOT (
    COALESCE(p_permissions, ARRAY[]::text[]) <@ ARRAY[
      'view_staff', 'view_staff_evaluations', 'manage_team_tasks',
      'view_reports', 'view_finance_summary', 'manage_meetings'
    ]::text[]
  ) THEN
    RAISE EXCEPTION 'HR Director permissions are limited to school HR and finance operations';
  END IF;

  IF v_appointment.position <> 'hr_director' AND 'view_staff_evaluations' = ANY(COALESCE(p_permissions, ARRAY[]::text[])) THEN
    RAISE EXCEPTION 'Staff evaluation access is reserved for the HR Director';
  END IF;

  IF v_appointment.position = 'academic_director' AND NOT (
    COALESCE(p_permissions, ARRAY[]::text[]) <@ ARRAY[
      'view_students', 'view_staff', 'view_attendance', 'view_academics',
      'review_assessments', 'review_results', 'view_curriculum',
      'view_reports', 'publish_announcements', 'manage_meetings'
    ]::text[]
  ) THEN
    RAISE EXCEPTION 'Academic Director permissions are limited to school-wide academic oversight';
  END IF;
  IF nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required when changing leadership permissions';
  END IF;

  UPDATE public.school_leadership_appointments
  SET permissions = COALESCE(p_permissions, ARRAY[]::text[]),
      change_reason = trim(p_reason),
      updated_at = now()
  WHERE id = p_appointment_id;
  RETURN true;
END;
$function$;

-- A School Manager can safely convert one existing legacy membership into the
-- Finance membership required by the HR Director / Business Manager workspace.
CREATE OR REPLACE FUNCTION public.school_convert_legacy_admin_to_hr_director(
  p_target_membership_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_target public.school_memberships%ROWTYPE;
  v_actor public.school_memberships%ROWTYPE;
  v_appointment_id uuid;
  v_permissions text[] := ARRAY[
    'view_staff', 'view_staff_evaluations', 'manage_team_tasks',
    'view_reports', 'view_finance_summary', 'manage_meetings'
  ]::text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF nullif(trim(p_reason), '') IS NULL OR char_length(trim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'A concise reason (1–500 characters) is required';
  END IF;

  SELECT * INTO v_target
  FROM public.school_memberships
  WHERE id = p_target_membership_id
  FOR UPDATE;
  IF v_target.id IS NULL
     OR v_target.status <> 'suspended'
     OR v_target.school_role <> 'admin'
     OR v_target.end_reason IS DISTINCT FROM 'Legacy School Admin role retired; awaiting Manager reassignment.' THEN
    RAISE EXCEPTION 'Choose a legacy membership retired by the migration and awaiting Manager reassignment';
  END IF;

  SELECT * INTO v_actor
  FROM public.school_memberships
  WHERE school_id = v_target.school_id
    AND user_id = auth.uid()
    AND school_role = 'manager'
    AND status = 'active'
  LIMIT 1;
  IF v_actor.id IS NULL THEN
    RAISE EXCEPTION 'Only the active School Manager can convert a legacy membership';
  END IF;
  IF v_target.user_id = auth.uid() THEN
    RAISE EXCEPTION 'The School Manager cannot convert their own membership';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = v_target.school_id AND status = 'active') THEN
    RAISE EXCEPTION 'The school must be active before a legacy membership can be converted';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE school_id = v_target.school_id
      AND user_id = v_target.user_id
      AND school_role = 'finance'
  ) THEN
    RAISE EXCEPTION 'This person already has a Finance membership in this school';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.school_leadership_appointments appointment
    WHERE appointment.school_id = v_target.school_id
      AND appointment.position = 'hr_director'
      AND appointment.status = 'active'
      AND appointment.start_date <= CURRENT_DATE
      AND (appointment.end_date IS NULL OR appointment.end_date >= CURRENT_DATE)
      AND appointment.membership_id <> v_target.id
  ) THEN
    RAISE EXCEPTION 'The school already has an active HR Director / Business Manager';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.school_leadership_appointments appointment
    WHERE appointment.school_id = v_target.school_id
      AND appointment.membership_id = v_target.id
      AND appointment.status = 'active'
      AND appointment.position <> 'main_director'
  ) THEN
    RAISE EXCEPTION 'End the existing leadership appointment before converting this membership';
  END IF;

  UPDATE public.school_leadership_appointments
  SET status = 'ended',
      end_date = GREATEST(CURRENT_DATE, start_date),
      change_reason = trim(p_reason)
  WHERE school_id = v_target.school_id
    AND membership_id = v_target.id
    AND position = 'main_director'
    AND status = 'active';

  PERFORM set_config('app.school_membership_role_transition', 'true', true);
  UPDATE public.school_memberships
  SET school_role = 'finance',
      status = 'active',
      end_reason = NULL,
      ended_at = NULL
  WHERE id = v_target.id;
  PERFORM set_config('app.school_membership_role_transition', '', true);

  INSERT INTO public.school_leadership_appointments (
    school_id, membership_id, position, division_scope, team_name,
    permissions, status, start_date, end_date, appointed_by_membership_id,
    change_reason
  ) VALUES (
    v_target.school_id, v_target.id, 'hr_director', NULL, NULL,
    v_permissions, 'active', CURRENT_DATE, NULL, v_actor.id, trim(p_reason)
  ) RETURNING id INTO v_appointment_id;

  INSERT INTO public.school_leadership_structure_events (
    school_id, actor_user_id, actor_membership_id, event_type, details
  ) VALUES (
    v_target.school_id, auth.uid(), v_actor.id,
    'legacy_admin_converted_to_hr_director',
    jsonb_build_object(
      'membership_id', v_target.id,
      'user_id', v_target.user_id,
      'previous_school_role', 'admin',
      'new_school_role', 'finance',
      'appointment_id', v_appointment_id,
      'reason', trim(p_reason)
    )
  );

  RETURN v_appointment_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.school_reject_retired_admin_membership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_reject_retired_main_director_appointment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_convert_legacy_admin_to_hr_director(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_convert_legacy_admin_to_hr_director(uuid, text) TO authenticated;

COMMIT;
