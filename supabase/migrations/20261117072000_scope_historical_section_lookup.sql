-- Keep the historical section helper available to authenticated RLS callers,
-- but prevent arbitrary membership-history probing across schools.
CREATE OR REPLACE FUNCTION public.school_student_was_in_section_for_term(
  p_student_membership_id uuid,
  p_section_id uuid,
  p_term_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_student_section_history history
    JOIN public.school_terms term
      ON term.id = p_term_id
     AND term.school_id = history.school_id
    JOIN public.school_memberships student
      ON student.id = history.student_membership_id
     AND student.school_id = history.school_id
     AND student.school_role = 'student'
    WHERE history.student_membership_id = p_student_membership_id
      AND history.section_id = p_section_id
      AND history.effective_from <= term.ends_on
      AND (history.effective_to IS NULL OR history.effective_to >= term.starts_on)
      AND (
        student.user_id = auth.uid()
        OR public.is_school_manager_or_admin(history.school_id)
        OR EXISTS (
          SELECT 1
          FROM public.school_parent_student_links link
          JOIN public.school_memberships parent
            ON parent.id = link.parent_membership_id
           AND parent.school_id = link.school_id
          WHERE link.student_membership_id = student.id
            AND link.school_id = history.school_id
            AND link.status = 'active'
            AND parent.user_id = auth.uid()
            AND parent.school_role = 'parent'
            AND parent.status = 'active'
        )
        OR EXISTS (
          SELECT 1
          FROM public.school_teacher_assignments assignment
          WHERE assignment.teacher_membership_id = public.school_my_membership_id(history.school_id)
            AND assignment.section_id = p_section_id
        )
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.school_student_was_in_section_for_term(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_student_was_in_section_for_term(uuid, uuid, uuid) TO authenticated;
