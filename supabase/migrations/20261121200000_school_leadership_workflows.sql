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

CREATE OR REPLACE FUNCTION public.school_update_leadership_permissions(
  p_appointment_id uuid,
  p_permissions text[],
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appointment public.school_leadership_appointments%ROWTYPE;
  v_actor public.school_memberships%ROWTYPE;
  v_allowed_permissions text[] := ARRAY[
    'view_students', 'view_staff', 'view_attendance', 'review_attendance',
    'view_academics', 'review_assessments', 'review_results', 'view_curriculum',
    'manage_team_tasks', 'assign_team_tasks', 'view_reports', 'publish_announcements',
    'view_discipline', 'review_discipline', 'view_finance_summary', 'manage_meetings'
  ]::text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_appointment
  FROM public.school_leadership_appointments
  WHERE id = p_appointment_id
  FOR UPDATE;
  IF v_appointment.id IS NULL THEN RAISE EXCEPTION 'Leadership appointment not found'; END IF;

  SELECT * INTO v_actor
  FROM public.school_memberships
  WHERE school_id = v_appointment.school_id
    AND user_id = auth.uid()
    AND school_role = 'manager'
    AND status = 'active'
  LIMIT 1;
  IF v_actor.id IS NULL THEN RAISE EXCEPTION 'Only the School Manager can change leadership permissions'; END IF;
  IF v_appointment.position = 'main_director' THEN
    RAISE EXCEPTION 'The Main Director retains the full School Admin authority; suspend or end the appointment to revoke access';
  END IF;
  IF v_appointment.status = 'ended' THEN
    RAISE EXCEPTION 'Ended appointments are historical; create a new appointment to change permissions';
  END IF;
  IF NOT (COALESCE(p_permissions, ARRAY[]::text[]) <@ v_allowed_permissions) THEN
    RAISE EXCEPTION 'One or more permissions are not supported';
  END IF;
  IF nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required when changing leadership permissions';
  END IF;

  UPDATE public.school_leadership_appointments
  SET permissions = COALESCE(p_permissions, ARRAY[]::text[]),
      change_reason = trim(p_reason),
      updated_at = now()
  WHERE id = p_appointment_id;
  RETURN true;
END;
$$;


CREATE OR REPLACE FUNCTION public.school_require_full_main_director_permissions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_required_permissions text[] := ARRAY[
    'view_students', 'view_staff', 'view_attendance', 'review_attendance',
    'view_academics', 'review_assessments', 'review_results', 'view_curriculum',
    'manage_team_tasks', 'assign_team_tasks', 'view_reports', 'publish_announcements',
    'view_discipline', 'review_discipline', 'view_finance_summary', 'manage_meetings'
  ]::text[];
BEGIN
  IF NEW.position = 'main_director'
     AND NOT (v_required_permissions <@ COALESCE(NEW.permissions, ARRAY[]::text[])) THEN
    RAISE EXCEPTION 'The Main Director must retain the complete School Admin permission set';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_require_full_main_director_permissions
  ON public.school_leadership_appointments;
CREATE TRIGGER school_require_full_main_director_permissions
  BEFORE INSERT OR UPDATE OF position, permissions
  ON public.school_leadership_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.school_require_full_main_director_permissions();

REVOKE ALL ON FUNCTION public.school_update_leadership_permissions(uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_update_leadership_permissions(uuid, text[], text) TO authenticated;


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
         v_book.school_id, 'review_assessments', v_book.school_grade_label,
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
  v_appointment_id uuid;
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
    ELSIF v_actor_role = 'admin' AND public.school_is_admin(NEW.school_id) THEN
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

    SELECT appointment.id INTO v_appointment_id
    FROM public.school_leadership_appointments appointment
    WHERE appointment.school_id = NEW.school_id
      AND appointment.membership_id = v_actor
      AND appointment.status = 'active'
      AND appointment.start_date <= CURRENT_DATE
      AND (appointment.end_date IS NULL OR appointment.end_date >= CURRENT_DATE)
    LIMIT 1;
    IF v_appointment_id IS NOT NULL THEN
      INSERT INTO public.school_leadership_action_events (
        school_id, appointment_id, actor_user_id, actor_membership_id,
        action_type, target_table, target_id, reason, after_state
      ) VALUES (
        NEW.school_id, v_appointment_id, auth.uid(), v_actor,
        'task_assigned', 'school_staff_tasks', NEW.id,
        'Assigned academic task: ' || NEW.title, to_jsonb(NEW)
      );
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
  SELECT appointment.id INTO v_appointment_id
  FROM public.school_leadership_appointments appointment
  WHERE appointment.school_id = OLD.school_id
    AND appointment.membership_id = v_actor
    AND appointment.status = 'active'
    AND appointment.start_date <= CURRENT_DATE
    AND (appointment.end_date IS NULL OR appointment.end_date >= CURRENT_DATE)
  LIMIT 1;

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
          v_actor_role = 'manager'
          OR public.school_is_admin(OLD.school_id)
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
  IF v_appointment_id IS NOT NULL AND v_actor = OLD.assigned_by_membership_id THEN
    INSERT INTO public.school_leadership_action_events (
      school_id, appointment_id, actor_user_id, actor_membership_id,
      action_type, target_table, target_id, reason, before_state, after_state
    ) VALUES (
      OLD.school_id, v_appointment_id, auth.uid(), v_actor,
      'task_reviewed', 'school_staff_tasks', OLD.id,
      'Task status changed to ' || NEW.status, to_jsonb(OLD), to_jsonb(NEW)
    );
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
      AND (
        public.school_leadership_has_permission(
          school_memberships.school_id, 'view_staff', school_memberships.grade_label,
          school_memberships.id, school_memberships.section_id
        )
        OR public.school_leadership_has_permission(
          school_memberships.school_id, 'manage_team_tasks', school_memberships.grade_label,
          school_memberships.id, school_memberships.section_id
        )
        OR public.school_leadership_has_permission(
          school_memberships.school_id, 'assign_team_tasks', school_memberships.grade_label,
          school_memberships.id, school_memberships.section_id
        )
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


-- Operational leadership audit events are separate from appointment-history events.
CREATE TABLE IF NOT EXISTS public.school_leadership_action_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL REFERENCES public.school_leadership_appointments(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_membership_id uuid NOT NULL REFERENCES public.school_memberships(id) ON DELETE RESTRICT,
  action_type text NOT NULL CHECK (action_type IN (
    'attendance_corrected', 'task_assigned', 'task_reviewed',
    'assessment_reviewed', 'homework_reviewed', 'behavior_reviewed',
    'announcement_reviewed', 'quiz_reviewed', 'library_reviewed'
  )),
  target_table text NOT NULL,
  target_id uuid NOT NULL,
  reason text,
  before_state jsonb,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_leadership_action_events_school_created_idx
  ON public.school_leadership_action_events(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS school_leadership_action_events_appointment_created_idx
  ON public.school_leadership_action_events(appointment_id, created_at DESC);

ALTER TABLE public.school_leadership_action_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.school_leadership_action_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.school_leadership_action_events TO authenticated;

CREATE OR REPLACE FUNCTION public.school_can_view_leadership_action_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_leadership_action_events event
    JOIN public.school_leadership_appointments appointment
      ON appointment.id = event.appointment_id
     AND appointment.school_id = event.school_id
    JOIN public.school_memberships leader
      ON leader.id = appointment.membership_id
     AND leader.school_id = appointment.school_id
    WHERE event.id = p_event_id
      AND (
        public.is_school_manager(event.school_id)
        OR public.school_is_admin(event.school_id)
        OR leader.user_id = auth.uid()
      )
  );
$$;

REVOKE ALL ON FUNCTION public.school_can_view_leadership_action_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_leadership_action_event(uuid) TO authenticated;

DROP POLICY IF EXISTS school_leadership_action_events_read ON public.school_leadership_action_events;
CREATE POLICY school_leadership_action_events_read
  ON public.school_leadership_action_events
  FOR SELECT TO authenticated
  USING (public.school_can_view_leadership_action_event(id));

-- Leadership attendance corrections use a guarded RPC. The trigger only bypasses
-- homeroom-teacher recording checks when this transaction-local flag is set and
-- independently revalidates the leader's appointment scope.
CREATE OR REPLACE FUNCTION public.school_validate_attendance_record()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_session public.school_attendance_sessions%ROWTYPE;
  v_student public.school_memberships%ROWTYPE;
  v_recorder public.school_memberships%ROWTYPE;
  v_grade_label text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND current_setting('app.school_attendance_leadership_review', true) = 'true' THEN
    SELECT * INTO v_session
    FROM public.school_attendance_sessions
    WHERE id = NEW.session_id;
    SELECT * INTO v_student
    FROM public.school_memberships
    WHERE id = NEW.student_membership_id;
    SELECT section.grade_label INTO v_grade_label
    FROM public.school_sections section
    WHERE section.id = v_session.section_id
      AND section.school_id = v_session.school_id;

    IF ROW(NEW.school_id, NEW.session_id, NEW.student_membership_id, NEW.recorded_by_membership_id, NEW.created_at)
       IS DISTINCT FROM
       ROW(OLD.school_id, OLD.session_id, OLD.student_membership_id, OLD.recorded_by_membership_id, OLD.created_at) THEN
      RAISE EXCEPTION 'Attendance record identity fields are immutable';
    END IF;
    IF v_session.id IS NULL OR v_student.id IS NULL
       OR v_session.school_id <> NEW.school_id
       OR v_student.school_id <> NEW.school_id
       OR v_student.section_id <> v_session.section_id
       OR NEW.attendance_status IS NULL
       OR NEW.attendance_status NOT IN ('present', 'absent', 'late', 'excused')
       OR NOT public.school_leadership_has_permission(
         NEW.school_id, 'review_attendance', v_grade_label,
         NEW.student_membership_id, v_session.section_id
       ) THEN
      RAISE EXCEPTION 'An appointed school leader with attendance review permission is required';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO v_session FROM public.school_attendance_sessions WHERE id = NEW.session_id;
  SELECT * INTO v_student FROM public.school_memberships WHERE id = NEW.student_membership_id;
  SELECT * INTO v_recorder FROM public.school_memberships WHERE id = NEW.recorded_by_membership_id;
  IF v_session.id IS NULL OR v_student.id IS NULL OR v_recorder.id IS NULL
     OR v_session.school_id <> NEW.school_id OR v_student.school_id <> NEW.school_id
     OR v_recorder.school_id <> NEW.school_id
     OR v_student.section_id <> v_session.section_id
     OR v_recorder.school_role <> 'teacher'
     OR NOT public.school_is_homeroom_teacher(NEW.school_id, v_session.section_id) THEN
    RAISE EXCEPTION 'Attendance must be recorded by the assigned homeroom teacher for that section';
  END IF;
  IF TG_OP = 'INSERT' AND v_recorder.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'The signed-in homeroom teacher must record attendance';
  END IF;
  IF TG_OP = 'UPDATE' AND ROW(NEW.school_id, NEW.session_id, NEW.student_membership_id, NEW.recorded_by_membership_id, NEW.created_at)
     IS DISTINCT FROM ROW(OLD.school_id, OLD.session_id, OLD.student_membership_id, OLD.recorded_by_membership_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Attendance record identity fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_leadership_correct_attendance(
  p_record_id uuid,
  p_attendance_status text,
  p_note text,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record public.school_attendance_records%ROWTYPE;
  v_updated public.school_attendance_records%ROWTYPE;
  v_session public.school_attendance_sessions%ROWTYPE;
  v_grade_label text;
  v_actor_membership_id uuid;
  v_appointment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_attendance_status IS NULL OR p_attendance_status NOT IN ('present', 'absent', 'late', 'excused') THEN
    RAISE EXCEPTION 'Invalid attendance status';
  END IF;
  IF nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required for attendance corrections';
  END IF;

  SELECT * INTO v_record
  FROM public.school_attendance_records
  WHERE id = p_record_id
  FOR UPDATE;
  IF v_record.id IS NULL THEN RAISE EXCEPTION 'Attendance record not found'; END IF;

  SELECT * INTO v_session
  FROM public.school_attendance_sessions
  WHERE id = v_record.session_id
    AND school_id = v_record.school_id;
  SELECT section.grade_label INTO v_grade_label
  FROM public.school_sections section
  WHERE section.id = v_session.section_id
    AND section.school_id = v_session.school_id;

  v_actor_membership_id := public.school_my_membership_id(v_record.school_id);
  SELECT appointment.id INTO v_appointment_id
  FROM public.school_leadership_appointments appointment
  WHERE appointment.school_id = v_record.school_id
    AND appointment.membership_id = v_actor_membership_id
    AND appointment.status = 'active'
    AND appointment.start_date <= CURRENT_DATE
    AND (appointment.end_date IS NULL OR appointment.end_date >= CURRENT_DATE)
  LIMIT 1;

  IF v_appointment_id IS NULL OR NOT public.school_leadership_has_permission(
    v_record.school_id, 'review_attendance', v_grade_label,
    v_record.student_membership_id, v_session.section_id
  ) THEN
    RAISE EXCEPTION 'An active school leadership appointment with attendance review permission is required';
  END IF;

  PERFORM set_config('app.school_attendance_leadership_review', 'true', true);
  UPDATE public.school_attendance_records
  SET attendance_status = p_attendance_status,
      note = nullif(trim(p_note), ''),
      updated_at = now()
  WHERE id = p_record_id
  RETURNING * INTO v_updated;
  PERFORM set_config('app.school_attendance_leadership_review', '', true);

  INSERT INTO public.school_leadership_action_events (
    school_id, appointment_id, actor_user_id, actor_membership_id,
    action_type, target_table, target_id, reason, before_state, after_state
  ) VALUES (
    v_record.school_id, v_appointment_id, auth.uid(), v_actor_membership_id,
    'attendance_corrected', 'school_attendance_records', v_record.id,
    trim(p_reason), to_jsonb(v_record), to_jsonb(v_updated)
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.school_leadership_correct_attendance(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_leadership_correct_attendance(uuid, text, text, text) TO authenticated;


-- The provisioning service must not treat every legacy school_role='admin'
-- membership as an administrator. Only the active Main Director may use the
-- existing School Admin account-provisioning authority.
CREATE OR REPLACE FUNCTION public.school_attach_account(p_actor_id uuid, p_school_id uuid, p_user_id uuid, p_school_role text, p_school_username text, p_grade_label text DEFAULT NULL::text, p_age_at_enrollment integer DEFAULT NULL::integer, p_section_id uuid DEFAULT NULL::uuid, p_student_number bigint DEFAULT NULL::bigint, p_parent_membership_ids uuid[] DEFAULT '{}'::uuid[], p_student_membership_ids uuid[] DEFAULT '{}'::uuid[], p_teacher_assignments jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_role text;
  v_is_main_director boolean := false;
  v_is_extreme_admin boolean;
  v_is_super_admin boolean;
  v_school_code text;
  v_membership_id uuid;
  v_section_grade text;
  v_assignment jsonb;
  v_assignment_section uuid;
  v_assignment_subject text;
  v_assignment_kind text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Trusted account provisioning service required';
  END IF;
  IF p_actor_id IS NULL OR p_user_id IS NULL OR p_school_id IS NULL THEN
    RAISE EXCEPTION 'Actor, school, and new user are required';
  END IF;
  IF p_school_role IS NULL OR p_school_role NOT IN ('manager', 'admin', 'teacher', 'finance', 'parent', 'student') THEN
    RAISE EXCEPTION 'Invalid school role';
  END IF;
  IF nullif(trim(p_school_username), '') IS NULL THEN
    RAISE EXCEPTION 'A unique username is required for every school account';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'New account profile was not created';
  END IF;
  IF lower((SELECT username FROM public.profiles WHERE id = p_user_id)) <> lower(trim(p_school_username)) THEN
    RAISE EXCEPTION 'Account username does not match the new profile';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_actor_id AND role = 'extreme_admin'::public.app_role
  ) INTO v_is_extreme_admin;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_actor_id AND role = 'super_admin'::public.app_role
  ) INTO v_is_super_admin;

  SELECT school_role INTO v_actor_role
  FROM public.school_memberships
  WHERE school_id = p_school_id
    AND user_id = p_actor_id
    AND status = 'active'
    AND school_role IN ('manager', 'admin')
  ORDER BY CASE school_role WHEN 'manager' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM public.school_memberships membership
    JOIN public.school_leadership_appointments appointment
      ON appointment.school_id = membership.school_id
     AND appointment.membership_id = membership.id
    WHERE membership.school_id = p_school_id
      AND membership.user_id = p_actor_id
      AND membership.school_role = 'admin'
      AND membership.status = 'active'
      AND appointment.position = 'main_director'
      AND appointment.status = 'active'
      AND appointment.start_date <= CURRENT_DATE
      AND (appointment.end_date IS NULL OR appointment.end_date >= CURRENT_DATE)
  ) INTO v_is_main_director;

  IF v_is_extreme_admin THEN
    NULL;
  ELSIF v_is_super_admin THEN
    IF p_school_role <> 'manager' THEN
      RAISE EXCEPTION 'Super Admin can only provision school Managers';
    END IF;
  ELSIF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Only the school Manager or Admin can provision accounts';
  ELSIF v_actor_role = 'admin' AND NOT v_is_main_director THEN
    RAISE EXCEPTION 'Only the appointed Main Director can provision school accounts';
  ELSIF v_actor_role = 'admin'
     AND p_school_role NOT IN ('student', 'parent', 'teacher') THEN
    RAISE EXCEPTION 'Main Director can create student, parent, and teacher accounts only';
  ELSIF v_actor_role = 'manager'
     AND p_school_role NOT IN ('student', 'parent', 'teacher', 'finance', 'admin') THEN
    RAISE EXCEPTION 'School Manager cannot create another Manager account';
  ELSIF p_school_role = 'manager' THEN
    RAISE EXCEPTION 'Only the Super Admin can create a school Manager';
  END IF;

  SELECT school_code INTO v_school_code
  FROM public.schools
  WHERE id = p_school_id AND status = 'active';
  IF v_school_code IS NULL THEN
    RAISE EXCEPTION 'School not found or not active';
  END IF;

  IF p_school_role = 'student' THEN
    IF nullif(trim(p_grade_label), '') IS NULL
       OR p_age_at_enrollment IS NULL
       OR p_age_at_enrollment NOT BETWEEN 3 AND 120
       OR p_section_id IS NULL
       OR p_student_number IS NULL THEN
      RAISE EXCEPTION 'Student grade, age, section, and student ID are required';
    END IF;

    SELECT grade_label INTO v_section_grade
    FROM public.school_sections
    WHERE id = p_section_id AND school_id = p_school_id;
    IF v_section_grade IS NULL OR v_section_grade <> trim(p_grade_label) THEN
      RAISE EXCEPTION 'Student section must belong to the selected grade and school';
    END IF;
    IF (SELECT age FROM public.profiles WHERE id = p_user_id) IS DISTINCT FROM p_age_at_enrollment THEN
      RAISE EXCEPTION 'Student profile age must match age at enrollment';
    END IF;
    IF lower(trim(p_school_username)) !~ (
      '^' || lower(v_school_code) || '/' || p_student_number::text || '/' || p_age_at_enrollment::text || '$'
    ) THEN
      RAISE EXCEPTION 'Student username must match SCHOOL_CODE/STUDENT_ID/AGE';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.school_memberships
      WHERE school_id = p_school_id
        AND school_role = 'student'
        AND student_number = p_student_number
    ) THEN
      RAISE EXCEPTION 'Student ID is already assigned in this school';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.school_student_id_reservations reservation
      WHERE reservation.school_id = p_school_id
        AND reservation.student_number = p_student_number
        AND reservation.grade_label = lower(trim(p_grade_label))
        AND reservation.reserved_by = p_actor_id
        AND reservation.used_by_user_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Student ID must be reserved by the trusted grade-based allocator';
    END IF;
    IF coalesce(cardinality(p_parent_membership_ids), 0) > 0 AND EXISTS (
      SELECT 1
      FROM unnest(p_parent_membership_ids) AS parent_ids(parent_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.school_memberships parent
        WHERE parent.id = parent_ids.parent_id
          AND parent.school_id = p_school_id
          AND parent.school_role = 'parent'
          AND parent.status = 'active'
      )
    ) THEN
      RAISE EXCEPTION 'Every linked parent must be an active parent account in this school';
    END IF;
  ELSIF p_school_role = 'parent' THEN
    IF lower(trim(p_school_username)) NOT LIKE 'pa%' THEN
      RAISE EXCEPTION 'School parent usernames must begin with pa';
    END IF;
    IF coalesce(cardinality(p_student_membership_ids), 0) > 0 AND EXISTS (
      SELECT 1
      FROM unnest(p_student_membership_ids) AS student_ids(student_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.school_memberships student
        WHERE student.id = student_ids.student_id
          AND student.school_id = p_school_id
          AND student.school_role = 'student'
          AND student.status IN ('active', 'suspended')
      )
    ) THEN
      RAISE EXCEPTION 'Every linked child must be an enrolled student in this school';
    END IF;
  ELSIF p_school_role = 'teacher' THEN
    IF jsonb_typeof(coalesce(p_teacher_assignments, '[]'::jsonb)) <> 'array'
       OR jsonb_array_length(coalesce(p_teacher_assignments, '[]'::jsonb)) = 0 THEN
      RAISE EXCEPTION 'Teacher accounts require at least one subject, section, or homeroom assignment';
    END IF;
  END IF;

  INSERT INTO public.school_memberships(
    school_id, user_id, school_role, status, grade_label, age_at_enrollment,
    section_id, student_number, school_username, created_by
  )
  VALUES (
    p_school_id, p_user_id, p_school_role, 'active',
    CASE WHEN p_school_role = 'student' THEN trim(p_grade_label) ELSE NULL END,
    CASE WHEN p_school_role = 'student' THEN p_age_at_enrollment ELSE NULL END,
    CASE WHEN p_school_role = 'student' THEN p_section_id ELSE NULL END,
    CASE WHEN p_school_role = 'student' THEN p_student_number ELSE NULL END,
    lower(trim(p_school_username)),
    p_actor_id
  )
  RETURNING id INTO v_membership_id;

  IF p_school_role = 'student' THEN
    UPDATE public.school_student_id_reservations
    SET used_by_user_id = p_user_id, used_at = now()
    WHERE school_id = p_school_id
      AND student_number = p_student_number
      AND grade_label = lower(trim(p_grade_label))
      AND reserved_by = p_actor_id
      AND used_by_user_id IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Student ID reservation is missing or already used';
    END IF;
  END IF;

  IF p_school_role = 'student' AND coalesce(cardinality(p_parent_membership_ids), 0) > 0 THEN
    INSERT INTO public.school_parent_student_links(
      school_id, parent_membership_id, student_membership_id, linked_by
    )
    SELECT p_school_id, parent_ids.parent_id, v_membership_id, p_actor_id
    FROM unnest(p_parent_membership_ids) AS parent_ids(parent_id);
  ELSIF p_school_role = 'parent' AND coalesce(cardinality(p_student_membership_ids), 0) > 0 THEN
    INSERT INTO public.school_parent_student_links(
      school_id, parent_membership_id, student_membership_id, linked_by
    )
    SELECT p_school_id, v_membership_id, student_ids.student_id, p_actor_id
    FROM unnest(p_student_membership_ids) AS student_ids(student_id);
  ELSIF p_school_role = 'teacher' THEN
    FOR v_assignment IN SELECT value FROM jsonb_array_elements(p_teacher_assignments)
    LOOP
      v_assignment_section := nullif(v_assignment ->> 'section_id', '')::uuid;
      v_assignment_subject := nullif(trim(v_assignment ->> 'subject_name'), '');
      v_assignment_kind := coalesce(nullif(v_assignment ->> 'assignment_kind', ''), 'subject');

      IF v_assignment_section IS NULL OR v_assignment_subject IS NULL
         OR v_assignment_kind NOT IN ('subject', 'homeroom') THEN
        RAISE EXCEPTION 'Teacher assignment is incomplete or invalid';
      END IF;

      SELECT grade_label INTO v_section_grade
      FROM public.school_sections
      WHERE id = v_assignment_section AND school_id = p_school_id;
      IF v_section_grade IS NULL THEN
        RAISE EXCEPTION 'Teacher assignment section does not belong to this school';
      END IF;

      IF v_assignment_kind = 'subject' AND NOT EXISTS (
        SELECT 1
        FROM public.school_subjects subject
        JOIN public.school_sections section
          ON section.school_id = subject.school_id
         AND section.academic_year_id = subject.academic_year_id
        WHERE section.id = v_assignment_section
          AND subject.school_id = p_school_id
          AND subject.grade_label = v_section_grade
          AND subject.subject_name = v_assignment_subject
          AND subject.active = true
      ) THEN
        RAISE EXCEPTION 'Teacher subject must be an active subject for the assigned grade';
      END IF;

      IF v_assignment_kind = 'homeroom' AND EXISTS (
        SELECT 1 FROM public.school_teacher_assignments
        WHERE section_id = v_assignment_section
          AND assignment_kind = 'homeroom'
      ) THEN
        RAISE EXCEPTION 'This section already has a homeroom teacher';
      END IF;

      INSERT INTO public.school_teacher_assignments(
        school_id, teacher_membership_id, section_id, subject_name,
        assignment_kind, created_by
      )
      VALUES (
        p_school_id, v_membership_id, v_assignment_section, v_assignment_subject,
        v_assignment_kind, p_actor_id
      );
    END LOOP;
  END IF;

  RETURN v_membership_id;
END;
$function$


