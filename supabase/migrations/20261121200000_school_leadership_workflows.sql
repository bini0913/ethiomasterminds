-- Role-specific School Leadership actions and strict Main Director authority.
-- Leadership appointments remain school memberships; no new global roles are introduced.

CREATE OR REPLACE FUNCTION public.school_is_admin(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public._is_extreme_admin()
    OR EXISTS (
      SELECT 1
      FROM public.school_memberships membership
      JOIN public.school_leadership_appointments appointment
        ON appointment.school_id = membership.school_id
       AND appointment.membership_id = membership.id
      WHERE membership.school_id = p_school_id
        AND membership.user_id = auth.uid()
        AND membership.school_role = 'admin'
        AND membership.status = 'active'
        AND appointment.position = 'main_director'
        AND appointment.status = 'active'
        AND appointment.start_date <= CURRENT_DATE
        AND (appointment.end_date IS NULL OR appointment.end_date >= CURRENT_DATE)
    );
$$;

REVOKE ALL ON FUNCTION public.school_is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_is_admin(uuid) TO authenticated;

-- Main Director / Vice Director / Division Director approvals are authorized
-- by the active appointment and exact section/grade scope, not global role.
CREATE OR REPLACE FUNCTION public.school_review_assessment(
  p_assessment_id uuid,
  p_approve boolean,
  p_feedback text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_school_id uuid;
  v_section_id uuid;
  v_grade_label text;
BEGIN
  SELECT assessment.school_id, assessment.section_id, section.grade_label
  INTO v_school_id, v_section_id, v_grade_label
  FROM public.school_assessments assessment
  LEFT JOIN public.school_sections section
    ON section.id = assessment.section_id
   AND section.school_id = assessment.school_id
  WHERE assessment.id = p_assessment_id
  FOR UPDATE OF assessment;

  IF v_school_id IS NULL OR NOT (
    public.school_is_admin(v_school_id)
    OR public.school_leadership_has_permission(
      v_school_id, 'review_assessments', v_grade_label, NULL, v_section_id
    )
  ) THEN
    RAISE EXCEPTION 'An authorized school academic leader is required to review this assessment';
  END IF;

  PERFORM set_config('app.school_assessment_transition', 'review', true);
  UPDATE public.school_assessments
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_feedback = nullif(trim(p_feedback), ''),
      updated_at = now()
  WHERE id = p_assessment_id AND status = 'submitted';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only submitted assessments can be reviewed'; END IF;

  UPDATE public.school_student_marks
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      updated_at = now()
  WHERE assessment_id = p_assessment_id AND status = 'submitted';
  PERFORM set_config('app.school_assessment_transition', '', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_review_homework(
  p_homework_id uuid,
  p_approved boolean,
  p_feedback text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_homework public.school_homework_assignments%ROWTYPE;
  v_grade_label text;
  v_reviewer uuid;
BEGIN
  SELECT * INTO v_homework
  FROM public.school_homework_assignments
  WHERE id = p_homework_id
  FOR UPDATE;

  SELECT section.grade_label INTO v_grade_label
  FROM public.school_sections section
  WHERE section.id = v_homework.section_id
    AND section.school_id = v_homework.school_id;

  IF v_homework.id IS NULL OR v_homework.status <> 'pending'
     OR NOT (
       public.school_is_admin(v_homework.school_id)
       OR public.school_leadership_has_permission(
         v_homework.school_id, 'review_assessments', v_grade_label, NULL, v_homework.section_id
       )
     ) THEN
    RAISE EXCEPTION 'An authorized school academic leader is required to review pending homework';
  END IF;

  v_reviewer := public.school_my_membership_id(v_homework.school_id);
  PERFORM set_config('app.school_homework_review', 'true', true);
  UPDATE public.school_homework_assignments
  SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      review_feedback = nullif(trim(p_feedback), ''),
      reviewed_by_membership_id = v_reviewer,
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_homework_id;
  PERFORM set_config('app.school_homework_review', '', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_can_review_behavior_report(p_report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_behavior_reports report
    LEFT JOIN public.school_sections section
      ON section.id = report.section_id
     AND section.school_id = report.school_id
    WHERE report.id = p_report_id
      AND (
        public.school_is_admin(report.school_id)
        OR public.school_is_homeroom_teacher(report.school_id, report.section_id)
        OR public.school_leadership_has_permission(
          report.school_id, 'review_discipline', section.grade_label,
          report.student_membership_id, report.section_id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_review_announcement(
  p_announcement_id uuid,
  p_approved boolean,
  p_feedback text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_announcement public.school_announcements%ROWTYPE;
  v_reviewer uuid;
BEGIN
  SELECT * INTO v_announcement
  FROM public.school_announcements
  WHERE id = p_announcement_id
  FOR UPDATE;

  IF v_announcement.id IS NULL OR v_announcement.status <> 'pending'
     OR NOT (
       public.school_is_admin(v_announcement.school_id)
       OR public.school_leadership_has_permission(
         v_announcement.school_id, 'publish_announcements',
         v_announcement.grade_label, NULL, v_announcement.section_id
       )
     ) THEN
    RAISE EXCEPTION 'An authorized school leader is required to review this announcement';
  END IF;

  v_reviewer := public.school_my_membership_id(v_announcement.school_id);
  PERFORM set_config('app.school_announcement_transition', 'review', true);
  UPDATE public.school_announcements
  SET status = CASE WHEN p_approved THEN 'published' ELSE 'rejected' END,
      reviewed_by_membership_id = v_reviewer,
      reviewed_at = now(),
      published_at = CASE WHEN p_approved THEN now() ELSE NULL END,
      review_feedback = nullif(trim(p_feedback), '')
  WHERE id = p_announcement_id;
  PERFORM set_config('app.school_announcement_transition', '', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_review_quiz(
  p_quiz_id uuid,
  p_approved boolean,
  p_feedback text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quiz public.quizzes%ROWTYPE;
  v_reviewer_id uuid;
BEGIN
  SELECT * INTO v_quiz FROM public.quizzes WHERE id = p_quiz_id FOR UPDATE;
  IF v_quiz.id IS NULL OR v_quiz.school_id IS NULL
     OR v_quiz.school_review_status <> 'pending'
     OR NOT (
       public.school_is_admin(v_quiz.school_id)
       OR public.school_leadership_has_permission(
         v_quiz.school_id, 'review_assessments', v_quiz.grade,
         NULL, v_quiz.school_section_id
       )
     ) THEN
    RAISE EXCEPTION 'An authorized school academic leader is required to review this quiz';
  END IF;

  v_reviewer_id := public.school_my_membership_id(v_quiz.school_id);
  IF v_reviewer_id IS NULL AND NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'An active school membership is required';
  END IF;

  PERFORM set_config('app.school_quiz_transition', 'review', true);
  UPDATE public.quizzes
  SET school_review_status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      is_approved = p_approved,
      approved_by = auth.uid(),
      approved_at = now(),
      school_review_feedback = nullif(trim(p_feedback), '')
  WHERE id = p_quiz_id;
  PERFORM set_config('app.school_quiz_transition', '', true);

  IF v_reviewer_id IS NOT NULL THEN
    INSERT INTO public.school_content_review_events(
      school_id, content_type, content_id, submitted_by_membership_id,
      reviewed_by_membership_id, review_status, feedback
    ) VALUES (
      v_quiz.school_id, 'quiz', v_quiz.id, v_quiz.school_teacher_membership_id,
      v_reviewer_id, CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      nullif(trim(p_feedback), '')
    );
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_review_library_book(
  p_book_id uuid,
  p_approved boolean,
  p_feedback text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_book public.library_books%ROWTYPE;
  v_reviewer_id uuid;
BEGIN
  SELECT * INTO v_book FROM public.library_books WHERE id = p_book_id FOR UPDATE;
  IF v_book.id IS NULL OR v_book.school_id IS NULL
     OR v_book.school_review_status <> 'pending'
     OR NOT (
       public.school_is_admin(v_book.school_id)
       OR public.school_leadership_has_permission(
         v_book.school_id, 'review_assessments', v_book.grade,
         NULL, v_book.school_section_id
       )
     ) THEN
    RAISE EXCEPTION 'An authorized school academic leader is required to review this library item';
  END IF;

  v_reviewer_id := public.school_my_membership_id(v_book.school_id);
  IF v_reviewer_id IS NULL AND NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'An active school membership is required';
  END IF;

  PERFORM set_config('app.school_book_transition', 'review', true);
  UPDATE public.library_books
  SET school_review_status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END
  WHERE id = p_book_id;
  UPDATE public.book_uploads
  SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      school_review_status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      moderated_by = auth.uid(),
      moderated_at = now(),
      moderation_note = nullif(trim(p_feedback), ''),
      updated_at = now()
  WHERE book_id = p_book_id;
  PERFORM set_config('app.school_book_transition', '', true);

  IF v_reviewer_id IS NOT NULL THEN
    INSERT INTO public.school_content_review_events(
      school_id, content_type, content_id, submitted_by_membership_id,
      reviewed_by_membership_id, review_status, feedback
    ) VALUES (
      v_book.school_id, 'library_book', v_book.id, v_book.school_teacher_membership_id,
      v_reviewer_id, CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      nullif(trim(p_feedback), '')
    );
  END IF;
  RETURN true;
END;
$$;

-- Team Leaders and Division Directors may assign tasks only to staff in their
-- appointment scope. The trigger remains the final authorization boundary.
CREATE OR REPLACE FUNCTION public.school_validate_staff_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_actor_role text;
  v_target_role text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_actor := public.school_my_membership_id(NEW.school_id);
    SELECT school_role INTO v_actor_role FROM public.school_memberships WHERE id = v_actor;
    SELECT school_role INTO v_target_role FROM public.school_memberships
    WHERE id = NEW.assigned_to_membership_id
      AND school_id = NEW.school_id
      AND status = 'active';

    IF v_actor IS NULL OR NEW.assigned_by_membership_id <> v_actor OR v_target_role IS NULL THEN
      RAISE EXCEPTION 'Task creator and assignee must be active school members';
    END IF;
    IF v_actor_role = 'manager' THEN
      IF v_target_role NOT IN ('admin', 'teacher', 'finance') THEN
        RAISE EXCEPTION 'Manager tasks may be assigned to Admin, Teacher, or Finance staff';
      END IF;
    ELSIF v_actor_role = 'admin' THEN
      IF v_target_role <> 'teacher' OR NEW.task_type <> 'academic' THEN
        RAISE EXCEPTION 'Main Director can assign academic tasks to teachers only';
      END IF;
    ELSIF public.school_leadership_has_permission(
      NEW.school_id, 'assign_team_tasks', NULL, NEW.assigned_to_membership_id, NULL
    ) THEN
      IF v_target_role <> 'teacher' OR NEW.task_type <> 'academic' THEN
        RAISE EXCEPTION 'Appointed school leaders can assign academic tasks to teachers in their scope only';
      END IF;
    ELSE
      RAISE EXCEPTION 'Only the School Manager, Main Director, or an appointed leader with task permission can assign staff tasks';
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(NEW.school_id, NEW.assigned_to_membership_id, NEW.assigned_by_membership_id,
         NEW.task_type, NEW.title, NEW.description, NEW.priority, NEW.due_date, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.school_id, OLD.assigned_to_membership_id, OLD.assigned_by_membership_id,
         OLD.task_type, OLD.title, OLD.description, OLD.priority, OLD.due_date, OLD.created_at) THEN
    RAISE EXCEPTION 'Task assignment details are immutable after creation';
  END IF;

  v_actor := public.school_my_membership_id(OLD.school_id);
  SELECT school_role INTO v_actor_role FROM public.school_memberships WHERE id = v_actor;

  IF v_actor = OLD.assigned_to_membership_id THEN
    IF NEW.status NOT IN ('in_progress', 'submitted')
       OR OLD.status NOT IN ('open', 'in_progress', 'returned')
       OR NEW.verified_by_membership_id IS DISTINCT FROM OLD.verified_by_membership_id
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
      RAISE EXCEPTION 'Assigned staff can only start or submit their task';
    END IF;
    IF NEW.status = 'submitted' THEN NEW.submitted_at := now(); END IF;
  ELSIF v_actor = OLD.assigned_by_membership_id
        AND (
          v_actor_role IN ('manager', 'admin')
          OR public.school_leadership_has_permission(
            OLD.school_id, 'assign_team_tasks', NULL, OLD.assigned_to_membership_id, NULL
          )
        ) THEN
    IF NEW.status NOT IN ('verified', 'returned', 'cancelled')
       OR OLD.status NOT IN ('submitted', 'open', 'in_progress', 'returned') THEN
      RAISE EXCEPTION 'Task assigner can verify, return, or cancel the task';
    END IF;
    IF NEW.status = 'verified' THEN
      NEW.verified_by_membership_id := v_actor;
      NEW.verified_at := now();
    END IF;
  ELSE
    RAISE EXCEPTION 'Only the assigned staff member or authorized task assigner can update this task';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.school_review_assessment(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_review_assessment(uuid, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.school_review_homework(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_review_homework(uuid, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.school_can_review_behavior_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_review_behavior_report(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.school_review_announcement(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_review_announcement(uuid, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.school_review_quiz(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_review_quiz(uuid, boolean, text) TO authenticated;
REVOKE ALL ON FUNCTION public.school_review_library_book(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_review_library_book(uuid, boolean, text) TO authenticated;


-- Read policies must permit the same scoped leader who can perform the review
-- to load the record and the associated grade/section labels.
DROP POLICY IF EXISTS school_leadership_view_scoped_memberships ON public.school_memberships;
CREATE POLICY school_leadership_view_scoped_memberships
  ON public.school_memberships
  FOR SELECT TO authenticated
  USING (
    (
      school_memberships.school_role = 'student'
      AND (
        public.school_leadership_has_permission(school_memberships.school_id, 'view_students', school_memberships.grade_label, school_memberships.id, school_memberships.section_id)
        OR public.school_leadership_has_permission(school_memberships.school_id, 'view_discipline', school_memberships.grade_label, school_memberships.id, school_memberships.section_id)
        OR public.school_leadership_has_permission(school_memberships.school_id, 'review_discipline', school_memberships.grade_label, school_memberships.id, school_memberships.section_id)
        OR public.school_leadership_has_permission(school_memberships.school_id, 'view_attendance', school_memberships.grade_label, school_memberships.id, school_memberships.section_id)
        OR public.school_leadership_has_permission(school_memberships.school_id, 'review_attendance', school_memberships.grade_label, school_memberships.id, school_memberships.section_id)
      )
    )
    OR (
      school_memberships.school_role IN ('admin', 'teacher', 'finance')
      AND public.school_leadership_has_permission(
        school_memberships.school_id, 'view_staff', school_memberships.grade_label,
        school_memberships.id, school_memberships.section_id
      )
    )
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_sections ON public.school_sections;
CREATE POLICY school_leadership_view_scoped_sections
  ON public.school_sections
  FOR SELECT TO authenticated
  USING (
    public.school_leadership_has_permission(school_sections.school_id, 'view_students', school_sections.grade_label, NULL, school_sections.id)
    OR public.school_leadership_has_permission(school_sections.school_id, 'view_curriculum', school_sections.grade_label, NULL, school_sections.id)
    OR public.school_leadership_has_permission(school_sections.school_id, 'review_assessments', school_sections.grade_label, NULL, school_sections.id)
    OR public.school_leadership_has_permission(school_sections.school_id, 'view_attendance', school_sections.grade_label, NULL, school_sections.id)
    OR public.school_leadership_has_permission(school_sections.school_id, 'review_attendance', school_sections.grade_label, NULL, school_sections.id)
    OR public.school_leadership_has_permission(school_sections.school_id, 'view_discipline', school_sections.grade_label, NULL, school_sections.id)
    OR public.school_leadership_has_permission(school_sections.school_id, 'review_discipline', school_sections.grade_label, NULL, school_sections.id)
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_attendance_sessions ON public.school_attendance_sessions;
CREATE POLICY school_leadership_view_scoped_attendance_sessions
  ON public.school_attendance_sessions
  FOR SELECT TO authenticated
  USING (
    public.school_leadership_has_permission(
      school_attendance_sessions.school_id, 'view_attendance',
      (SELECT section.grade_label FROM public.school_sections section
       WHERE section.id = school_attendance_sessions.section_id
         AND section.school_id = school_attendance_sessions.school_id),
      NULL, school_attendance_sessions.section_id
    )
    OR public.school_leadership_has_permission(
      school_attendance_sessions.school_id, 'review_attendance',
      (SELECT section.grade_label FROM public.school_sections section
       WHERE section.id = school_attendance_sessions.section_id
         AND section.school_id = school_attendance_sessions.school_id),
      NULL, school_attendance_sessions.section_id
    )
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_attendance_records ON public.school_attendance_records;
CREATE POLICY school_leadership_view_scoped_attendance_records
  ON public.school_attendance_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.school_attendance_sessions session
      JOIN public.school_sections section
        ON section.id = session.section_id
       AND section.school_id = session.school_id
      WHERE session.id = school_attendance_records.session_id
        AND session.school_id = school_attendance_records.school_id
        AND (
          public.school_leadership_has_permission(
            school_attendance_records.school_id, 'view_attendance', section.grade_label,
            school_attendance_records.student_membership_id, session.section_id
          )
          OR public.school_leadership_has_permission(
            school_attendance_records.school_id, 'review_attendance', section.grade_label,
            school_attendance_records.student_membership_id, session.section_id
          )
        )
    )
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_behavior_reports ON public.school_behavior_reports;
CREATE POLICY school_leadership_view_scoped_behavior_reports
  ON public.school_behavior_reports
  FOR SELECT TO authenticated
  USING (
    public.school_leadership_has_permission(
      school_behavior_reports.school_id, 'view_discipline',
      (SELECT section.grade_label FROM public.school_sections section
       WHERE section.id = school_behavior_reports.section_id
         AND section.school_id = school_behavior_reports.school_id),
      school_behavior_reports.student_membership_id,
      school_behavior_reports.section_id
    )
    OR public.school_leadership_has_permission(
      school_behavior_reports.school_id, 'review_discipline',
      (SELECT section.grade_label FROM public.school_sections section
       WHERE section.id = school_behavior_reports.section_id
         AND section.school_id = school_behavior_reports.school_id),
      school_behavior_reports.student_membership_id,
      school_behavior_reports.section_id
    )
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_homework ON public.school_homework_assignments;
CREATE POLICY school_leadership_view_scoped_homework
  ON public.school_homework_assignments
  FOR SELECT TO authenticated
  USING (
    public.school_leadership_has_permission(
      school_homework_assignments.school_id, 'view_academics',
      (SELECT section.grade_label FROM public.school_sections section
       WHERE section.id = school_homework_assignments.section_id
         AND section.school_id = school_homework_assignments.school_id),
      NULL, school_homework_assignments.section_id
    )
    OR public.school_leadership_has_permission(
      school_homework_assignments.school_id, 'review_assessments',
      (SELECT section.grade_label FROM public.school_sections section
       WHERE section.id = school_homework_assignments.section_id
         AND section.school_id = school_homework_assignments.school_id),
      NULL, school_homework_assignments.section_id
    )
  );
