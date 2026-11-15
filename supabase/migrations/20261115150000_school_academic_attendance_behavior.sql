-- School academic records, grading, attendance, behavior, and parent notifications.
-- These records are separate from individual-learning quiz scores and XP.

CREATE TABLE IF NOT EXISTS public.school_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  academic_year_id uuid NOT NULL,
  name text NOT NULL,
  term_number integer NOT NULL CHECK (term_number > 0),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year_id, term_number),
  UNIQUE (id, school_id),
  FOREIGN KEY (academic_year_id, school_id)
    REFERENCES public.school_academic_years(id, school_id) ON DELETE RESTRICT,
  CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS public.school_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  grade_label text NOT NULL,
  subject_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, grade_label, subject_name),
  UNIQUE (id, school_id)
);

CREATE TABLE IF NOT EXISTS public.school_grading_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  academic_year_id uuid NOT NULL,
  grade_label text NOT NULL,
  pass_mark numeric(5,2) NOT NULL DEFAULT 50 CHECK (pass_mark BETWEEN 0 AND 100),
  rank_scope text NOT NULL DEFAULT 'section' CHECK (rank_scope IN ('section', 'grade')),
  missing_mark_rule text NOT NULL DEFAULT 'incomplete'
    CHECK (missing_mark_rule IN ('incomplete', 'zero')),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year_id, grade_label),
  FOREIGN KEY (academic_year_id, school_id)
    REFERENCES public.school_academic_years(id, school_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.school_assessment_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  academic_year_id uuid NOT NULL,
  grade_label text NOT NULL,
  category_key text NOT NULL,
  category_name text NOT NULL,
  weight_percent numeric(5,2) NOT NULL CHECK (weight_percent BETWEEN 0 AND 100),
  required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year_id, grade_label, category_key),
  UNIQUE (id, school_id),
  FOREIGN KEY (academic_year_id, school_id)
    REFERENCES public.school_academic_years(id, school_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.school_grade_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  grade_label text NOT NULL,
  minimum_score numeric(5,2) NOT NULL CHECK (minimum_score BETWEEN 0 AND 100),
  maximum_score numeric(5,2) NOT NULL CHECK (maximum_score BETWEEN 0 AND 100),
  letter_grade text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (maximum_score >= minimum_score),
  UNIQUE (school_id, grade_label, letter_grade)
);

