-- Allow a school Manager or appointed Main Director to attach an existing
-- Master Minds account as a school teacher without creating a duplicate login.
-- The person's global role is intentionally untouched. Class assignments can
-- be configured later through the existing Teacher Assignments workspace.

CREATE OR REPLACE FUNCTION public.school_attach_existing_teacher_account(
  p_actor_id uuid,
  p_school_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_username text;
  v_is_manager boolean := false;
  v_is_main_director boolean := false;
  v_membership_id uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Trusted account provisioning service required';
  END IF;

  IF p_actor_id IS NULL OR p_school_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Actor, school, and existing user are required';
  END IF;

  IF p_actor_id = p_user_id THEN
    RAISE EXCEPTION 'You cannot attach your own account as a teacher';
  END IF;

  SELECT lower(trim(username))
  INTO v_username
  FROM public.profiles
  WHERE id = p_user_id;

  IF nullif(v_username, '') IS NULL THEN
    RAISE EXCEPTION 'The existing account has no usable username';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.school_memberships
    WHERE school_id = p_school_id
      AND user_id = p_actor_id
      AND school_role = 'manager'
      AND status = 'active'
  ) INTO v_is_manager;

  SELECT EXISTS (
    SELECT 1
    FROM public.school_memberships membership
    JOIN public.school_leadership_appointments appointment
      ON appointment.school_id = membership.school_id
     AND appointment.membership_id = membership.id
    WHERE membership.school_id = p_school_id
      AND membership.user_id = p_actor_id
      AND membership.school_role = 'admin'
      AND membership.status = 'active'
      AND appointment.position = 'main_director'
      AND appointment.status = 'active'
      AND appointment.start_date <= CURRENT_DATE
      AND (appointment.end_date IS NULL OR appointment.end_date >= CURRENT_DATE)
  ) INTO v_is_main_director;

  IF NOT (v_is_manager OR v_is_main_director) THEN
    RAISE EXCEPTION 'Only this school''s Manager or appointed Main Director can attach an existing teacher account';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.schools
    WHERE id = p_school_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'School not found or not active';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE school_id = p_school_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'This account already has a membership in this school';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE lower(school_username) = v_username
  ) THEN
    RAISE EXCEPTION 'This school username is already in use';
  END IF;

  INSERT INTO public.school_memberships (
    school_id, user_id, school_role, status, school_username, created_by
  )
  VALUES (
    p_school_id, p_user_id, 'teacher', 'active', v_username, p_actor_id
  )
  RETURNING id INTO v_membership_id;

  INSERT INTO public.admin_audit_logs (
    actor_id, action, target_type, target_id, metadata
  )
  VALUES (
    p_actor_id,
    'school_existing_teacher_account_attached',
    'school_membership',
    v_membership_id,
    jsonb_build_object(
      'school_id', p_school_id,
      'target_user_id', p_user_id,
      'school_username', v_username,
      'school_role', 'teacher'
    )
  );

  RETURN v_membership_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.school_attach_existing_teacher_account(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.school_attach_existing_teacher_account(uuid, uuid, uuid)
  TO service_role;
