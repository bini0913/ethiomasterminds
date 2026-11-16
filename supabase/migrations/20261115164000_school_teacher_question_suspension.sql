ALTER TABLE public.school_memberships
  ADD COLUMN IF NOT EXISTS question_submission_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS question_submission_suspension_reason text,
  ADD COLUMN IF NOT EXISTS question_submission_suspended_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS question_submission_suspended_at timestamptz;

CREATE OR REPLACE FUNCTION public.school_set_teacher_question_suspension(
  p_teacher_membership_id uuid, p_suspended boolean, p_reason text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_teacher public.school_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_teacher FROM public.school_memberships
  WHERE id = p_teacher_membership_id AND school_role = 'teacher'
  FOR UPDATE;
  IF v_teacher.id IS NULL OR NOT public.school_is_admin(v_teacher.school_id) THEN
    RAISE EXCEPTION 'Only the School Admin can manage teacher question-submission suspensions';
  END IF;
  IF p_suspended AND nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required when suspending question submissions';
  END IF;
  UPDATE public.school_memberships
  SET question_submission_suspended = p_suspended,
      question_submission_suspension_reason = CASE WHEN p_suspended THEN trim(p_reason) ELSE NULL END,
      question_submission_suspended_by = CASE WHEN p_suspended THEN auth.uid() ELSE NULL END,
      question_submission_suspended_at = CASE WHEN p_suspended THEN now() ELSE NULL END
  WHERE id = p_teacher_membership_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_submit_quiz(p_quiz_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quiz public.quizzes%ROWTYPE;
  v_teacher public.school_memberships%ROWTYPE;
  v_count integer;
BEGIN
  SELECT * INTO v_quiz FROM public.quizzes WHERE id = p_quiz_id FOR UPDATE;
  IF v_quiz.id IS NULL OR NOT public.school_can_manage_school_quiz(p_quiz_id) THEN
    RAISE EXCEPTION 'Only the assigned teacher can submit this quiz';
  END IF;
  SELECT * INTO v_teacher FROM public.school_memberships
  WHERE id = v_quiz.school_teacher_membership_id AND school_id = v_quiz.school_id;
  IF coalesce(v_teacher.question_submission_suspended, false) THEN
    RAISE EXCEPTION 'Question submissions are temporarily suspended for this teacher: %',
      coalesce(v_teacher.question_submission_suspension_reason, 'Contact the School Admin');
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

REVOKE ALL ON FUNCTION public.school_set_teacher_question_suspension(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_set_teacher_question_suspension(uuid, boolean, text) TO authenticated;
