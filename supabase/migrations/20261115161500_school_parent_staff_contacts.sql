CREATE OR REPLACE FUNCTION public.school_parent_school_contacts(p_student_membership_id uuid)
RETURNS TABLE(contact_membership_id uuid, contact_name text, contact_role text, subject_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.school_memberships%ROWTYPE;
  v_parent_id uuid;
BEGIN
  SELECT * INTO v_student
  FROM public.school_memberships
  WHERE id = p_student_membership_id
    AND school_role = 'student'
    AND status = 'active';

  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Active student not found';
  END IF;

  v_parent_id := public.school_my_membership_id(v_student.school_id);
  IF v_parent_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.school_parent_student_links link
       WHERE link.school_id = v_student.school_id
         AND link.parent_membership_id = v_parent_id
         AND link.student_membership_id = v_student.id
         AND link.status = 'active'
     ) THEN
    RAISE EXCEPTION 'Parent account is not linked to this student';
  END IF;

  RETURN QUERY
  SELECT contact.id,
         coalesce(nullif(trim(profile.name), ''), profile.username, contact.school_username, 'School contact')::text,
         contact.school_role::text,
         assignment.subject_name::text
  FROM public.school_teacher_assignments assignment
  JOIN public.school_memberships contact
    ON contact.id = assignment.teacher_membership_id
   AND contact.school_id = v_student.school_id
  LEFT JOIN public.profiles profile ON profile.id = contact.user_id
  WHERE assignment.school_id = v_student.school_id
    AND assignment.section_id = v_student.section_id
    AND contact.school_role = 'teacher'
    AND contact.status = 'active'
  UNION
  SELECT contact.id,
         coalesce(nullif(trim(profile.name), ''), profile.username, contact.school_username, 'School Admin')::text,
         contact.school_role::text,
         NULL::text
  FROM public.school_memberships contact
  LEFT JOIN public.profiles profile ON profile.id = contact.user_id
  WHERE contact.school_id = v_student.school_id
    AND contact.school_role = 'admin'
    AND contact.status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.school_parent_school_contacts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_parent_school_contacts(uuid) TO authenticated;
