-- Complete division-director read paths for academic oversight.
-- Keep all access tied to the appointed division's configured grade mappings.
BEGIN;

CREATE OR REPLACE FUNCTION public.school_can_view_profile(p_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    public._is_extreme_admin()
    OR (public._is_super_admin() AND EXISTS (
      SELECT 1 FROM public.school_memberships target_profile_membership
      WHERE target_profile_membership.user_id = p_profile_id
        AND target_profile_membership.status IN ('active', 'suspended')
    ))
    OR EXISTS (
      SELECT 1
      FROM public.school_memberships staff
      JOIN public.school_memberships target ON target.school_id = staff.school_id
      WHERE staff.user_id = auth.uid()
        AND staff.status = 'active'
        AND staff.school_role IN ('manager', 'admin')
        AND target.user_id = p_profile_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_memberships target
      WHERE target.user_id = p_profile_id
        AND target.school_role IN ('admin', 'teacher', 'finance')
        AND target.status IN ('active', 'suspended')
        AND public.school_leadership_has_permission(target.school_id, 'view_staff', target.grade_label, target.id, target.section_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_memberships target
      WHERE target.user_id = p_profile_id
        AND target.school_role = 'student'
        AND target.status IN ('active', 'suspended')
        AND (
          public.school_leadership_has_permission(target.school_id, 'view_students', target.grade_label, target.id, target.section_id)
          OR public.school_leadership_has_permission(target.school_id, 'view_academics', target.grade_label, target.id, target.section_id)
          OR public.school_leadership_has_permission(target.school_id, 'review_results', target.grade_label, target.id, target.section_id)
          OR public.school_leadership_has_permission(target.school_id, 'view_discipline', target.grade_label, target.id, target.section_id)
          OR public.school_leadership_has_permission(target.school_id, 'review_discipline', target.grade_label, target.id, target.section_id)
          OR public.school_leadership_has_permission(target.school_id, 'view_attendance', target.grade_label, target.id, target.section_id)
          OR public.school_leadership_has_permission(target.school_id, 'review_attendance', target.grade_label, target.id, target.section_id)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_memberships teacher
      JOIN public.school_teacher_assignments assignment
        ON assignment.teacher_membership_id = teacher.id
       AND assignment.school_id = teacher.school_id
      JOIN public.school_memberships student
        ON student.school_id = teacher.school_id
       AND student.section_id = assignment.section_id
       AND student.school_role = 'student'
      WHERE teacher.user_id = auth.uid()
        AND teacher.school_role = 'teacher'
        AND teacher.status = 'active'
        AND student.user_id = p_profile_id
        AND student.status IN ('active', 'suspended')
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_parent_student_links link
      JOIN public.school_memberships parent ON parent.id = link.parent_membership_id
      JOIN public.school_memberships student ON student.id = link.student_membership_id
      WHERE parent.user_id = auth.uid()
        AND parent.school_role = 'parent'
        AND parent.status = 'active'
        AND link.status = 'active'
        AND student.user_id = p_profile_id
        AND student.status = 'active'
    )
  );
$function$;

ALTER POLICY school_leadership_view_scoped_memberships
ON public.school_memberships
USING (
  (
    school_role = 'student'
    AND (
      school_leadership_has_permission(school_id, 'view_students', grade_label, id, section_id)
      OR school_leadership_has_permission(school_id, 'view_discipline', grade_label, id, section_id)
      OR school_leadership_has_permission(school_id, 'review_discipline', grade_label, id, section_id)
      OR school_leadership_has_permission(school_id, 'view_attendance', grade_label, id, section_id)
      OR school_leadership_has_permission(school_id, 'review_attendance', grade_label, id, section_id)
      OR school_leadership_has_permission(school_id, 'view_academics', grade_label, id, section_id)
      OR school_leadership_has_permission(school_id, 'review_results', grade_label, id, section_id)
    )
  )
  OR (
    school_role = ANY (ARRAY['admin'::text, 'teacher'::text, 'finance'::text])
    AND (
      school_leadership_has_permission(school_id, 'view_staff', grade_label, id, section_id)
      OR school_leadership_has_permission(school_id, 'manage_team_tasks', grade_label, id, section_id)
      OR school_leadership_has_permission(school_id, 'assign_team_tasks', grade_label, id, section_id)
    )
  )
);

ALTER POLICY school_leadership_view_scoped_sections
ON public.school_sections
USING (
  school_leadership_has_permission(school_id, 'view_students', grade_label, NULL, id)
  OR school_leadership_has_permission(school_id, 'view_curriculum', grade_label, NULL, id)
  OR school_leadership_has_permission(school_id, 'review_assessments', grade_label, NULL, id)
  OR school_leadership_has_permission(school_id, 'view_attendance', grade_label, NULL, id)
  OR school_leadership_has_permission(school_id, 'review_attendance', grade_label, NULL, id)
  OR school_leadership_has_permission(school_id, 'view_discipline', grade_label, NULL, id)
  OR school_leadership_has_permission(school_id, 'review_discipline', grade_label, NULL, id)
  OR school_leadership_has_permission(school_id, 'view_academics', grade_label, NULL, id)
  OR school_leadership_has_permission(school_id, 'review_results', grade_label, NULL, id)
);

ALTER POLICY school_leadership_view_scoped_assessments
ON public.school_assessments
USING (
  school_leadership_has_permission(
    school_id, 'view_academics',
    (SELECT section.grade_label FROM public.school_sections section
     WHERE section.id = school_assessments.section_id AND section.school_id = school_assessments.school_id),
    NULL, section_id
  )
  OR school_leadership_has_permission(
    school_id, 'review_assessments',
    (SELECT section.grade_label FROM public.school_sections section
     WHERE section.id = school_assessments.section_id AND section.school_id = school_assessments.school_id),
    NULL, section_id
  )
  OR school_leadership_has_permission(
    school_id, 'review_results',
    (SELECT section.grade_label FROM public.school_sections section
     WHERE section.id = school_assessments.section_id AND section.school_id = school_assessments.school_id),
    NULL, section_id
  )
);

COMMIT;
