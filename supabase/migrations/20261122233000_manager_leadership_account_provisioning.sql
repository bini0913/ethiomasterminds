-- Create leadership memberships without inventing classroom teaching assignments.
-- The School Manager is the only actor allowed to provision these school-wide leadership accounts.

CREATE OR REPLACE FUNCTION public.school_attach_leadership_account(
  p_actor_id uuid,
  p_school_id uuid,
  p_user_id uuid,
  p_school_username text,
  p_position text,
  p_division_scope text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_manager_membership_id uuid;
  v_membership_id uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Trusted account provisioning service required';
  END IF;

  IF p_actor_id IS NULL OR p_school_id IS NULL OR p_user_id IS NULL
     OR nullif(btrim(p_school_username), '') IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Manager, school, account and username are required';
  END IF;

  IF p_position IS NULL OR p_position NOT IN (
    'kg_director', 'elementary_director', 'middle_school_director',
    'high_school_director', 'vice_director', 'academic_director'
  ) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Choose a supported Director or Vice Director position';
  END IF;

  IF p_position = 'kg_director' AND p_division_scope IS DISTINCT FROM 'kg'
     OR p_position = 'elementary_director' AND p_division_scope IS DISTINCT FROM 'elementary'
     OR p_position = 'middle_school_director' AND p_division_scope IS DISTINCT FROM 'middle_school'
     OR p_position = 'high_school_director' AND p_division_scope IS DISTINCT FROM 'high_school'
     OR p_position = 'vice_director' AND (p_division_scope IS NULL OR p_division_scope NOT IN ('kg','elementary','middle_school','high_school'))
     OR p_position = 'academic_director' AND p_division_scope IS NOT NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'The leadership position and division scope do not match';
  END IF;

  SELECT id INTO v_manager_membership_id
  FROM public.school_memberships
  WHERE school_id = p_school_id
    AND user_id = p_actor_id
    AND school_role = 'manager'
    AND status = 'active'
  LIMIT 1;

  IF v_manager_membership_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Only the active School Manager can create Director accounts';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.schools WHERE id = p_school_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'School is not active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND lower(username) = lower(btrim(p_school_username))
  ) THEN
    RAISE EXCEPTION USING errcode = '23514', message = 'Account username does not match its profile';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE school_id = p_school_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION USING errcode = '23505', message = 'This person already has a membership in the school';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.school_leadership_appointments
    WHERE school_id = p_school_id
      AND position = p_position
      AND division_scope IS NOT DISTINCT FROM p_division_scope
      AND status = 'active'
      AND start_date <= CURRENT_DATE
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  ) THEN
    RAISE EXCEPTION USING errcode = '23505', message = 'This leadership position is already filled. End the previous appointment before creating a replacement.';
  END IF;

  INSERT INTO public.school_memberships (
    school_id, user_id, school_role, status, school_username, created_by
  ) VALUES (
    p_school_id, p_user_id, 'teacher', 'active', lower(btrim(p_school_username)), p_actor_id
  )
  RETURNING id INTO v_membership_id;

  RETURN v_membership_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.school_attach_leadership_account(uuid,uuid,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.school_attach_leadership_account(uuid,uuid,uuid,text,text,text) TO service_role;
