-- Production hardening batch: close remaining reward, admin-RPC, and quiz trust gaps.
-- Safe to apply after the existing reward/competition hardening migrations.

-- 1) The legacy generic XP function must not be callable from the browser.
-- Server-side functions can still invoke it internally.
REVOKE EXECUTE ON FUNCTION public.add_xp(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_xp(uuid, integer) FROM authenticated;

-- 2) Admin season read RPCs are SECURITY DEFINER, so enforce the role inside
-- the function rather than relying on RLS or the client UI.
CREATE OR REPLACE FUNCTION public.admin_get_current_season_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state public.season_runtime_state%ROWTYPE;
  v_total_users integer;
  v_total_xp bigint;
  v_top_name text;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'extreme_admin')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_state FROM public.season_runtime_state WHERE id = 1;
  SELECT COUNT(*), COALESCE(SUM(season_xp),0)
    INTO v_total_users, v_total_xp
    FROM public.profiles
    WHERE season_xp > 0;
  SELECT name INTO v_top_name
    FROM public.profiles
    ORDER BY season_xp DESC NULLS LAST
    LIMIT 1;

  RETURN jsonb_build_object(
    'season_name', v_state.current_season_name,
    'season_number', v_state.season_number,
    'started_at', v_state.started_at,
    'total_users', COALESCE(v_total_users,0),
    'total_xp', COALESCE(v_total_xp,0),
    'top_player', COALESCE(v_top_name,'—')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_season_rewards_preview(
  p_conversion_rate numeric DEFAULT 0.1,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  user_id uuid,
  name text,
  season_xp integer,
  projected_rank integer,
  projected_coins integer,
  projected_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'extreme_admin')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF p_conversion_rate IS NULL OR p_conversion_rate < 0 OR p_conversion_rate > 100 THEN
    RAISE EXCEPTION 'Invalid conversion rate';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Invalid result limit';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    COALESCE(p.season_xp,0),
    ROW_NUMBER() OVER (ORDER BY p.season_xp DESC NULLS LAST)::int,
    GREATEST(0, FLOOR(COALESCE(p.season_xp,0) * p_conversion_rate))::int,
    CASE
      WHEN ROW_NUMBER() OVER (ORDER BY p.season_xp DESC NULLS LAST) = 1 THEN 'Champion'
      WHEN ROW_NUMBER() OVER (ORDER BY p.season_xp DESC NULLS LAST) <= 3 THEN 'Podium'
      WHEN ROW_NUMBER() OVER (ORDER BY p.season_xp DESC NULLS LAST) <= 10 THEN 'Top 10'
      ELSE NULL
    END
  FROM public.profiles p
  WHERE COALESCE(p.season_xp,0) > 0
  ORDER BY p.season_xp DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- Keep the admin-only functions callable by authenticated staff, while the
-- function bodies enforce authorization.
GRANT EXECUTE ON FUNCTION public.admin_get_current_season_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_season_rewards_preview(numeric, integer) TO authenticated;

-- 3) Adaptive quiz selection must not let a student request another tier's
-- curriculum by supplying an arbitrary grade.
CREATE OR REPLACE FUNCTION public.get_adaptive_quiz(
  p_grade text,
  p_subject text,
  p_level integer
)
RETURNS TABLE (
  quiz_id uuid,
  title text,
  grade text,
  subject text,
  difficulty text,
  level_min integer,
  level_max integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH caller AS (
    SELECT lower(trim(COALESCE(grade,''))) AS grade
    FROM public.profiles
    WHERE id = auth.uid()
  ),
  target AS (
    SELECT CASE
      WHEN p_level BETWEEN 1 AND 5 THEN 'easy'
      WHEN p_level BETWEEN 6 AND 10 THEN 'medium'
      WHEN p_level BETWEEN 11 AND 20 THEN 'hard'
      ELSE 'extreme'
    END AS wanted_difficulty
  )
  SELECT q.id, q.title, q.grade, q.subject, q.difficulty, q.level_min, q.level_max
  FROM public.quizzes q
  CROSS JOIN target t
  CROSS JOIN caller c
  WHERE auth.uid() IS NOT NULL
    AND q.is_approved = true
    AND lower(q.subject) = lower(trim(p_subject))
    AND lower(q.difficulty) = t.wanted_difficulty
    AND (
      (
        lower(trim(p_grade)) ~ '^(k|kindergarten|pre-?k)$'
        OR lower(trim(p_grade)) ~ '^(?:grade\s*)?[1-4][a-z]?$'
      ) AND (
        c.grade ~ '^(k|kindergarten|pre-?k)$'
        OR c.grade ~ '^(?:grade\s*)?[1-4][a-z]?$'
      )
      OR
      (
        lower(trim(p_grade)) ~ '^(?:grade\s*)?[5-8][a-z]?$'
        AND c.grade ~ '^(?:grade\s*)?[5-8][a-z]?$'
      )
      OR
      (
        lower(trim(p_grade)) ~ '^(?:grade\s*)?(?:9|10|11|12)[a-z]?$'
        AND c.grade ~ '^(?:grade\s*)?(?:9|10|11|12)[a-z]?$'
      )
    )
    AND lower(q.grade) = lower(trim(p_grade))
  ORDER BY q.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_adaptive_quiz(text,text,integer) TO authenticated;

-- 4) Secure quiz submission: bound timing and enforce that the submitted quiz
-- belongs to the authenticated student's tier.
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
  v_quiz public.quizzes%ROWTYPE;
  v_total integer;
  v_correct integer := 0;
  v_score integer := 0;
  v_xp integer := 0;
  v_question record;
  v_selected text;
  v_correct_bool boolean;
  v_tier_matches boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_submission_id IS NULL THEN
    RAISE EXCEPTION 'Submission id is required';
  END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'Answers payload must be a JSON object';
  END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_results WHERE submission_id = p_submission_id) THEN
    RAISE EXCEPTION 'Duplicate submission';
  END IF;

  SELECT lower(trim(COALESCE(grade,''))) INTO v_user_grade
  FROM public.profiles
  WHERE id = v_user_id;

  SELECT * INTO v_quiz
  FROM public.quizzes
  WHERE id = p_quiz_id
    AND is_approved = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No quiz available';
  END IF;

  v_tier_matches :=
    (
      (
        lower(trim(v_quiz.grade)) ~ '^(k|kindergarten|pre-?k)$'
        OR lower(trim(v_quiz.grade)) ~ '^(?:grade\s*)?[1-4][a-z]?$'
      )
      AND
      (
        v_user_grade ~ '^(k|kindergarten|pre-?k)$'
        OR v_user_grade ~ '^(?:grade\s*)?[1-4][a-z]?$'
      )
    )
    OR
    (
      lower(trim(v_quiz.grade)) ~ '^(?:grade\s*)?[5-8][a-z]?$'
      AND v_user_grade ~ '^(?:grade\s*)?[5-8][a-z]?$'
    )
    OR
    (
      lower(trim(v_quiz.grade)) ~ '^(?:grade\s*)?(?:9|10|11|12)[a-z]?$'
      AND v_user_grade ~ '^(?:grade\s*)?(?:9|10|11|12)[a-z]?$'
    );

  IF NOT v_tier_matches THEN
    RAISE EXCEPTION 'Quiz is outside your learning tier';
  END IF;

  IF p_time_taken IS NULL OR p_time_taken < 0 OR p_time_taken > GREATEST(COALESCE(v_quiz.time_limit,3600),3600) THEN
    RAISE EXCEPTION 'Invalid quiz time';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.questions
  WHERE quiz_id = p_quiz_id;

  IF v_total = 0 OR v_total > 100 THEN
    RAISE EXCEPTION 'Invalid quiz question count';
  END IF;

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
      user_id, question_id, quiz_id, selected_answer, is_correct,
      time_taken_seconds, attempt_number
    ) VALUES (
      v_user_id, v_question.id, p_quiz_id, COALESCE(v_selected,'no_answer'),
      v_correct_bool,
      GREATEST(1, p_time_taken / GREATEST(v_total,1)),
      1
    );
  END LOOP;

  INSERT INTO public.quiz_results (
    quiz_id, student_id, score, total_questions, correct_answers,
    time_taken, xp_earned, answers, submission_id
  ) VALUES (
    p_quiz_id, v_user_id, v_score, v_total, v_correct,
    p_time_taken, v_xp, p_answers, p_submission_id
  );

  RETURN jsonb_build_object(
    'quiz_id', p_quiz_id,
    'score', v_score,
    'total_questions', v_total,
    'correct_answers', v_correct,
    'xp_earned', v_xp,
    'difficulty', v_quiz.difficulty
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_result_secure(uuid,jsonb,integer,uuid) TO authenticated;
