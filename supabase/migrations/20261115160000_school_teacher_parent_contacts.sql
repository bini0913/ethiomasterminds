CREATE OR REPLACE FUNCTION public.school_teacher_parent_contacts(p_student_membership_id uuid)
RETURNS TABLE(parent_membership_id uuid, parent_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.school_memberships%ROWTYPE;
  v_teacher_id uuid;
BEGIN
  SELECT * INTO v_student
  FROM public.school_memberships
  WHERE id = p_student_membership_id
    AND school_role = 'student'
    AND status = 'active';

  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Active student not found';
  END IF;

  v_teacher_id := public.school_my_membership_id(v_student.school_id);
  IF v_teacher_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.school_teacher_assignments assignment
    WHERE assignment.teacher_membership_id = v_teacher_id
      AND assignment.section_id = v_student.section_id
  ) THEN
    RAISE EXCEPTION 'Teacher is not assigned to this student section';
  END IF;

  RETURN QUERY
  SELECT parent.id,
         coalesce(nullif(trim(profile.name), ''), profile.username, parent.school_username, 'Parent')::text
  FROM public.school_parent_student_links link
  JOIN public.school_memberships parent
    ON parent.id = link.parent_membership_id
   AND parent.school_id = link.school_id
  LEFT JOIN public.profiles profile ON profile.id = parent.user_id
  WHERE link.school_id = v_student.school_id
    AND link.student_membership_id = v_student.id
    AND link.status = 'active'
    AND parent.school_role = 'parent'
    AND parent.status = 'active'
  ORDER BY parent.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.school_teacher_parent_contacts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_teacher_parent_contacts(uuid) TO authenticated;
