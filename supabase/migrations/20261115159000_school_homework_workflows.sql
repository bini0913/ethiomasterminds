CREATE TABLE IF NOT EXISTS public.school_homework_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  section_id uuid NOT NULL,
  teacher_membership_id uuid NOT NULL,
  subject_name text NOT NULL,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 180),
  instructions text NOT NULL CHECK (char_length(trim(instructions)) BETWEEN 1 AND 8000),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  review_feedback text,
  reviewed_by_membership_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (section_id, school_id) REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (teacher_membership_id, school_id) REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by_membership_id, school_id) REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  UNIQUE (id, school_id)
);

CREATE TABLE IF NOT EXISTS public.school_homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  homework_id uuid NOT NULL,
  student_membership_id uuid NOT NULL,
  response_text text,
  attachment_path text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'returned')),
  grade numeric(7,2) CHECK (grade IS NULL OR grade >= 0),
  feedback text,
  graded_by_membership_id uuid,
  graded_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (homework_id, school_id) REFERENCES public.school_homework_assignments(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (student_membership_id, school_id) REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (graded_by_membership_id, school_id) REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  UNIQUE (homework_id, student_membership_id)
);

CREATE INDEX IF NOT EXISTS school_homework_section_idx
  ON public.school_homework_assignments(section_id, status, due_at);
CREATE INDEX IF NOT EXISTS school_homework_submission_student_idx
  ON public.school_homework_submissions(student_membership_id, submitted_at DESC);