CREATE TABLE IF NOT EXISTS public.school_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  academic_year_id uuid NOT NULL,
  term_id uuid NOT NULL,
  section_id uuid NOT NULL,
  category_id uuid NOT NULL,
  subject_name text NOT NULL,
  title text NOT NULL,
  instructions text,
  max_score numeric(8,2) NOT NULL CHECK (max_score > 0),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'published')),
  created_by_membership_id uuid NOT NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (academic_year_id, school_id)
    REFERENCES public.school_academic_years(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (term_id, school_id)
    REFERENCES public.school_terms(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id, school_id)
    REFERENCES public.school_assessment_categories(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  UNIQUE (id, school_id)
);

CREATE TABLE IF NOT EXISTS public.school_student_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  assessment_id uuid NOT NULL,
  student_membership_id uuid NOT NULL,
  score numeric(8,2) NOT NULL CHECK (score >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  entered_by_membership_id uuid NOT NULL,
  teacher_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assessment_id, school_id)
    REFERENCES public.school_assessments(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (student_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (entered_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  UNIQUE (assessment_id, student_membership_id)
);

CREATE TABLE IF NOT EXISTS public.school_term_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  term_id uuid NOT NULL,
  student_membership_id uuid NOT NULL,
  section_id uuid NOT NULL,
  grade_label text NOT NULL,
  subject_name text NOT NULL,
  average_score numeric(6,2) CHECK (average_score BETWEEN 0 AND 100),
  letter_grade text,
  rank_position integer CHECK (rank_position > 0),
  status text NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('incomplete', 'calculated', 'published')),
  calculated_at timestamptz,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (term_id, school_id)
    REFERENCES public.school_terms(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (student_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  UNIQUE (term_id, student_membership_id, subject_name)
);

CREATE INDEX IF NOT EXISTS school_assessments_section_term_idx
  ON public.school_assessments(school_id, section_id, term_id, status);
CREATE INDEX IF NOT EXISTS school_student_marks_student_idx
  ON public.school_student_marks(student_membership_id, assessment_id);
CREATE INDEX IF NOT EXISTS school_term_results_student_idx
  ON public.school_term_results(student_membership_id, term_id, status);

CREATE TABLE IF NOT EXISTS public.school_attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  section_id uuid NOT NULL,
  attendance_date date NOT NULL,
  recorded_by_membership_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'locked')),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (recorded_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  UNIQUE (school_id, section_id, attendance_date),
  UNIQUE (id, school_id)
);

CREATE TABLE IF NOT EXISTS public.school_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL,
  student_membership_id uuid NOT NULL,
  attendance_status text NOT NULL
    CHECK (attendance_status IN ('present', 'absent', 'late', 'excused')),
  note text,
  recorded_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (session_id, school_id)
    REFERENCES public.school_attendance_sessions(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (student_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (recorded_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  UNIQUE (session_id, student_membership_id)
);

CREATE TABLE IF NOT EXISTS public.school_behavior_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  student_membership_id uuid NOT NULL,
  section_id uuid NOT NULL,
  reported_by_membership_id uuid NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('positive', 'concern', 'incident')),
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 3 AND 3000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (student_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (reported_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.school_parent_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  parent_membership_id uuid NOT NULL,
  student_membership_id uuid NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('attendance', 'behavior', 'academic', 'announcement', 'message', 'fee')),
  title text NOT NULL,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (parent_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (student_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE OR REPLACE FUNCTION public.school_is_admin(p_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public._is_extreme_admin()
    OR public.is_active_school_member(p_school_id, ARRAY['admin']::text[]);
$$;

CREATE OR REPLACE FUNCTION public.school_can_teach_subject(
  p_school_id uuid, p_section_id uuid, p_subject_name text
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_memberships teacher
    JOIN public.school_teacher_assignments assignment
      ON assignment.teacher_membership_id = teacher.id
     AND assignment.school_id = teacher.school_id
    WHERE teacher.user_id = auth.uid()
      AND teacher.school_id = p_school_id
      AND teacher.school_role = 'teacher'
      AND teacher.status = 'active'
      AND assignment.section_id = p_section_id
      AND assignment.subject_name = p_subject_name
      AND assignment.assignment_kind = 'subject'
  );
$$;

CREATE OR REPLACE FUNCTION public.school_is_homeroom_teacher(
  p_school_id uuid, p_section_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_memberships teacher
    JOIN public.school_teacher_assignments assignment
      ON assignment.teacher_membership_id = teacher.id
     AND assignment.school_id = teacher.school_id
    WHERE teacher.user_id = auth.uid()
      AND teacher.school_id = p_school_id
      AND teacher.school_role = 'teacher'
      AND teacher.status = 'active'
      AND assignment.section_id = p_section_id
      AND assignment.assignment_kind = 'homeroom'
  ) OR EXISTS (
    SELECT 1 FROM public.school_sections section
    WHERE section.id = p_section_id
      AND section.school_id = p_school_id
      AND section.homeroom_teacher_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_assessment(p_assessment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_assessments assessment
    WHERE assessment.id = p_assessment_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(assessment.school_id)
        OR public.school_can_teach_subject(assessment.school_id, assessment.section_id, assessment.subject_name)
        OR EXISTS (
          SELECT 1 FROM public.school_memberships creator
          WHERE creator.id = assessment.created_by_membership_id
            AND creator.user_id = auth.uid()
            AND creator.status = 'active'
        )
        OR (
          assessment.status IN ('approved', 'published')
          AND EXISTS (
            SELECT 1 FROM public.school_memberships student
            WHERE student.user_id = auth.uid()
              AND student.school_id = assessment.school_id
              AND student.section_id = assessment.section_id
              AND student.school_role = 'student'
              AND student.status = 'active'
          )
        )
        OR (
          assessment.status IN ('approved', 'published')
          AND EXISTS (
            SELECT 1
            FROM public.school_parent_student_links link
            JOIN public.school_memberships parent ON parent.id = link.parent_membership_id
            JOIN public.school_memberships student ON student.id = link.student_membership_id
            WHERE parent.user_id = auth.uid()
              AND parent.status = 'active'
              AND link.status = 'active'
              AND student.school_id = assessment.school_id
              AND student.section_id = assessment.section_id
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_manage_assessment(p_assessment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_assessments assessment
    WHERE assessment.id = p_assessment_id
      AND (
        public.school_is_admin(assessment.school_id)
        OR (
          assessment.status IN ('draft', 'rejected')
          AND EXISTS (
            SELECT 1 FROM public.school_memberships creator
            WHERE creator.id = assessment.created_by_membership_id
              AND creator.user_id = auth.uid()
              AND creator.school_role = 'teacher'
              AND creator.status = 'active'
              AND public.school_can_teach_subject(assessment.school_id, assessment.section_id, assessment.subject_name)
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_enter_mark(
  p_assessment_id uuid, p_student_membership_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_assessments assessment
    JOIN public.school_memberships student
      ON student.id = p_student_membership_id
     AND student.school_id = assessment.school_id
    WHERE assessment.id = p_assessment_id
      AND assessment.status IN ('draft', 'rejected')
      AND student.school_role = 'student'
      AND student.status IN ('active', 'suspended')
      AND student.section_id = assessment.section_id
      AND EXISTS (
        SELECT 1 FROM public.school_memberships creator
        WHERE creator.id = assessment.created_by_membership_id
          AND creator.user_id = auth.uid()
          AND creator.school_role = 'teacher'
          AND creator.status = 'active'
          AND public.school_can_teach_subject(assessment.school_id, assessment.section_id, assessment.subject_name)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_mark(p_mark_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_student_marks mark
    JOIN public.school_assessments assessment ON assessment.id = mark.assessment_id
    JOIN public.school_memberships student ON student.id = mark.student_membership_id
    WHERE mark.id = p_mark_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(mark.school_id)
        OR EXISTS (
          SELECT 1 FROM public.school_memberships teacher
          WHERE teacher.user_id = auth.uid()
            AND teacher.school_role = 'teacher'
            AND teacher.status = 'active'
            AND teacher.school_id = assessment.school_id
            AND public.school_can_teach_subject(assessment.school_id, assessment.section_id, assessment.subject_name)
        )
        OR (
          mark.status = 'approved'
          AND student.user_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.school_term_results result
            WHERE result.term_id = assessment.term_id
              AND result.student_membership_id = student.id
              AND result.subject_name = assessment.subject_name
              AND result.status = 'published'
          )
        )
        OR (
          mark.status = 'approved'
          AND EXISTS (
            SELECT 1
            FROM public.school_parent_student_links link
            JOIN public.school_memberships parent ON parent.id = link.parent_membership_id
            WHERE link.student_membership_id = student.id
              AND link.status = 'active'
              AND parent.user_id = auth.uid()
              AND parent.status = 'active'
          )
          AND EXISTS (
            SELECT 1 FROM public.school_term_results result
            WHERE result.term_id = assessment.term_id
              AND result.student_membership_id = student.id
              AND result.subject_name = assessment.subject_name
              AND result.status = 'published'
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_term_result(p_result_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_term_results result
    JOIN public.school_memberships student ON student.id = result.student_membership_id
    WHERE result.id = p_result_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(result.school_id)
        OR (
          result.status = 'published'
          AND student.user_id = auth.uid()
        )
        OR (
          result.status = 'published'
          AND EXISTS (
            SELECT 1 FROM public.school_parent_student_links link
            JOIN public.school_memberships parent ON parent.id = link.parent_membership_id
            WHERE link.student_membership_id = student.id
              AND link.status = 'active'
              AND parent.user_id = auth.uid()
              AND parent.status = 'active'
          )
        )
        OR EXISTS (
          SELECT 1 FROM public.school_memberships teacher
          WHERE teacher.user_id = auth.uid()
            AND teacher.school_role = 'teacher'
            AND teacher.status = 'active'
            AND teacher.school_id = result.school_id
            AND public.school_can_teach_subject(result.school_id, result.section_id, result.subject_name)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_attendance_record(p_record_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_attendance_records record
    JOIN public.school_attendance_sessions session ON session.id = record.session_id
    JOIN public.school_memberships student ON student.id = record.student_membership_id
    WHERE record.id = p_record_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(record.school_id)
        OR public.school_is_homeroom_teacher(record.school_id, session.section_id)
        OR student.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.school_parent_student_links link
          JOIN public.school_memberships parent ON parent.id = link.parent_membership_id
          WHERE link.student_membership_id = student.id
            AND link.status = 'active'
            AND parent.user_id = auth.uid()
            AND parent.status = 'active'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_record_attendance(
  p_session_id uuid, p_student_membership_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_attendance_sessions session
    JOIN public.school_memberships student
      ON student.id = p_student_membership_id
     AND student.school_id = session.school_id
    WHERE session.id = p_session_id
      AND session.status = 'open'
      AND student.school_role = 'student'
      AND student.status IN ('active', 'suspended')
      AND student.section_id = session.section_id
      AND public.school_is_homeroom_teacher(session.school_id, session.section_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_behavior_report(p_report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_behavior_reports report
    JOIN public.school_memberships student ON student.id = report.student_membership_id
    WHERE report.id = p_report_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(report.school_id)
        OR public.school_is_homeroom_teacher(report.school_id, report.section_id)
        OR EXISTS (
          SELECT 1 FROM public.school_memberships reporter
          WHERE reporter.id = report.reported_by_membership_id
            AND reporter.user_id = auth.uid()
            AND reporter.status = 'active'
        )
        OR (
          report.status = 'approved'
          AND student.user_id = auth.uid()
        )
        OR (
          report.status = 'approved'
          AND EXISTS (
            SELECT 1 FROM public.school_parent_student_links link
            JOIN public.school_memberships parent ON parent.id = link.parent_membership_id
            WHERE link.student_membership_id = student.id
              AND link.status = 'active'
              AND parent.user_id = auth.uid()
              AND parent.status = 'active'
          )
        )
      )
  );
$$;

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
      AND assignment.assignment_kind = 'subject'
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_review_behavior_report(p_report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_behavior_reports report
    WHERE report.id = p_report_id
      AND (
        public.school_is_admin(report.school_id)
        OR public.school_is_homeroom_teacher(report.school_id, report.section_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_parent_notification(p_notification_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_parent_notifications notification
    JOIN public.school_memberships parent ON parent.id = notification.parent_membership_id
    WHERE notification.id = p_notification_id
      AND (
        public.is_school_manager_or_admin(notification.school_id)
        OR (parent.user_id = auth.uid() AND parent.school_role = 'parent' AND parent.status = 'active')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_seed_default_grading_categories(
  p_school_id uuid, p_academic_year_id uuid, p_grade_label text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_school_manager(p_school_id) THEN
    RAISE EXCEPTION 'Only the school Manager can configure grading defaults';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.school_academic_years
    WHERE id = p_academic_year_id AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'Academic year does not belong to this school';
  END IF;

  INSERT INTO public.school_grading_policies(school_id, academic_year_id, grade_label, updated_by)
  VALUES (p_school_id, p_academic_year_id, trim(p_grade_label), auth.uid())
  ON CONFLICT (school_id, academic_year_id, grade_label) DO NOTHING;

  INSERT INTO public.school_assessment_categories(
    school_id, academic_year_id, grade_label, category_key, category_name, weight_percent, required
  )
  VALUES
    (p_school_id, p_academic_year_id, trim(p_grade_label), 'class_activity', 'Class Activities', 10, true),
    (p_school_id, p_academic_year_id, trim(p_grade_label), 'test', 'Tests', 30, true),
    (p_school_id, p_academic_year_id, trim(p_grade_label), 'final', 'Final Examination', 60, true)
  ON CONFLICT (school_id, academic_year_id, grade_label, category_key) DO NOTHING;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_submit_assessment(p_assessment_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.school_can_manage_assessment(p_assessment_id) THEN
    RAISE EXCEPTION 'Only the assigned teacher can submit this assessment';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_student_marks WHERE assessment_id = p_assessment_id) THEN
    RAISE EXCEPTION 'Enter student marks before submitting the assessment';
  END IF;
  PERFORM set_config('app.school_assessment_transition', 'submit', true);
  UPDATE public.school_assessments
  SET status = 'submitted', updated_at = now()
  WHERE id = p_assessment_id AND status IN ('draft', 'rejected');
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment is not in a submittable state'; END IF;
  UPDATE public.school_student_marks
  SET status = 'submitted', updated_at = now()
  WHERE assessment_id = p_assessment_id AND status IN ('draft', 'rejected');
  PERFORM set_config('app.school_assessment_transition', '', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_review_assessment(
  p_assessment_id uuid, p_approve boolean, p_feedback text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
BEGIN
  SELECT school_id INTO v_school_id FROM public.school_assessments
  WHERE id = p_assessment_id FOR UPDATE;
  IF v_school_id IS NULL OR NOT public.school_is_admin(v_school_id) THEN
    RAISE EXCEPTION 'School Admin approval is required';
  END IF;
  PERFORM set_config('app.school_assessment_transition', 'review', true);
  UPDATE public.school_assessments
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = auth.uid(), reviewed_at = now(),
      review_feedback = nullif(trim(p_feedback), ''), updated_at = now()
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

CREATE OR REPLACE FUNCTION public.school_calculate_term_results(p_term_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
  v_rows integer := 0;
  v_bad_weights integer;
BEGIN
  SELECT school_id INTO v_school_id FROM public.school_terms WHERE id = p_term_id;
  IF v_school_id IS NULL OR NOT public.school_is_admin(v_school_id) THEN
    RAISE EXCEPTION 'Only the School Admin can calculate official term results';
  END IF;

  SELECT count(*) INTO v_bad_weights
  FROM (
    SELECT category.school_id, category.academic_year_id, category.grade_label
    FROM public.school_assessment_categories category
    WHERE category.school_id = v_school_id
      AND category.academic_year_id = (SELECT academic_year_id FROM public.school_terms WHERE id = p_term_id)
    GROUP BY category.school_id, category.academic_year_id, category.grade_label
    HAVING round(sum(category.weight_percent), 2) <> 100
  ) invalid;
  IF v_bad_weights > 0 THEN
    RAISE EXCEPTION 'Every grade grading configuration must total exactly 100 percent';
  END IF;

  WITH category_scores AS (
    SELECT
      mark.student_membership_id,
      assessment.section_id,
      section.grade_label,
      assessment.subject_name,
      assessment.term_id,
      assessment.school_id,
      category.id AS category_id,
      category.weight_percent,
      sum(mark.score) / nullif(sum(assessment.max_score), 0) * 100 AS category_average
    FROM public.school_student_marks mark
    JOIN public.school_assessments assessment ON assessment.id = mark.assessment_id
    JOIN public.school_assessment_categories category ON category.id = assessment.category_id
    JOIN public.school_sections section ON section.id = assessment.section_id
    WHERE assessment.term_id = p_term_id
      AND assessment.school_id = v_school_id
      AND assessment.status = 'approved'
      AND mark.status = 'approved'
    GROUP BY mark.student_membership_id, assessment.section_id, section.grade_label,
             assessment.subject_name, assessment.term_id, assessment.school_id,
             category.id, category.weight_percent
  ),
  completed AS (
    SELECT
      scores.student_membership_id,
      scores.section_id,
      scores.grade_label,
      scores.subject_name,
      scores.term_id,
      scores.school_id,
      sum(scores.category_average * scores.weight_percent / 100) AS weighted_average,
      count(DISTINCT scores.category_id) AS completed_categories,
      count(DISTINCT scores.category_id) FILTER (WHERE category.required) AS completed_required_categories
    FROM category_scores scores
    JOIN public.school_assessment_categories category ON category.id = scores.category_id
    GROUP BY scores.student_membership_id, scores.section_id, scores.grade_label,
             scores.subject_name, scores.term_id, scores.school_id
  ),
  required_counts AS (
    SELECT school_id, academic_year_id, grade_label,
           count(*) FILTER (WHERE required) AS required_categories
    FROM public.school_assessment_categories
    WHERE school_id = v_school_id
      AND academic_year_id = (SELECT academic_year_id FROM public.school_terms WHERE id = p_term_id)
    GROUP BY school_id, academic_year_id, grade_label
  ),
  calculated AS (
    SELECT
      completed.*,
      CASE WHEN completed.completed_required_categories >= required_counts.required_categories
                  OR coalesce(policy.missing_mark_rule, 'incomplete') = 'zero'
           THEN round(completed.weighted_average, 2)
           ELSE NULL END AS final_average,
      policy.rank_scope,
      scales.letter_grade
    FROM completed
    JOIN required_counts USING (school_id, grade_label)
    LEFT JOIN public.school_grading_policies policy
      ON policy.school_id = completed.school_id
     AND policy.academic_year_id = (SELECT academic_year_id FROM public.school_terms WHERE id = p_term_id)
     AND policy.grade_label = completed.grade_label
    LEFT JOIN LATERAL (
      SELECT scale.letter_grade
      FROM public.school_grade_scales scale
      WHERE scale.school_id = completed.school_id
        AND scale.grade_label = completed.grade_label
        AND completed.weighted_average BETWEEN scale.minimum_score AND scale.maximum_score
      ORDER BY scale.minimum_score DESC
      LIMIT 1
    ) scales ON true
  ),
  ranked AS (
    SELECT calculated.*,
      CASE WHEN final_average IS NULL THEN NULL
           ELSE rank() OVER (
             PARTITION BY subject_name,
               CASE WHEN rank_scope = 'grade' THEN grade_label ELSE section_id::text END
             ORDER BY final_average DESC
           )::integer
      END AS calculated_rank
    FROM calculated
  )
  INSERT INTO public.school_term_results(
    school_id, term_id, student_membership_id, section_id, grade_label,
    subject_name, average_score, letter_grade, rank_position, status, calculated_at, updated_at
  )
  SELECT school_id, term_id, student_membership_id, section_id, grade_label,
         subject_name, final_average, letter_grade, calculated_rank,
         CASE WHEN final_average IS NULL THEN 'incomplete' ELSE 'calculated' END,
         now(), now()
  FROM ranked
  ON CONFLICT (term_id, student_membership_id, subject_name)
  DO UPDATE SET
    section_id = EXCLUDED.section_id,
    grade_label = EXCLUDED.grade_label,
    average_score = EXCLUDED.average_score,
    letter_grade = EXCLUDED.letter_grade,
    rank_position = EXCLUDED.rank_position,
    status = EXCLUDED.status,
    calculated_at = now(),
    updated_at = now()
  WHERE public.school_term_results.status <> 'published';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_publish_term_results(p_term_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
  v_count integer;
BEGIN
  SELECT school_id INTO v_school_id FROM public.school_terms WHERE id = p_term_id FOR UPDATE;
  IF v_school_id IS NULL OR NOT public.school_is_admin(v_school_id) THEN
    RAISE EXCEPTION 'Only the School Admin can publish official term results';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.school_term_results
    WHERE term_id = p_term_id AND status = 'incomplete'
  ) THEN
    RAISE EXCEPTION 'Some subject results are incomplete; resolve missing marks before publishing';
  END IF;
  UPDATE public.school_term_results
  SET status = 'published', published_by = auth.uid(), published_at = now(), updated_at = now()
  WHERE term_id = p_term_id AND status = 'calculated';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RAISE EXCEPTION 'No calculated results are ready to publish'; END IF;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_review_behavior_report(
  p_report_id uuid, p_approve boolean, p_review_note text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
BEGIN
  SELECT school_id INTO v_school_id FROM public.school_behavior_reports
  WHERE id = p_report_id FOR UPDATE;
  IF v_school_id IS NULL OR NOT public.school_can_review_behavior_report(p_report_id) THEN
    RAISE EXCEPTION 'Homeroom teacher or School Admin review is required';
  END IF;
  PERFORM set_config('app.school_behavior_review', 'true', true);
  UPDATE public.school_behavior_reports
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = auth.uid(), reviewed_at = now(),
      review_note = nullif(trim(p_review_note), '')
  WHERE id = p_report_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only pending behavior reports can be reviewed'; END IF;
  PERFORM set_config('app.school_behavior_review', '', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_notify_parent_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_date date;
BEGIN
  SELECT attendance_date INTO v_date
  FROM public.school_attendance_sessions WHERE id = NEW.session_id;
  INSERT INTO public.school_parent_notifications(
    school_id, parent_membership_id, student_membership_id, notification_type, title, message
  )
  SELECT link.school_id, link.parent_membership_id, NEW.student_membership_id,
         'attendance', 'Attendance updated',
         'Attendance for ' || to_char(v_date, 'DD Mon YYYY') || ' was recorded as ' || NEW.attendance_status || '.'
  FROM public.school_parent_student_links link
  WHERE link.student_membership_id = NEW.student_membership_id AND link.status = 'active';
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_notify_parent_behavior_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.school_parent_notifications(
      school_id, parent_membership_id, student_membership_id, notification_type, title, message
    )
    SELECT link.school_id, link.parent_membership_id, NEW.student_membership_id,
           'behavior', 'Behavior report available',
           'A behavior report has been reviewed and approved by the school.'
    FROM public.school_parent_student_links link
    WHERE link.student_membership_id = NEW.student_membership_id AND link.status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.school_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_grading_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_assessment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_grade_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_student_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_term_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_behavior_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_parent_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_terms_read ON public.school_terms
FOR SELECT TO authenticated USING (public.is_active_school_member(school_id, NULL) OR public._is_extreme_admin());
CREATE POLICY school_terms_manager_insert ON public.school_terms
FOR INSERT TO authenticated WITH CHECK (public.is_school_manager(school_id));
CREATE POLICY school_terms_manager_update ON public.school_terms
FOR UPDATE TO authenticated USING (public.is_school_manager(school_id))
WITH CHECK (public.is_school_manager(school_id));

CREATE POLICY school_subjects_read ON public.school_subjects
FOR SELECT TO authenticated USING (public.is_active_school_member(school_id, NULL) OR public._is_extreme_admin());
CREATE POLICY school_subjects_staff_insert ON public.school_subjects
FOR INSERT TO authenticated WITH CHECK (public.is_school_manager_or_admin(school_id));
CREATE POLICY school_subjects_staff_update ON public.school_subjects
FOR UPDATE TO authenticated USING (public.is_school_manager_or_admin(school_id))
WITH CHECK (public.is_school_manager_or_admin(school_id));

CREATE POLICY school_grading_policies_read ON public.school_grading_policies
FOR SELECT TO authenticated USING (public.is_active_school_member(school_id, NULL) OR public._is_extreme_admin());
CREATE POLICY school_grading_policies_manager_insert ON public.school_grading_policies
FOR INSERT TO authenticated WITH CHECK (public.is_school_manager(school_id));
CREATE POLICY school_grading_policies_manager_update ON public.school_grading_policies
FOR UPDATE TO authenticated USING (public.is_school_manager(school_id))
WITH CHECK (public.is_school_manager(school_id));

CREATE POLICY school_categories_read ON public.school_assessment_categories
FOR SELECT TO authenticated USING (public.is_active_school_member(school_id, NULL) OR public._is_extreme_admin());
CREATE POLICY school_categories_manager_insert ON public.school_assessment_categories
FOR INSERT TO authenticated WITH CHECK (public.is_school_manager(school_id));
CREATE POLICY school_categories_manager_update ON public.school_assessment_categories
FOR UPDATE TO authenticated USING (public.is_school_manager(school_id))
WITH CHECK (public.is_school_manager(school_id));

CREATE POLICY school_grade_scales_read ON public.school_grade_scales
FOR SELECT TO authenticated USING (public.is_active_school_member(school_id, NULL) OR public._is_extreme_admin());
CREATE POLICY school_grade_scales_manager_insert ON public.school_grade_scales
FOR INSERT TO authenticated WITH CHECK (public.is_school_manager(school_id));
CREATE POLICY school_grade_scales_manager_update ON public.school_grade_scales
FOR UPDATE TO authenticated USING (public.is_school_manager(school_id))
WITH CHECK (public.is_school_manager(school_id));

CREATE POLICY school_assessments_read ON public.school_assessments
FOR SELECT TO authenticated USING (public.school_can_view_assessment(id));
CREATE POLICY school_assessments_insert ON public.school_assessments
FOR INSERT TO authenticated
WITH CHECK (
  public.school_is_admin(school_id)
  OR (
    EXISTS (
      SELECT 1 FROM public.school_memberships teacher
      WHERE teacher.id = created_by_membership_id
        AND teacher.user_id = auth.uid()
        AND teacher.school_role = 'teacher'
        AND teacher.status = 'active'
    )
    AND public.school_can_teach_subject(school_id, section_id, subject_name)
  )
);
CREATE POLICY school_assessments_update ON public.school_assessments
FOR UPDATE TO authenticated
USING (public.school_can_manage_assessment(id))
WITH CHECK (public.school_can_manage_assessment(id));

CREATE POLICY school_student_marks_read ON public.school_student_marks
FOR SELECT TO authenticated USING (public.school_can_view_mark(id));
CREATE POLICY school_student_marks_insert ON public.school_student_marks
FOR INSERT TO authenticated WITH CHECK (public.school_can_enter_mark(assessment_id, student_membership_id));
CREATE POLICY school_student_marks_update ON public.school_student_marks
FOR UPDATE TO authenticated
USING (public.school_can_enter_mark(assessment_id, student_membership_id))
WITH CHECK (public.school_can_enter_mark(assessment_id, student_membership_id));

CREATE POLICY school_term_results_read ON public.school_term_results
FOR SELECT TO authenticated USING (public.school_can_view_term_result(id));

CREATE POLICY school_attendance_sessions_read ON public.school_attendance_sessions
FOR SELECT TO authenticated
USING (
  public._is_extreme_admin()
  OR public.is_school_manager_or_admin(school_id)
  OR public.school_is_homeroom_teacher(school_id, section_id)
  OR EXISTS (
    SELECT 1 FROM public.school_attendance_records record
    JOIN public.school_memberships student ON student.id = record.student_membership_id
    WHERE record.session_id = school_attendance_sessions.id
      AND (student.user_id = auth.uid() OR public.school_can_view_membership(student.id))
  )
);
CREATE POLICY school_attendance_sessions_insert ON public.school_attendance_sessions
FOR INSERT TO authenticated
WITH CHECK (
  public.school_is_homeroom_teacher(school_id, section_id)
  AND EXISTS (
    SELECT 1 FROM public.school_memberships teacher
    WHERE teacher.id = recorded_by_membership_id
      AND teacher.user_id = auth.uid()
      AND teacher.school_role = 'teacher'
      AND teacher.status = 'active'
  )
);
CREATE POLICY school_attendance_sessions_update ON public.school_attendance_sessions
FOR UPDATE TO authenticated
USING (public.school_is_homeroom_teacher(school_id, section_id) AND status = 'open')
WITH CHECK (public.school_is_homeroom_teacher(school_id, section_id));

CREATE POLICY school_attendance_records_read ON public.school_attendance_records
FOR SELECT TO authenticated USING (public.school_can_view_attendance_record(id));
CREATE POLICY school_attendance_records_insert ON public.school_attendance_records
FOR INSERT TO authenticated
WITH CHECK (
  public.school_can_record_attendance(session_id, student_membership_id)
  AND EXISTS (
    SELECT 1 FROM public.school_memberships teacher
    WHERE teacher.id = recorded_by_membership_id
      AND teacher.user_id = auth.uid()
      AND teacher.school_role = 'teacher'
      AND teacher.status = 'active'
  )
);
CREATE POLICY school_attendance_records_update ON public.school_attendance_records
FOR UPDATE TO authenticated
USING (public.school_can_record_attendance(session_id, student_membership_id))
WITH CHECK (public.school_can_record_attendance(session_id, student_membership_id));

CREATE POLICY school_behavior_reports_read ON public.school_behavior_reports
FOR SELECT TO authenticated USING (public.school_can_view_behavior_report(id));
CREATE POLICY school_behavior_reports_insert ON public.school_behavior_reports
FOR INSERT TO authenticated
WITH CHECK (
  public.school_can_submit_behavior_report(student_membership_id)
  AND EXISTS (
    SELECT 1 FROM public.school_memberships student
    WHERE student.id = student_membership_id
      AND student.school_id = school_behavior_reports.school_id
      AND student.section_id = school_behavior_reports.section_id
  )
  AND EXISTS (
    SELECT 1 FROM public.school_memberships reporter
    WHERE reporter.id = reported_by_membership_id
      AND reporter.user_id = auth.uid()
      AND reporter.school_role = 'teacher'
      AND reporter.status = 'active'
  )
);

CREATE POLICY school_parent_notifications_read ON public.school_parent_notifications
FOR SELECT TO authenticated USING (public.school_can_view_parent_notification(id));
CREATE POLICY school_parent_notifications_mark_read ON public.school_parent_notifications
FOR UPDATE TO authenticated
USING (public.school_can_view_parent_notification(id))
WITH CHECK (public.school_can_view_parent_notification(id));

DROP TRIGGER IF EXISTS school_attendance_notify_parent ON public.school_attendance_records;
CREATE TRIGGER school_attendance_notify_parent
AFTER INSERT OR UPDATE OF attendance_status ON public.school_attendance_records
FOR EACH ROW EXECUTE FUNCTION public.school_notify_parent_attendance();

DROP TRIGGER IF EXISTS school_behavior_notify_parent ON public.school_behavior_reports;
CREATE TRIGGER school_behavior_notify_parent
AFTER UPDATE OF status ON public.school_behavior_reports
FOR EACH ROW EXECUTE FUNCTION public.school_notify_parent_behavior_approval();

REVOKE ALL ON FUNCTION public.school_is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_teach_subject(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_is_homeroom_teacher(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_assessment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_manage_assessment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_enter_mark(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_mark(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_term_result(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_attendance_record(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_record_attendance(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_behavior_report(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_submit_behavior_report(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_review_behavior_report(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_parent_notification(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_seed_default_grading_categories(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_submit_assessment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_review_assessment(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_calculate_term_results(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_publish_term_results(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_review_behavior_report(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_notify_parent_attendance() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_notify_parent_behavior_approval() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_notify_parent_results_published() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_teach_subject(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_is_homeroom_teacher(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_assessment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_manage_assessment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_enter_mark(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_mark(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_term_result(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_attendance_record(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_record_attendance(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_behavior_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_submit_behavior_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_review_behavior_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_parent_notification(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.school_can_mark_parent_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_mark_parent_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_seed_default_grading_categories(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_submit_assessment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_review_assessment(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_calculate_term_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_publish_term_results(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_review_behavior_report(uuid, boolean, text) TO authenticated;

