-- Prevent a teacher's "All My Students" announcements from becoming visible
-- to every student in the platform. Admin and manager visibility remains
-- covered by the policy's existing staff branches.
DROP POLICY IF EXISTS "users view targeted announcements" ON public.announcements;

CREATE POLICY "users view targeted announcements"
ON public.announcements FOR SELECT TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public._is_extreme_admin()
  OR target_type = 'all'
  OR (
    target_type = 'students'
    AND public.has_role(auth.uid(), 'student'::public.app_role)
    AND public.is_teacher_of_student(author_id, auth.uid())
  )
  OR (target_type = 'teachers' AND public.has_role(auth.uid(), 'teacher'::public.app_role))
  OR target_id = auth.uid()
  OR (
    target_type = 'class'
    AND public.is_student_in_class(auth.uid(), target_id)
  )
);
