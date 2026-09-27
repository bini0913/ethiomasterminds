-- Production hardening batch: close remaining client-side reward and quiz integrity paths.

-- add_xp is a legacy internal helper. Client code must not be able to call it
-- directly because it changes XP and can also mint wallet coins.
REVOKE ALL ON FUNCTION public.add_xp(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_xp(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.add_xp(uuid, integer) TO service_role;

-- Season reset backups contain historical student ranking/balance data.
-- They are administrative data, not public leaderboard data.
DROP POLICY IF EXISTS "season_reset_backups_public_read" ON public.season_reset_backups;
CREATE POLICY "season_reset_backups_admin_read"
  ON public.season_reset_backups
  FOR SELECT
  TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin', 'extreme_admin'));

-- The runtime state is intentionally public-read because the student leaderboard
-- displays the active season name/number. Writes remain service-role only.
REVOKE INSERT, UPDATE, DELETE ON public.season_reset_backups FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.season_runtime_state FROM authenticated;

-- Enforce tier compatibility and sane elapsed time inside the authoritative
-- quiz submission function. The client cannot submit another tier's approved
-- quiz merely by knowing its UUID.
CREATE OR REPLACE FUNCTION public.submit_quiz_result_secure(
  p_quiz_id uuid,
  p_answers jsonb,
  p_time_taken integer,
  p_submission_id uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_grade text;
  v_user_tier text;
  v_quiz public.quizzes%ROWTYPE;
  v_quiz_grade_number integer;
  v_user_grade_number integer;
  v_total integer;
  v_correct integer := 0;
  v_score integer := 0;
  v_xp integer := 0;
  v_question record;
  v_selected text;
  v_correct_bool boolean;
  v_time_taken integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'Answers payload must be a JSON object';
  END IF;

  IF jsonb_object_length(p_answers) > 100 THEN
    RAISE EXCEPTION 'Answers payload is too large';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quiz_results WHERE submission_id = p_submission_id
  ) THEN
    RAISE EXCEPTION 'Duplicate submission';
  END IF;

  SELECT grade
    INTO v_user_grade
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_grade IS NULL THEN
    RAISE EXCEPTION 'Student grade is required';
  END IF;

  v_user_grade_number := NULLIF(regexp_replace(lower(trim(v_user_grade)), '[^0-9]', '', 'g'), '')::integer;

  IF lower(trim(v_user_grade)) ~ '^(k|kindergarten|pre-?k)$' THEN
    v_user_tier := 'early';
  ELSIF v_user_grade_number BETWEEN 1 AND 4 THEN
    v_user_tier := 'early';
  ELSIF v_user_grade_number BETWEEN 5 AND 8 THEN
    v_user_tier := 'middle';
  ELSIF v_user_grade_number BETWEEN 9 AND 12 THEN
    v_user_tier := 'upper';
  ELSE
    RAISE EXCEPTION 'Unsupported student grade';
  END IF;

  SELECT * INTO v_quiz
  FROM public.quizzes
  WHERE id = p_quiz_id
    AND is_approved = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No quiz available';
  END IF;

  v_quiz_grade_number := NULLIF(regexp_replace(lower(trim(v_quiz.grade)), '[^0-9]', '', 'g'), '')::integer;

  IF lower(trim(v_quiz.grade)) ~ '^(k|kindergarten|pre-?k)$' THEN
    IF v_user_tier <> 'early' THEN
      RAISE EXCEPTION 'Quiz is not available for this student tier';
    END IF;
  ELSIF v_quiz_grade_number IS NULL THEN
    RAISE EXCEPTION 'Quiz grade is invalid';
  ELSIF (
    (v_user_tier = 'early' AND v_quiz_grade_number NOT BETWEEN 1 AND 4)
    OR (v_user_tier = 'middle' AND v_quiz_grade_number NOT BETWEEN 5 AND 8)
    OR (v_user_tier = 'upper' AND v_quiz_grade_number NOT BETWEEN 9 AND 12)
  ) THEN
    RAISE EXCEPTION 'Quiz is not available for this student tier';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.questions
  WHERE quiz_id = p_quiz_id;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'No questions available';
  END IF;

  v_time_taken := greatest(
    0,
    least(
      coalesce(p_time_taken, 0),
      coalesce(nullif(v_quiz.time_limit, 0), 3600)
    )
  );

  FOR v_question IN
    SELECT id, correct_answer, coalesce(difficulty, v_quiz.difficulty) AS difficulty, points
    FROM public.questions
    WHERE quiz_id = p_quiz_id
    ORDER BY order_index, created_at
  LOOP
    v_selected := p_answers ->> (v_question.id::text);
    v_correct_bool := v_selected IS NOT NULL AND v_selected = v_question.correct_answer;

    IF v_correct_bool THEN
      v_correct := v_correct + 1;
      v_score := v_score + COALESCE(v_question.points, 10);
      CASE lower(v_question.difficulty)
        WHEN 'easy' THEN v_xp := v_xp + 2;
        WHEN 'medium' THEN v_xp := v_xp + 4;
        WHEN 'hard' THEN v_xp := v_xp + 6;
        ELSE v_xp := v_xp + 8;
      END CASE;
    ELSE
      CASE lower(v_question.difficulty)
        WHEN 'hard' THEN v_xp := v_xp - 2;
        WHEN 'extreme' THEN v_xp := v_xp - 3;
        ELSE v_xp := v_xp;
      END CASE;
    END IF;

    INSERT INTO public.question_attempts (
      user_id, question_id, quiz_id, selected_answer,
      is_correct, time_taken_seconds, attempt_number
    ) VALUES (
      v_user_id,
      v_question.id,
      p_quiz_id,
      coalesce(v_selected, 'no_answer'),
      v_correct_bool,
      greatest(1, v_time_taken / greatest(v_total, 1)),
      1
    );
  END LOOP;

  INSERT INTO public.quiz_results (
    quiz_id, student_id, score, total_questions, correct_answers,
    time_taken, xp_earned, answers, submission_id
  ) VALUES (
    p_quiz_id, v_user_id, v_score, v_total, v_correct,
    v_time_taken, v_xp, p_answers, p_submission_id
  );

  RETURN jsonb_build_object(
    'quiz_id', p_quiz_id,
    'score', v_score,
    'total_questions', v_total,
    'correct_answers', v_correct,
    'time_taken', v_time_taken,
    'xp_earned', v_xp,
    'difficulty', v_quiz.difficulty
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) TO authenticated;
