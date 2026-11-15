-- Harden the teacher/student workspace boundaries.
-- Direct student class insertion is intentionally removed until a verified
-- join_class_by_code RPC is deployed.

-- Classes must be visible only to their teacher, enrolled students, or staff.
DROP POLICY IF EXISTS "authenticated can view classes" ON public.classes;
DROP POLICY IF EXISTS "Students can view classes they belong to" ON public.classes;
CREATE POLICY "involved users can view classes"
ON public.classes FOR SELECT TO authenticated
USING (
  teacher_id = auth.uid()
  OR public.is_student_in_class(auth.uid(), id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public._is_extreme_admin()
);

-- Students may read their own membership; only the owning teacher/staff may
-- add or remove memberships. A future class-code RPC will perform the join.
DROP POLICY IF EXISTS "student can join class" ON public.class_students;
DROP POLICY IF EXISTS "Students can view own class membership" ON public.class_students;
DROP POLICY IF EXISTS "involved can view class_students" ON public.class_students;
DROP POLICY IF EXISTS "teacher manages class_students" ON public.class_students;
DROP POLICY IF EXISTS "Teachers can manage class students" ON public.class_students;
CREATE POLICY "students can view own class membership"
ON public.class_students FOR SELECT TO authenticated
USING (student_id = auth.uid());
CREATE POLICY "teachers manage their class memberships"
ON public.class_students FOR ALL TO authenticated
USING (
  public.is_teacher_of_class(auth.uid(), class_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public._is_extreme_admin()
)
WITH CHECK (
  public.is_teacher_of_class(auth.uid(), class_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public._is_extreme_admin()
);

-- An assignment may only be created/changed by the teacher who owns both the
-- target class and the quiz, or by staff. This prevents cross-teacher forged
-- assignments through the direct table API.
DROP POLICY IF EXISTS "teacher manages assignment" ON public.quiz_assignments;
DROP POLICY IF EXISTS "Teachers can manage assignments" ON public.quiz_assignments;
CREATE POLICY "teachers manage owned quiz assignments"
ON public.quiz_assignments FOR ALL TO authenticated
USING (
  (
    assigned_by = auth.uid()
    AND (class_id IS NULL OR public.is_teacher_of_class(auth.uid(), class_id))
    AND EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.created_by = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public._is_extreme_admin()
)
WITH CHECK (
  (
    assigned_by = auth.uid()
    AND (class_id IS NULL OR public.is_teacher_of_class(auth.uid(), class_id))
    AND EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.created_by = auth.uid()
    )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public._is_extreme_admin()
);

-- A teacher may see results for quizzes they own or for students enrolled in a
-- class where that quiz was assigned. They must not receive all student data.
CREATE OR REPLACE FUNCTION public.can_teacher_view_quiz_result(
  p_quiz_id uuid,
  p_student_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public._is_extreme_admin()
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = p_quiz_id AND q.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.quiz_assignments qa
      JOIN public.classes c ON c.id = qa.class_id
      JOIN public.class_students cs ON cs.class_id = c.id
      WHERE qa.quiz_id = p_quiz_id
        AND c.teacher_id = auth.uid()
        AND cs.student_id = p_student_id
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_teacher_view_quiz_result(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_teacher_view_quiz_result(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "student views own results" ON public.quiz_results;
DROP POLICY IF EXISTS "Students can manage own results" ON public.quiz_results;
DROP POLICY IF EXISTS "Teachers can view class results" ON public.quiz_results;
CREATE POLICY "students manage own quiz results"
ON public.quiz_results FOR ALL TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());
CREATE POLICY "teachers view authorized quiz results"
ON public.quiz_results FOR SELECT TO authenticated
USING (public.can_teacher_view_quiz_result(quiz_id, student_id));

-- Keep announcements visible only to their intended audience.
DROP POLICY IF EXISTS "authenticated can view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Users can view relevant announcements" ON public.announcements;
CREATE POLICY "users view targeted announcements"
ON public.announcements FOR SELECT TO authenticated
USING (
  author_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
  OR public._is_extreme_admin()
  OR target_type = 'all'
  OR (target_type = 'students' AND public.has_role(auth.uid(), 'student'::public.app_role))
  OR (target_type = 'teachers' AND public.has_role(auth.uid(), 'teacher'::public.app_role))
  OR target_id = auth.uid()
  OR (
    target_type = 'class'
    AND public.is_student_in_class(auth.uid(), target_id)
  )
);

-- Student search is a teacher/staff operation used by TeacherPortal. Prevent
-- arbitrary authenticated users from enumerating the student directory.
CREATE OR REPLACE FUNCTION public.find_student_by_username(_username text)
RETURNS TABLE(id uuid, name text, username text, avatar text, level integer, xp integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public._is_extreme_admin()
  ) THEN
    RAISE EXCEPTION 'Teacher or staff role required';
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.username, p.avatar, p.level, p.xp
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'student'::public.app_role
    AND (
      lower(coalesce(p.username, '')) LIKE '%' || lower(trim(_username)) || '%'
      OR lower(coalesce(p.name, '')) LIKE '%' || lower(trim(_username)) || '%'
    )
  ORDER BY CASE WHEN lower(coalesce(p.username, '')) = lower(trim(_username)) THEN 0 ELSE 1 END, p.username
  LIMIT 20;
END;
$$;
REVOKE ALL ON FUNCTION public.find_student_by_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_student_by_username(text) TO authenticated;
