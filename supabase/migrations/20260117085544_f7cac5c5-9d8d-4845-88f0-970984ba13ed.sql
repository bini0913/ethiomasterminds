-- Fix the overly permissive RLS policy for parent_notifications
DROP POLICY IF EXISTS "System can create notifications" ON public.parent_notifications;
CREATE POLICY "System can create notifications" ON public.parent_notifications FOR INSERT WITH CHECK (
  -- Allow if the user is the student being reported on, or a teacher of that student, or admin
  auth.uid() = student_id 
  OR is_teacher_of_student(auth.uid(), student_id)
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
);