CREATE OR REPLACE FUNCTION public.school_can_view_homework(p_homework_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_homework_assignments homework
    JOIN public.school_memberships teacher ON teacher.id = homework.teacher_membership_id
    WHERE homework.id = p_homework_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(homework.school_id)
        OR (teacher.user_id = auth.uid() AND teacher.status = 'active')
        OR EXISTS (
          SELECT 1 FROM public.school_memberships student
          WHERE student.school_id = homework.school_id
            AND student.user_id = auth.uid()
            AND student.school_role = 'student'
            AND student.status IN ('active', 'suspended')
            AND student.section_id = homework.section_id
            AND homework.status = 'approved'
        )
        OR EXISTS (
          SELECT 1
          FROM public.school_parent_student_links link
          JOIN public.school_memberships parent ON parent.id = link.parent_membership_id
          JOIN public.school_memberships student ON student.id = link.student_membership_id
          WHERE link.school_id = homework.school_id
            AND link.status = 'active'
            AND parent.user_id = auth.uid()
            AND parent.status = 'active'
            AND student.status IN ('active', 'suspended')
            AND student.section_id = homework.section_id
            AND homework.status = 'approved'
        )
        OR (
          public.school_my_membership_id(homework.school_id) IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.school_teacher_assignments assignment
            WHERE assignment.teacher_membership_id = public.school_my_membership_id(homework.school_id)
              AND assignment.section_id = homework.section_id
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_validate_homework_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_actor := public.school_my_membership_id(NEW.school_id);
    IF v_actor IS NULL OR NEW.teacher_membership_id <> v_actor
       OR NOT public.school_can_teach_subject(NEW.section_id, NEW.subject_name) THEN
      RAISE EXCEPTION 'Homework must be created by the assigned teacher for the selected subject and section';
    END IF;
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'New homework must begin as a draft';
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(NEW.school_id, NEW.section_id, NEW.teacher_membership_id, NEW.subject_name,
         NEW.title, NEW.instructions, NEW.due_at, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.school_id, OLD.section_id, OLD.teacher_membership_id, OLD.subject_name,
         OLD.title, OLD.instructions, OLD.due_at, OLD.created_at) THEN
    RAISE EXCEPTION 'Homework assignment details are immutable after submission';
  END IF;

  IF current_setting('app.school_homework_submit', true) = 'true' THEN
    IF v_actor <> OLD.teacher_membership_id OR OLD.status NOT IN ('draft', 'rejected') OR NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'Only the assigned teacher can submit draft or rejected homework';
    END IF;
    RETURN NEW;
  END IF;

  IF current_setting('app.school_homework_review', true) = 'true' THEN
    IF OLD.status <> 'pending' OR NEW.status NOT IN ('approved', 'rejected') THEN
      RAISE EXCEPTION 'Only pending homework can be reviewed';
    END IF;
    RETURN NEW;
  END IF;

  v_actor := public.school_my_membership_id(OLD.school_id);
  IF v_actor <> OLD.teacher_membership_id OR OLD.status NOT IN ('draft', 'rejected')
     OR NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Only the assigned teacher can edit draft or rejected homework';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_submit_homework(p_homework_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_homework public.school_homework_assignments%ROWTYPE;
BEGIN
  SELECT * INTO v_homework FROM public.school_homework_assignments
  WHERE id = p_homework_id FOR UPDATE;
  IF v_homework.id IS NULL
     OR v_homework.teacher_membership_id <> public.school_my_membership_id(v_homework.school_id)
     OR v_homework.status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'Only the assigned teacher can submit draft or rejected homework';
  END IF;
  PERFORM set_config('app.school_homework_submit', 'true', true);
  UPDATE public.school_homework_assignments
  SET status = 'pending', review_feedback = NULL, updated_at = now()
  WHERE id = p_homework_id;
  PERFORM set_config('app.school_homework_submit', '', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_review_homework(
  p_homework_id uuid, p_approved boolean, p_feedback text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_homework public.school_homework_assignments%ROWTYPE;
  v_reviewer uuid;
BEGIN
  SELECT * INTO v_homework FROM public.school_homework_assignments
  WHERE id = p_homework_id FOR UPDATE;
  IF v_homework.id IS NULL OR v_homework.status <> 'pending'
     OR NOT public.school_is_admin(v_homework.school_id) THEN
    RAISE EXCEPTION 'Only School Admin can review pending homework';
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

CREATE OR REPLACE FUNCTION public.school_validate_homework_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_homework public.school_homework_assignments%ROWTYPE;
  v_actor uuid;
  v_student public.school_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_homework FROM public.school_homework_assignments
  WHERE id = NEW.homework_id AND school_id = NEW.school_id;
  SELECT * INTO v_student FROM public.school_memberships
  WHERE id = NEW.student_membership_id AND school_id = NEW.school_id;
  IF v_homework.id IS NULL OR v_student.id IS NULL THEN
    RAISE EXCEPTION 'Homework and student must belong to the same school';
  END IF;

  v_actor := public.school_my_membership_id(NEW.school_id);
  IF TG_OP = 'INSERT' THEN
    IF v_student.user_id <> auth.uid() OR v_student.school_role <> 'student'
       OR v_student.status <> 'active' OR v_student.section_id <> v_homework.section_id
       OR v_homework.status <> 'approved' THEN
      RAISE EXCEPTION 'Only an enrolled student can submit approved homework for their section';
    END IF;
    RETURN NEW;
  END IF;

  IF v_student.user_id = auth.uid() THEN
    IF NEW.grade IS DISTINCT FROM OLD.grade
       OR NEW.feedback IS DISTINCT FROM OLD.feedback
       OR NEW.graded_by_membership_id IS DISTINCT FROM OLD.graded_by_membership_id
       OR NEW.graded_at IS DISTINCT FROM OLD.graded_at
       OR NEW.status NOT IN ('submitted', 'returned') THEN
      RAISE EXCEPTION 'Students cannot change teacher grading fields';
    END IF;
  ELSIF v_actor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_teacher_assignments assignment
    WHERE assignment.teacher_membership_id = v_actor
      AND assignment.section_id = v_homework.section_id
      AND (assignment.assignment_kind = 'homeroom' OR assignment.subject_name = v_homework.subject_name)
  ) THEN
    IF NEW.homework_id IS DISTINCT FROM OLD.homework_id
       OR NEW.student_membership_id IS DISTINCT FROM OLD.student_membership_id
       OR NEW.response_text IS DISTINCT FROM OLD.response_text
       OR NEW.attachment_path IS DISTINCT FROM OLD.attachment_path THEN
      RAISE EXCEPTION 'Teachers can grade submissions but cannot edit student responses';
    END IF;
    NEW.graded_by_membership_id := v_actor;
    NEW.graded_at := now();
    NEW.status := CASE WHEN NEW.grade IS NULL THEN 'returned' ELSE 'graded' END;
  ELSE
    RAISE EXCEPTION 'Only the student or assigned teacher can update this submission';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.school_homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_homework_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_homework_read ON public.school_homework_assignments
FOR SELECT TO authenticated USING (public.school_can_view_homework(id));
CREATE POLICY school_homework_teacher_insert ON public.school_homework_assignments
FOR INSERT TO authenticated
WITH CHECK (teacher_membership_id = public.school_my_membership_id(school_id));
CREATE POLICY school_homework_teacher_update ON public.school_homework_assignments
FOR UPDATE TO authenticated
USING (teacher_membership_id = public.school_my_membership_id(school_id))
WITH CHECK (teacher_membership_id = public.school_my_membership_id(school_id));

CREATE POLICY school_homework_submissions_read ON public.school_homework_submissions
FOR SELECT TO authenticated
USING (
  public._is_extreme_admin()
  OR public.is_school_manager_or_admin(school_id)
  OR student_membership_id = public.school_my_membership_id(school_id)
  OR EXISTS (
    SELECT 1 FROM public.school_homework_assignments homework
    WHERE homework.id = homework_id
      AND public.school_can_view_homework(homework.id)
  )
);
CREATE POLICY school_homework_submissions_insert ON public.school_homework_submissions
FOR INSERT TO authenticated
WITH CHECK (student_membership_id = public.school_my_membership_id(school_id));
CREATE POLICY school_homework_submissions_update ON public.school_homework_submissions
FOR UPDATE TO authenticated
USING (
  student_membership_id = public.school_my_membership_id(school_id)
  OR public.is_school_manager_or_admin(school_id)
  OR EXISTS (
    SELECT 1 FROM public.school_homework_assignments homework
    WHERE homework.id = homework_id
      AND homework.teacher_membership_id = public.school_my_membership_id(school_id)
  )
)
WITH CHECK (
  student_membership_id = public.school_my_membership_id(school_id)
  OR public.is_school_manager_or_admin(school_id)
  OR EXISTS (
    SELECT 1 FROM public.school_homework_assignments homework
    WHERE homework.id = homework_id
      AND homework.teacher_membership_id = public.school_my_membership_id(school_id)
  )
);

GRANT SELECT, INSERT, UPDATE ON public.school_homework_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.school_homework_submissions TO authenticated;

DROP TRIGGER IF EXISTS school_homework_assignment_validate ON public.school_homework_assignments;
CREATE TRIGGER school_homework_assignment_validate
BEFORE INSERT OR UPDATE ON public.school_homework_assignments
FOR EACH ROW EXECUTE FUNCTION public.school_validate_homework_assignment();

DROP TRIGGER IF EXISTS school_homework_submission_validate ON public.school_homework_submissions;
CREATE TRIGGER school_homework_submission_validate
BEFORE INSERT OR UPDATE ON public.school_homework_submissions
FOR EACH ROW EXECUTE FUNCTION public.school_validate_homework_submission();

REVOKE ALL ON FUNCTION public.school_can_view_homework(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_validate_homework_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_submit_homework(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_review_homework(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_validate_homework_submission() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.school_can_view_homework(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_submit_homework(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_review_homework(uuid, boolean, text) TO authenticated;
