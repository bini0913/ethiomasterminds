-- Trusted school account provisioning. This function is callable only by the
-- service-role Edge Function after it has authenticated the caller.
CREATE OR REPLACE FUNCTION public.school_attach_account(
  p_actor_id uuid,
  p_school_id uuid,
  p_user_id uuid,
  p_school_role text,
  p_school_username text,
  p_grade_label text DEFAULT NULL,
  p_age_at_enrollment integer DEFAULT NULL,
  p_section_id uuid DEFAULT NULL,
  p_student_number bigint DEFAULT NULL,
  p_parent_membership_ids uuid[] DEFAULT '{}'::uuid[],
  p_student_membership_ids uuid[] DEFAULT '{}'::uuid[],
  p_teacher_assignments jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role text;
  v_is_super_admin boolean;
  v_school_code text;
  v_membership_id uuid;
  v_section_grade text;
  v_assignment jsonb;
  v_assignment_section uuid;
  v_assignment_subject text;
  v_assignment_kind text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Trusted account provisioning service required';
  END IF;
  IF p_actor_id IS NULL OR p_user_id IS NULL OR p_school_id IS NULL THEN
    RAISE EXCEPTION 'Actor, school, and new user are required';
  END IF;
  IF p_school_role NOT IN ('manager', 'admin', 'teacher', 'finance', 'parent', 'student') THEN
    RAISE EXCEPTION 'Invalid school role';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'New account profile was not created';
  END IF;
  IF lower((SELECT username FROM public.profiles WHERE id = p_user_id)) <> lower(trim(p_school_username)) THEN
    RAISE EXCEPTION 'Account username does not match the new profile';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_actor_id AND role = 'extreme_admin'::public.app_role
  ) INTO v_is_super_admin;

  SELECT school_role INTO v_actor_role
  FROM public.school_memberships
  WHERE school_id = p_school_id
    AND user_id = p_actor_id
    AND status = 'active'
    AND school_role IN ('manager', 'admin')
  LIMIT 1;

  IF NOT v_is_super_admin AND v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Only the school Manager or Admin can provision accounts';
  END IF;
  IF NOT v_is_super_admin AND v_actor_role = 'admin'
     AND p_school_role NOT IN ('student', 'parent', 'teacher') THEN
    RAISE EXCEPTION 'School Admin can create student, parent, and teacher accounts only';
  END IF;
  IF NOT v_is_super_admin AND v_actor_role = 'manager'
     AND p_school_role NOT IN ('student', 'parent', 'teacher', 'finance', 'admin') THEN
    RAISE EXCEPTION 'School Manager cannot create another Manager account';
  END IF;
  IF p_school_role = 'manager' AND NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Only the Super Admin can create a school Manager';
  END IF;

  SELECT school_code INTO v_school_code
  FROM public.schools
  WHERE id = p_school_id AND status = 'active';
  IF v_school_code IS NULL THEN
    RAISE EXCEPTION 'School not found or not active';
  END IF;

  IF p_school_role = 'student' THEN
    IF nullif(trim(p_grade_label), '') IS NULL
       OR p_age_at_enrollment IS NULL
       OR p_age_at_enrollment NOT BETWEEN 1 AND 120
       OR p_section_id IS NULL
       OR p_student_number IS NULL
       OR nullif(trim(p_school_username), '') IS NULL THEN
      RAISE EXCEPTION 'Student grade, age, section, student ID, and username are required';
    END IF;
    SELECT grade_label INTO v_section_grade
    FROM public.school_sections
    WHERE id = p_section_id AND school_id = p_school_id;
    IF v_section_grade IS NULL OR v_section_grade <> trim(p_grade_label) THEN
      RAISE EXCEPTION 'Student section must belong to the selected grade and school';
    END IF;
    IF lower(trim(p_school_username)) !~ ('^' || lower(v_school_code) || '/' || p_student_number::text || '/' || p_age_at_enrollment::text || '$') THEN
      RAISE EXCEPTION 'Student username must match SCHOOL_CODE/STUDENT_ID/AGE';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.school_memberships
      WHERE school_id = p_school_id
        AND school_role = 'student'
        AND student_number = p_student_number
    ) THEN
      RAISE EXCEPTION 'Student ID is already assigned in this school';
    END IF;
    IF coalesce(cardinality(p_parent_membership_ids), 0) > 0 AND EXISTS (
      SELECT 1
      FROM unnest(p_parent_membership_ids) parent_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.school_memberships parent
        WHERE parent.id = parent_id
          AND parent.school_id = p_school_id
          AND parent.school_role = 'parent'
          AND parent.status = 'active'
      )
    ) THEN
      RAISE EXCEPTION 'Every linked parent must be an active parent account in this school';
    END IF;
  ELSIF p_school_role = 'parent' THEN
    IF lower(trim(p_school_username)) NOT LIKE 'pa%' THEN
      RAISE EXCEPTION 'School parent usernames must begin with pa';
    END IF;
    IF coalesce(cardinality(p_student_membership_ids), 0) > 0 AND EXISTS (
      SELECT 1
      FROM unnest(p_student_membership_ids) student_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.school_memberships student
        WHERE student.id = student_id
          AND student.school_id = p_school_id
          AND student.school_role = 'student'
          AND student.status IN ('active', 'suspended')
      )
    ) THEN
      RAISE EXCEPTION 'Every linked child must be an enrolled student in this school';
    END IF;
  ELSIF p_school_role = 'teacher' THEN
    IF jsonb_typeof(coalesce(p_teacher_assignments, '[]'::jsonb)) <> 'array'
       OR jsonb_array_length(coalesce(p_teacher_assignments, '[]'::jsonb)) = 0 THEN
      RAISE EXCEPTION 'Teacher accounts require at least one subject, section, or homeroom assignment';
    END IF;
  END IF;

  INSERT INTO public.school_memberships(
    school_id, user_id, school_role, status, grade_label, age_at_enrollment,
    section_id, student_number, school_username, created_by
  )
  VALUES (
    p_school_id, p_user_id, p_school_role, 'active',
    CASE WHEN p_school_role = 'student' THEN trim(p_grade_label) ELSE NULL END,
    CASE WHEN p_school_role = 'student' THEN p_age_at_enrollment ELSE NULL END,
    CASE WHEN p_school_role = 'student' THEN p_section_id ELSE NULL END,
    CASE WHEN p_school_role = 'student' THEN p_student_number ELSE NULL END,
    lower(trim(p_school_username)),
    p_actor_id
  )
  RETURNING id INTO v_membership_id;

  IF p_school_role = 'student' AND coalesce(cardinality(p_parent_membership_ids), 0) > 0 THEN
    INSERT INTO public.school_parent_student_links(
      school_id, parent_membership_id, student_membership_id, linked_by
    )
    SELECT p_school_id, parent_id, v_membership_id, p_actor_id
    FROM unnest(p_parent_membership_ids) parent_id;
  ELSIF p_school_role = 'parent' AND coalesce(cardinality(p_student_membership_ids), 0) > 0 THEN
    INSERT INTO public.school_parent_student_links(
      school_id, parent_membership_id, student_membership_id, linked_by
    )
    SELECT p_school_id, v_membership_id, student_id, p_actor_id
    FROM unnest(p_student_membership_ids) student_id;
  ELSIF p_school_role = 'teacher' THEN
    FOR v_assignment IN SELECT value FROM jsonb_array_elements(p_teacher_assignments)
    LOOP
      v_assignment_section := nullif(v_assignment ->> 'section_id', '')::uuid;
      v_assignment_subject := nullif(trim(v_assignment ->> 'subject_name'), '');
      v_assignment_kind := coalesce(nullif(v_assignment ->> 'assignment_kind', ''), 'subject');
      IF v_assignment_section IS NULL OR v_assignment_subject IS NULL
         OR v_assignment_kind NOT IN ('subject', 'homeroom') THEN
        RAISE EXCEPTION 'Teacher assignment is incomplete or invalid';
      END IF;
      SELECT grade_label INTO v_section_grade
      FROM public.school_sections
      WHERE id = v_assignment_section AND school_id = p_school_id;
      IF v_section_grade IS NULL THEN
        RAISE EXCEPTION 'Teacher assignment section does not belong to this school';
      END IF;
      IF v_assignment_kind = 'subject' AND NOT EXISTS (
        SELECT 1 FROM public.school_subjects
        WHERE school_id = p_school_id
          AND grade_label = v_section_grade
          AND subject_name = v_assignment_subject
          AND active = true
      ) THEN
        RAISE EXCEPTION 'Teacher subject must be an active subject for the assigned grade';
      END IF;
      IF v_assignment_kind = 'homeroom' THEN
        IF EXISTS (
          SELECT 1 FROM public.school_sections
          WHERE id = v_assignment_section
            AND homeroom_teacher_id IS NOT NULL
            AND homeroom_teacher_id <> p_user_id
        ) THEN
          RAISE EXCEPTION 'This section already has a homeroom teacher';
        END IF;
        UPDATE public.school_sections
        SET homeroom_teacher_id = p_user_id
        WHERE id = v_assignment_section AND school_id = p_school_id;
      END IF;
      INSERT INTO public.school_teacher_assignments(
        school_id, teacher_membership_id, section_id, subject_name,
        assignment_kind, created_by
      )
      VALUES (
        p_school_id, v_membership_id, v_assignment_section, v_assignment_subject,
        v_assignment_kind, p_actor_id
      );
    END LOOP;
  END IF;

  UPDATE public.profiles
  SET grade = CASE WHEN p_school_role = 'student' THEN trim(p_grade_label) ELSE grade END
  WHERE id = p_user_id;

  RETURN v_membership_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_link_parent_students(
  p_actor_id uuid,
  p_parent_membership_id uuid,
  p_student_membership_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_actor_role text;
  v_count integer := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Trusted account provisioning service required';
  END IF;

  SELECT school_id INTO v_school_id
  FROM public.school_memberships
  WHERE id = p_parent_membership_id AND school_role = 'parent';
  IF v_school_id IS NULL THEN RAISE EXCEPTION 'Parent account not found'; END IF;

  SELECT school_role INTO v_actor_role
  FROM public.school_memberships
  WHERE school_id = v_school_id AND user_id = p_actor_id
    AND status = 'active' AND school_role IN ('manager', 'admin')
  LIMIT 1;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_actor_id AND role = 'extreme_admin'::public.app_role
  ) AND v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Only the school Manager or Admin can link parent accounts';
  END IF;

  IF coalesce(cardinality(p_student_membership_ids), 0) = 0 THEN
    RAISE EXCEPTION 'At least one student is required';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_student_membership_ids) student_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_memberships student
      WHERE student.id = student_id
        AND student.school_id = v_school_id
        AND student.school_role = 'student'
        AND student.status IN ('active', 'suspended')
    )
  ) THEN
    RAISE EXCEPTION 'Every linked child must be enrolled in this school';
  END IF;

  UPDATE public.school_memberships
  SET status = 'active', ended_at = NULL, end_reason = NULL, updated_at = now()
  WHERE id = p_parent_membership_id AND status = 'deactivated';

  INSERT INTO public.school_parent_student_links(
    school_id, parent_membership_id, student_membership_id, linked_by
  )
  SELECT v_school_id, p_parent_membership_id, student_id, p_actor_id
  FROM unnest(p_student_membership_ids) student_id
  ON CONFLICT (parent_membership_id, student_membership_id)
  DO UPDATE SET status = 'active', ended_at = NULL, linked_by = p_actor_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.school_attach_account(uuid, uuid, uuid, text, text, text, integer, uuid, bigint, uuid[], uuid[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_link_parent_students(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.school_attach_account(uuid, uuid, uuid, text, text, text, integer, uuid, bigint, uuid[], uuid[], jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.school_link_parent_students(uuid, uuid, uuid[]) TO service_role;
