-- Align teacher behavior reporting with the portal's supported report types and homeroom scope.

ALTER TABLE public.school_behavior_reports
  DROP CONSTRAINT IF EXISTS school_behavior_reports_report_type_check;

ALTER TABLE public.school_behavior_reports
  ADD CONSTRAINT school_behavior_reports_report_type_check
  CHECK (report_type IN ('positive', 'concern', 'incident', 'academic_integrity'));

CREATE OR REPLACE FUNCTION public.school_can_submit_behavior_report(p_student_membership_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_memberships student
    JOIN public.school_teacher_assignments assignment
      ON assignment.section_id = student.section_id
     AND assignment.school_id = student.school_id
    JOIN public.school_memberships teacher
      ON teacher.id = assignment.teacher_membership_id
    WHERE student.id = p_student_membership_id
      AND student.school_role = 'student'
      AND student.status IN ('active', 'suspended')
      AND teacher.user_id = auth.uid()
      AND teacher.school_role = 'teacher'
      AND teacher.status = 'active'
      AND assignment.assignment_kind IN ('subject', 'homeroom')
  );
$$;

REVOKE ALL ON FUNCTION public.school_can_submit_behavior_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_submit_behavior_report(uuid) TO authenticated;
