-- Let an active Division Director create staff accounts only inside their own mapped division.
-- Account creation remains service-role-only and is invoked by the authenticated provisioning edge function.

CREATE OR REPLACE FUNCTION public.school_attach_division_staff_account(
  p_actor_id uuid,
  p_school_id uuid,
  p_user_id uuid,
  p_school_username text,
  p_section_id uuid,
  p_subject_name text,
  p_assignment_kind text,
  p_position text,
  p_team_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_membership_id uuid;
  v_division text;
  v_grade_label text;
  v_academic_year_id uuid;
  v_membership_id uuid;
  v_team_name text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Trusted account provisioning service required';
  END IF;
  IF p_actor_id IS NULL OR p_school_id IS NULL OR p_user_id IS NULL
     OR nullif(btrim(p_school_username), '') IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Actor, school, account and username are required';
  END IF;
  IF p_position IS NULL OR p_position NOT IN ('teacher', 'team_leader') THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Division Directors can create Teachers or Team Leaders only';
  END IF;
  IF p_position = 'team_leader' THEN
    v_team_name := nullif(btrim(p_team_name), '');
    IF v_team_name IS NULL OR char_length(v_team_name) > 100 THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'A valid Team Leader team name is required';
    END IF;
  ELSE
    IF p_section_id IS NULL OR p_assignment_kind IS NULL OR p_assignment_kind NOT IN ('subject', 'homeroom')
       OR nullif(btrim(p_subject_name), '') IS NULL THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'Teacher class, subject and assignment type are required';
    END IF;
  END IF;

  SELECT membership.id, appointment.division_scope
    INTO v_actor_membership_id, v_division
  FROM public.school_memberships membership
  JOIN public.school_leadership_appointments appointment
    ON appointment.school_id = membership.school_id
   AND appointment.membership_id = membership.id
  WHERE membership.school_id = p_school_id
    AND membership.user_id = p_actor_id
    AND membership.school_role = 'teacher'
    AND membership.status = 'active'
    AND appointment.position IN ('kg_director', 'elementary_director', 'middle_school_director', 'high_school_director')
    AND appointment.status = 'active'
    AND appointment.start_date <= CURRENT_DATE
    AND (appointment.end_date IS NULL OR appointment.end_date >= CURRENT_DATE)
  ORDER BY appointment.created_at DESC
  LIMIT 1;
  IF v_actor_membership_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Only an active Division Director can create staff for this school';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id AND status = 'active') THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'School is not active';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND lower(username) = lower(btrim(p_school_username))
  ) THEN
    RAISE EXCEPTION USING errcode = '23514', message = 'The account username does not match its profile';
  END IF;
  IF EXISTS (SELECT 1 FROM public.school_memberships WHERE school_id = p_school_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION USING errcode = '23505', message = 'This person already has an account in the school';
  END IF;

  IF p_position = 'teacher' THEN
    SELECT section.grade_label, section.academic_year_id
      INTO v_grade_label, v_academic_year_id
    FROM public.school_sections section
    JOIN public.school_academic_years academic_year
      ON academic_year.id = section.academic_year_id
     AND academic_year.school_id = section.school_id
     AND academic_year.is_current = true
    JOIN public.school_division_grade_mappings mapping
      ON mapping.school_id = section.school_id
     AND mapping.grade_label = section.grade_label
     AND mapping.division_scope = v_division
    WHERE section.id = p_section_id AND section.school_id = p_school_id;
    IF v_grade_label IS NULL THEN
      RAISE EXCEPTION USING errcode = '42501', message = 'The selected class is not in the Director''s division or current academic year';
    END IF;
    IF p_assignment_kind = 'subject' AND NOT EXISTS (
      SELECT 1 FROM public.school_subjects subject
      WHERE subject.school_id = p_school_id
        AND subject.academic_year_id = v_academic_year_id
        AND subject.grade_label = v_grade_label
        AND subject.subject_name = btrim(p_subject_name)
        AND subject.active = true
    ) THEN
      RAISE EXCEPTION USING errcode = '23514', message = 'The selected subject is not active for this grade and academic year';
    END IF;
    IF p_assignment_kind = 'homeroom' AND EXISTS (
      SELECT 1 FROM public.school_teacher_assignments assignment
      WHERE assignment.school_id = p_school_id
        AND assignment.section_id = p_section_id
        AND assignment.assignment_kind = 'homeroom'
    ) THEN
      RAISE EXCEPTION USING errcode = '23505', message = 'This class already has a homeroom teacher';
    END IF;
  END IF;

  INSERT INTO public.school_memberships (
    school_id, user_id, school_role, status, school_username, created_by
  ) VALUES (
    p_school_id, p_user_id, 'teacher', 'active', lower(btrim(p_school_username)), p_actor_id
  )
  RETURNING id INTO v_membership_id;

  IF p_position = 'teacher' THEN
    INSERT INTO public.school_teacher_assignments (
      school_id, teacher_membership_id, section_id, subject_name, assignment_kind, created_by
    ) VALUES (
      p_school_id, v_membership_id, p_section_id, btrim(p_subject_name), p_assignment_kind, p_actor_id
    );
  ELSE
    INSERT INTO public.school_leadership_appointments (
      school_id, membership_id, position, division_scope, team_name,
      permissions, status, start_date, end_date, appointed_by_membership_id
    ) VALUES (
      p_school_id, v_membership_id, 'team_leader', v_division, v_team_name,
      ARRAY['view_students','view_staff','view_attendance','view_academics','view_curriculum','manage_team_tasks','assign_team_tasks','view_reports']::text[],
      'active', CURRENT_DATE, NULL, v_actor_membership_id
    );
  END IF;

  INSERT INTO public.school_leadership_structure_events (
    school_id, actor_user_id, actor_membership_id, event_type, details
  ) VALUES (
    p_school_id, p_actor_id, v_actor_membership_id,
    CASE WHEN p_position = 'team_leader' THEN 'team_leader_account_created' ELSE 'teacher_account_created' END,
    jsonb_build_object(
      'membership_id', v_membership_id,
      'position', p_position,
      'division_scope', v_division,
      'section_id', p_section_id,
      'assignment_kind', p_assignment_kind
    )
  );
  RETURN v_membership_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.school_attach_division_staff_account(uuid,uuid,uuid,text,uuid,text,text,text,text) TO service_role;
