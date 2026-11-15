-- School-scoped quiz and library approval. Individual Learning content (school_id IS NULL)
-- keeps its existing behavior; school content is visible only within its school and after approval.

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS school_section_id uuid,
  ADD COLUMN IF NOT EXISTS school_teacher_membership_id uuid,
  ADD COLUMN IF NOT EXISTS school_review_status text,
  ADD COLUMN IF NOT EXISTS school_review_feedback text;

ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_school_section_fk
    FOREIGN KEY (school_section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT quizzes_school_teacher_fk
    FOREIGN KEY (school_teacher_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT quizzes_school_review_status_check
    CHECK (school_review_status IS NULL OR school_review_status IN ('draft', 'pending', 'approved', 'rejected')),
  ADD CONSTRAINT quizzes_school_scope_check
    CHECK (
      (school_id IS NULL AND school_section_id IS NULL AND school_teacher_membership_id IS NULL AND school_review_status IS NULL)
      OR
      (school_id IS NOT NULL AND school_section_id IS NOT NULL AND school_teacher_membership_id IS NOT NULL AND school_review_status IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS quizzes_school_scope_idx
  ON public.quizzes(school_id, school_section_id, school_review_status)
  WHERE school_id IS NOT NULL;

ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS school_section_id uuid,
  ADD COLUMN IF NOT EXISTS school_teacher_membership_id uuid,
  ADD COLUMN IF NOT EXISTS school_grade_label text,
  ADD COLUMN IF NOT EXISTS school_review_status text;

ALTER TABLE public.library_books
  ADD CONSTRAINT library_books_school_section_fk
    FOREIGN KEY (school_section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT library_books_school_teacher_fk
    FOREIGN KEY (school_teacher_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT library_books_school_review_status_check
    CHECK (school_review_status IS NULL OR school_review_status IN ('draft', 'pending', 'approved', 'rejected')),
  ADD CONSTRAINT library_books_school_scope_check
    CHECK (
      (school_id IS NULL AND school_section_id IS NULL AND school_teacher_membership_id IS NULL AND school_grade_label IS NULL AND school_review_status IS NULL)
      OR
      (school_id IS NOT NULL AND school_section_id IS NOT NULL AND school_teacher_membership_id IS NOT NULL AND school_grade_label IS NOT NULL AND school_review_status IS NOT NULL)
    ),
  ADD CONSTRAINT library_books_id_school_id_unique UNIQUE (id, school_id);

ALTER TABLE public.book_uploads
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS school_section_id uuid,
  ADD COLUMN IF NOT EXISTS school_teacher_membership_id uuid,
  ADD COLUMN IF NOT EXISTS school_review_status text;

ALTER TABLE public.book_uploads
  ADD CONSTRAINT book_uploads_school_section_fk
    FOREIGN KEY (school_section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT book_uploads_school_teacher_fk
    FOREIGN KEY (school_teacher_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT book_uploads_school_book_fk
    FOREIGN KEY (book_id, school_id)
    REFERENCES public.library_books(id, school_id) ON DELETE RESTRICT,
  ADD CONSTRAINT book_uploads_school_review_status_check
    CHECK (school_review_status IS NULL OR school_review_status IN ('draft', 'pending', 'approved', 'rejected')),
  ADD CONSTRAINT book_uploads_school_scope_check
    CHECK (
      (school_id IS NULL AND school_section_id IS NULL AND school_teacher_membership_id IS NULL AND school_review_status IS NULL)
      OR
      (school_id IS NOT NULL AND school_section_id IS NOT NULL AND school_teacher_membership_id IS NOT NULL AND school_review_status IS NOT NULL)
    );

CREATE TABLE IF NOT EXISTS public.school_content_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  content_type text NOT NULL CHECK (content_type IN ('quiz', 'library_book')),
  content_id uuid NOT NULL,
  submitted_by_membership_id uuid NOT NULL,
  reviewed_by_membership_id uuid NOT NULL,
  review_status text NOT NULL CHECK (review_status IN ('approved', 'rejected')),
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (submitted_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS school_content_review_events_school_idx
  ON public.school_content_review_events(school_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.school_can_manage_school_quiz(p_quiz_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.quizzes quiz
    JOIN public.school_memberships teacher
      ON teacher.id = quiz.school_teacher_membership_id
     AND teacher.school_id = quiz.school_id
    WHERE quiz.id = p_quiz_id
      AND quiz.school_id IS NOT NULL
      AND quiz.school_review_status IN ('draft', 'rejected')
      AND quiz.created_by = auth.uid()
      AND teacher.user_id = auth.uid()
      AND teacher.school_role = 'teacher'
      AND teacher.status = 'active'
      AND public.school_can_teach_subject(quiz.school_id, quiz.school_section_id, quiz.subject)
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_school_quiz(p_quiz_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.quizzes quiz
    WHERE quiz.id = p_quiz_id
      AND quiz.school_id IS NOT NULL
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(quiz.school_id)
        OR public.school_can_teach_subject(quiz.school_id, quiz.school_section_id, quiz.subject)
        OR (
          quiz.school_review_status = 'approved'
          AND EXISTS (
            SELECT 1 FROM public.school_memberships student
            WHERE student.user_id = auth.uid()
              AND student.school_id = quiz.school_id
              AND student.school_role = 'student'
              AND student.status IN ('active', 'suspended')
              AND student.section_id = quiz.school_section_id
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_validate_quiz_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_teacher public.school_memberships%ROWTYPE;
  v_grade text;
  v_transition text := coalesce(current_setting('app.school_quiz_transition', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.school_id IS NULL THEN RETURN NEW; END IF;
    SELECT * INTO v_teacher FROM public.school_memberships
    WHERE id = NEW.school_teacher_membership_id AND school_id = NEW.school_id;
    SELECT grade_label INTO v_grade FROM public.school_sections
    WHERE id = NEW.school_section_id AND school_id = NEW.school_id;
    IF NEW.created_by <> auth.uid()
       OR v_teacher.id IS NULL
       OR v_teacher.user_id <> auth.uid()
       OR v_teacher.school_role <> 'teacher'
       OR v_teacher.status <> 'active'
       OR v_grade IS NULL
       OR NEW.grade IS DISTINCT FROM v_grade
       OR NEW.school_review_status <> 'draft'
       OR coalesce(NEW.is_approved, false) = true
       OR coalesce(NEW.is_public, false) = true
       OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL
       OR NOT public.school_can_teach_subject(NEW.school_id, NEW.school_section_id, NEW.subject) THEN
      RAISE EXCEPTION 'School quizzes must be created by an assigned teacher as private drafts';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.school_id IS NULL THEN
    IF NEW.school_id IS NOT NULL THEN
      RAISE EXCEPTION 'Existing Individual Learning quizzes cannot be converted into school quizzes';
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(NEW.school_id, NEW.school_section_id, NEW.school_teacher_membership_id,
         NEW.created_by, NEW.grade, NEW.subject, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.school_id, OLD.school_section_id, OLD.school_teacher_membership_id,
         OLD.created_by, OLD.grade, OLD.subject, OLD.created_at) THEN
    RAISE EXCEPTION 'School quiz ownership and scope are immutable';
  END IF;

  IF (NEW.school_review_status IS DISTINCT FROM OLD.school_review_status
      OR NEW.is_approved IS DISTINCT FROM OLD.is_approved
      OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
      OR NEW.school_review_feedback IS DISTINCT FROM OLD.school_review_feedback)
     AND v_transition NOT IN ('submit', 'review') THEN
    RAISE EXCEPTION 'School quiz submission and review must use the guarded workflow';
  END IF;

  IF v_transition = '' AND NOT public.school_can_manage_school_quiz(OLD.id) THEN
    RAISE EXCEPTION 'Only the assigned quiz creator can edit a draft or rejected quiz';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_validate_school_quiz_question()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quiz_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.quiz_id ELSE NEW.quiz_id END;
BEGIN
  IF EXISTS (SELECT 1 FROM public.quizzes WHERE id = v_quiz_id AND school_id IS NOT NULL)
     AND NOT public.school_can_manage_school_quiz(v_quiz_id) THEN
    RAISE EXCEPTION 'Questions can only be changed while the assigned teacher quiz is a draft or rejected';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_submit_quiz(p_quiz_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.school_can_manage_school_quiz(p_quiz_id) THEN
    RAISE EXCEPTION 'Only the assigned teacher can submit this quiz';
  END IF;
  SELECT count(*) INTO v_count FROM public.questions WHERE quiz_id = p_quiz_id;
  IF v_count = 0 THEN RAISE EXCEPTION 'A quiz must contain at least one question'; END IF;
  PERFORM set_config('app.school_quiz_transition', 'submit', true);
  UPDATE public.quizzes
  SET school_review_status = 'pending', is_approved = false, is_public = false
  WHERE id = p_quiz_id;
  PERFORM set_config('app.school_quiz_transition', '', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_review_quiz(
  p_quiz_id uuid, p_approved boolean, p_feedback text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quiz public.quizzes%ROWTYPE;
  v_reviewer_id uuid;
BEGIN
  SELECT * INTO v_quiz FROM public.quizzes WHERE id = p_quiz_id FOR UPDATE;
  IF v_quiz.id IS NULL OR v_quiz.school_id IS NULL
     OR NOT public.school_is_admin(v_quiz.school_id)
     OR v_quiz.school_review_status <> 'pending' THEN
    RAISE EXCEPTION 'Only the School Admin can review a pending school quiz';
  END IF;
  SELECT id INTO v_reviewer_id FROM public.school_memberships
  WHERE school_id = v_quiz.school_id AND user_id = auth.uid()
    AND school_role = 'admin' AND status = 'active'
  LIMIT 1;
  IF v_reviewer_id IS NULL AND NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Active School Admin membership required';
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
    )
    VALUES (
      v_quiz.school_id, 'quiz', v_quiz.id, v_quiz.school_teacher_membership_id,
      v_reviewer_id, CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      nullif(trim(p_feedback), '')
    );
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_can_manage_library_book(p_book_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.library_books book
    JOIN public.school_memberships teacher
      ON teacher.id = book.school_teacher_membership_id
     AND teacher.school_id = book.school_id
    WHERE book.id = p_book_id
      AND book.school_id IS NOT NULL
      AND book.school_review_status IN ('draft', 'rejected')
      AND book.uploader_id = auth.uid()
      AND teacher.user_id = auth.uid()
      AND teacher.school_role = 'teacher'
      AND teacher.status = 'active'
      AND public.school_can_teach_subject(book.school_id, book.school_section_id, book.subject)
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_library_book(p_book_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.library_books book
    WHERE book.id = p_book_id
      AND book.school_id IS NOT NULL
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(book.school_id)
        OR public.school_can_teach_subject(book.school_id, book.school_section_id, book.subject)
        OR (
          book.school_review_status = 'approved'
          AND EXISTS (
            SELECT 1 FROM public.school_memberships student
            WHERE student.user_id = auth.uid()
              AND student.school_id = book.school_id
              AND student.school_role = 'student'
              AND student.status IN ('active', 'suspended')
              AND student.section_id = book.school_section_id
          )
        )
        OR (
          book.school_review_status = 'approved'
          AND EXISTS (
            SELECT 1
            FROM public.school_parent_student_links link
            JOIN public.school_memberships parent ON parent.id = link.parent_membership_id
            JOIN public.school_memberships student ON student.id = link.student_membership_id
            WHERE parent.user_id = auth.uid()
              AND parent.status = 'active'
              AND link.status = 'active'
              AND student.school_id = book.school_id
              AND student.status IN ('active', 'suspended')
              AND student.section_id = book.school_section_id
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_validate_library_book_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_teacher public.school_memberships%ROWTYPE;
  v_grade text;
  v_transition text := coalesce(current_setting('app.school_book_transition', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.school_id IS NOT NULL THEN
      RAISE EXCEPTION 'School library content must be submitted through the school review workflow';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.school_id IS NULL AND NEW.school_id IS NOT NULL THEN
    IF v_transition <> 'submit' THEN
      RAISE EXCEPTION 'School library submission must use the guarded workflow';
    END IF;
    SELECT * INTO v_teacher FROM public.school_memberships
    WHERE id = NEW.school_teacher_membership_id AND school_id = NEW.school_id;
    SELECT grade_label INTO v_grade FROM public.school_sections
    WHERE id = NEW.school_section_id AND school_id = NEW.school_id;
    IF NEW.uploader_id <> auth.uid()
       OR v_teacher.id IS NULL OR v_teacher.user_id <> auth.uid()
       OR v_teacher.school_role <> 'teacher' OR v_teacher.status <> 'active'
       OR v_grade IS NULL OR NEW.school_grade_label IS DISTINCT FROM v_grade
       OR NEW.school_review_status <> 'pending'
       OR NOT public.school_can_teach_subject(NEW.school_id, NEW.school_section_id, NEW.subject) THEN
      RAISE EXCEPTION 'Library content must be submitted by a teacher assigned to the subject and section';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.school_id IS NOT NULL THEN
    IF ROW(NEW.school_id, NEW.school_section_id, NEW.school_teacher_membership_id,
           NEW.school_grade_label, NEW.uploader_id, NEW.subject, NEW.created_at)
       IS DISTINCT FROM
       ROW(OLD.school_id, OLD.school_section_id, OLD.school_teacher_membership_id,
           OLD.school_grade_label, OLD.uploader_id, OLD.subject, OLD.created_at) THEN
      RAISE EXCEPTION 'School library content ownership and scope are immutable';
    END IF;
    IF NEW.school_review_status IS DISTINCT FROM OLD.school_review_status
       AND v_transition <> 'review' THEN
      RAISE EXCEPTION 'School library review status must use the guarded workflow';
    END IF;
    IF v_transition = '' AND NOT public.school_can_manage_library_book(OLD.id) THEN
      RAISE EXCEPTION 'Only the assigned teacher can edit a draft or rejected library item';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_validate_book_upload_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_book public.library_books%ROWTYPE;
  v_transition text := coalesce(current_setting('app.school_book_transition', true), '');
BEGIN
  SELECT * INTO v_book FROM public.library_books WHERE id = NEW.book_id;
  IF v_book.id IS NULL THEN RAISE EXCEPTION 'Library book not found'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.school_id IS NOT NULL THEN RAISE EXCEPTION 'School upload must be created by the submission workflow'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.school_section_id IS DISTINCT FROM OLD.school_section_id
     OR NEW.school_teacher_membership_id IS DISTINCT FROM OLD.school_teacher_membership_id
     OR NEW.school_review_status IS DISTINCT FROM OLD.school_review_status THEN
    IF v_transition NOT IN ('submit', 'review') THEN
      RAISE EXCEPTION 'School upload review fields must use the guarded workflow';
    END IF;
  END IF;
  IF NEW.school_id IS NOT NULL
     AND (v_book.school_id IS DISTINCT FROM NEW.school_id
          OR v_book.school_section_id IS DISTINCT FROM NEW.school_section_id
          OR v_book.school_teacher_membership_id IS DISTINCT FROM NEW.school_teacher_membership_id
          OR v_book.school_review_status IS DISTINCT FROM NEW.school_review_status) THEN
    RAISE EXCEPTION 'Upload moderation scope must match its library book';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_submit_library_book(
  p_book_id uuid, p_section_id uuid
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_book public.library_books%ROWTYPE;
  v_teacher public.school_memberships%ROWTYPE;
  v_grade text;
BEGIN
  SELECT * INTO v_book FROM public.library_books WHERE id = p_book_id FOR UPDATE;
  IF v_book.id IS NULL OR v_book.uploader_id <> auth.uid() OR v_book.school_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only the uploader can submit an unassigned library item to a school';
  END IF;
  SELECT * INTO v_teacher FROM public.school_memberships
  WHERE user_id = auth.uid() AND school_role = 'teacher' AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;
  IF v_teacher.id IS NULL THEN RAISE EXCEPTION 'Active School Teacher membership required'; END IF;
  SELECT grade_label INTO v_grade FROM public.school_sections
  WHERE id = p_section_id AND school_id = v_teacher.school_id;
  IF v_grade IS NULL OR NOT public.school_can_teach_subject(v_teacher.school_id, p_section_id, v_book.subject) THEN
    RAISE EXCEPTION 'Teacher is not assigned to this subject and section';
  END IF;

  PERFORM set_config('app.school_book_transition', 'submit', true);
  UPDATE public.library_books
  SET school_id = v_teacher.school_id,
      school_section_id = p_section_id,
      school_teacher_membership_id = v_teacher.id,
      school_grade_label = v_grade,
      school_review_status = 'pending',
      status = 'pending'
  WHERE id = p_book_id;

  INSERT INTO public.book_uploads(
    book_id, uploader_id, status, school_id, school_section_id,
    school_teacher_membership_id, school_review_status
  )
  VALUES (
    p_book_id, auth.uid(), 'pending', v_teacher.school_id, p_section_id,
    v_teacher.id, 'pending'
  )
  ON CONFLICT (book_id)
  DO UPDATE SET
    status = 'pending',
    school_id = EXCLUDED.school_id,
    school_section_id = EXCLUDED.school_section_id,
    school_teacher_membership_id = EXCLUDED.school_teacher_membership_id,
    school_review_status = 'pending',
    updated_at = now();

  PERFORM set_config('app.school_book_transition', '', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_review_library_book(
  p_book_id uuid, p_approved boolean, p_feedback text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_book public.library_books%ROWTYPE;
  v_reviewer_id uuid;
BEGIN
  SELECT * INTO v_book FROM public.library_books WHERE id = p_book_id FOR UPDATE;
  IF v_book.id IS NULL OR v_book.school_id IS NULL
     OR NOT public.school_is_admin(v_book.school_id)
     OR v_book.school_review_status <> 'pending' THEN
    RAISE EXCEPTION 'Only the School Admin can review a pending school library item';
  END IF;
  SELECT id INTO v_reviewer_id FROM public.school_memberships
  WHERE school_id = v_book.school_id AND user_id = auth.uid()
    AND school_role = 'admin' AND status = 'active'
  LIMIT 1;
  IF v_reviewer_id IS NULL AND NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Active School Admin membership required';
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
    )
    VALUES (
      v_book.school_id, 'library_book', v_book.id, v_book.school_teacher_membership_id,
      v_reviewer_id, CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
      nullif(trim(p_feedback), '')
    );
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_content_review_event(p_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_content_review_events event
    JOIN public.school_memberships submitter ON submitter.id = event.submitted_by_membership_id
    WHERE event.id = p_event_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(event.school_id)
        OR submitter.user_id = auth.uid()
      )
  );
$$;

DROP POLICY IF EXISTS "authenticated can view public/own quizzes" ON public.quizzes;
CREATE POLICY "authenticated can view public/own quizzes" ON public.quizzes
FOR SELECT TO authenticated
USING (
  (school_id IS NULL AND (
    is_public = true OR created_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  ))
  OR (school_id IS NOT NULL AND public.school_can_view_school_quiz(id))
);

DROP POLICY IF EXISTS "creator manages own quiz" ON public.quizzes;
CREATE POLICY "creator manages own quiz" ON public.quizzes
FOR ALL TO authenticated
USING (
  (school_id IS NULL AND (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  ))
  OR (school_id IS NOT NULL AND public.school_can_manage_school_quiz(id))
)
WITH CHECK (
  (school_id IS NULL AND (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  ))
  OR (school_id IS NOT NULL AND public.school_can_manage_school_quiz(id))
);

DROP POLICY IF EXISTS "view questions of visible quiz" ON public.questions;
CREATE POLICY "view questions of visible quiz" ON public.questions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes quiz
    WHERE quiz.id = questions.quiz_id
      AND (
        (quiz.school_id IS NULL AND (
          quiz.is_public = true OR quiz.created_by = auth.uid()
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'manager'::app_role)
          OR has_role(auth.uid(), 'teacher'::app_role)
        ))
        OR (quiz.school_id IS NOT NULL AND public.school_can_view_school_quiz(quiz.id))
      )
  )
);

DROP POLICY IF EXISTS "quiz creator manages questions" ON public.questions;
CREATE POLICY "quiz creator manages questions" ON public.questions
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes quiz
    WHERE quiz.id = questions.quiz_id
      AND (
        (quiz.school_id IS NULL AND (
          quiz.created_by = auth.uid()
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'manager'::app_role)
        ))
        OR (quiz.school_id IS NOT NULL AND public.school_can_manage_school_quiz(quiz.id))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quizzes quiz
    WHERE quiz.id = questions.quiz_id
      AND (
        (quiz.school_id IS NULL AND (
          quiz.created_by = auth.uid()
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'manager'::app_role)
        ))
        OR (quiz.school_id IS NOT NULL AND public.school_can_manage_school_quiz(quiz.id))
      )
  )
);

DROP POLICY IF EXISTS "authenticated can view approved books" ON public.library_books;
CREATE POLICY "authenticated can view approved books" ON public.library_books
FOR SELECT TO authenticated
USING (
  (school_id IS NULL AND (
    status = 'approved' OR uploader_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  ))
  OR (school_id IS NOT NULL AND public.school_can_view_library_book(id))
);

DROP POLICY IF EXISTS "uploader manages own book" ON public.library_books;
CREATE POLICY "uploader manages own book" ON public.library_books
FOR ALL TO authenticated
USING (
  (school_id IS NULL AND (
    uploader_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  ))
  OR (school_id IS NOT NULL AND public.school_can_manage_library_book(id))
)
WITH CHECK (
  (school_id IS NULL AND (
    uploader_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  ))
  OR (school_id IS NOT NULL AND public.school_can_manage_library_book(id))
);

DROP POLICY IF EXISTS "uploader can view own upload" ON public.book_uploads;
CREATE POLICY "uploader can view own upload" ON public.book_uploads
FOR SELECT TO authenticated
USING (
  (school_id IS NULL AND (
    uploader_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  ))
  OR (
    school_id IS NOT NULL
    AND (
      uploader_id = auth.uid()
      OR public.school_is_admin(school_id)
      OR public.school_is_manager(school_id)
    )
  )
);

DROP POLICY IF EXISTS "uploader manages own upload" ON public.book_uploads;
CREATE POLICY "uploader manages own upload" ON public.book_uploads
FOR ALL TO authenticated
USING (
  (school_id IS NULL AND (
    uploader_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  ))
  OR (school_id IS NOT NULL AND public.school_can_manage_library_book(book_id))
)
WITH CHECK (
  (school_id IS NULL AND (
    uploader_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  ))
  OR (school_id IS NOT NULL AND public.school_can_manage_library_book(book_id))
);

ALTER TABLE public.school_content_review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_content_review_events_read ON public.school_content_review_events
FOR SELECT TO authenticated
USING (public.school_can_view_content_review_event(id));

CREATE TRIGGER school_quiz_validate
BEFORE INSERT OR UPDATE ON public.quizzes
FOR EACH ROW EXECUTE FUNCTION public.school_validate_quiz_mutation();

CREATE TRIGGER school_quiz_question_validate
BEFORE INSERT OR UPDATE OR DELETE ON public.questions
FOR EACH ROW EXECUTE FUNCTION public.school_validate_school_quiz_question();

CREATE TRIGGER school_library_book_validate
BEFORE INSERT OR UPDATE ON public.library_books
FOR EACH ROW EXECUTE FUNCTION public.school_validate_library_book_mutation();

CREATE TRIGGER school_book_upload_validate
BEFORE INSERT OR UPDATE ON public.book_uploads
FOR EACH ROW EXECUTE FUNCTION public.school_validate_book_upload_mutation();

REVOKE ALL ON FUNCTION public.school_can_manage_school_quiz(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_school_quiz(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_validate_quiz_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_validate_school_quiz_question() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_submit_quiz(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_review_quiz(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_manage_library_book(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_library_book(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_validate_library_book_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_validate_book_upload_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_submit_library_book(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_review_library_book(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_content_review_event(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.school_can_manage_school_quiz(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_school_quiz(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_submit_quiz(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_review_quiz(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_manage_library_book(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_library_book(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_submit_library_book(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_review_library_book(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_content_review_event(uuid) TO authenticated;
