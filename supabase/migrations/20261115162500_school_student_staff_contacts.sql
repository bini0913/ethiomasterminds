CREATE OR REPLACE FUNCTION public.school_student_school_contacts()
RETURNS TABLE(contact_membership_id uuid, contact_name text, contact_role text, subject_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_school_id uuid;
  v_section_id uuid;
BEGIN
  SELECT id, school_id, section_id INTO v_student_id, v_school_id, v_section_id
  FROM public.school_memberships
  WHERE user_id = auth.uid() AND school_role = 'student' AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  IF v_school_id IS NULL OR v_section_id IS NULL THEN
    RAISE EXCEPTION 'Active school student enrollment required';
  END IF;

  RETURN QUERY
  SELECT contact.id,
         coalesce(nullif(trim(profile.name), ''), profile.username, contact.school_username, 'Teacher')::text,
         contact.school_role::text,
         assignment.subject_name::text
  FROM public.school_teacher_assignments assignment
  JOIN public.school_memberships contact
    ON contact.id = assignment.teacher_membership_id
   AND contact.school_id = assignment.school_id
  LEFT JOIN public.profiles profile ON profile.id = contact.user_id
  WHERE assignment.school_id = v_school_id
    AND assignment.section_id = v_section_id
    AND contact.school_role = 'teacher'
    AND contact.status = 'active'
  UNION
  SELECT contact.id,
         coalesce(nullif(trim(profile.name), ''), profile.username, contact.school_username, 'School Admin')::text,
         contact.school_role::text,
         NULL::text
  FROM public.school_memberships contact
  LEFT JOIN public.profiles profile ON profile.id = contact.user_id
  WHERE contact.school_id = v_school_id
    AND contact.school_role = 'admin'
    AND contact.status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION public.school_student_school_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_student_school_contacts() TO authenticated;
