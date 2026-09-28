-- Final production hardening: make study/achievement XP count toward seasons
-- and make quiz reward eligibility server-authoritative.

ALTER TABLE public.quiz_results
  ADD COLUMN IF NOT EXISTS reward_eligible boolean NOT NULL DEFAULT true;

-- Internal XP primitive: clients cannot execute it directly, but trusted
-- SECURITY DEFINER activity functions use it for progression.
CREATE OR REPLACE FUNCTION public.add_xp(p_user_id uuid, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_xp integer;
  v_new_xp integer;
  v_current_level integer;
  v_new_level integer;
  v_new_rank text;
  v_new_season_xp integer;
  v_coins_to_add integer := 0;
  v_leveled_up boolean := false;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'You can only add XP to your own account';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 500 THEN
    RAISE EXCEPTION 'Invalid XP amount';
  END IF;

  SELECT xp, level, season_xp
    INTO v_current_xp, v_current_level, v_new_season_xp
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_new_xp := COALESCE(v_current_xp, 0) + p_amount;
  v_new_season_xp := GREATEST(0, COALESCE(v_new_season_xp, 0) + p_amount);
  v_new_level := FLOOR(v_new_xp / 100) + 1;
  v_new_rank := public.calculate_rank(v_new_xp);
  v_leveled_up := v_new_level > COALESCE(v_current_level, 1);

  UPDATE public.profiles
  SET xp = v_new_xp,
      total_xp = GREATEST(COALESCE(total_xp, 0) + p_amount, v_new_xp),
      season_xp = v_new_season_xp,
      level = v_new_level,
      rank = v_new_rank,
      updated_at = now()
  WHERE id = p_user_id;

  v_coins_to_add := FLOOR(p_amount / 100);
  IF v_coins_to_add > 0 THEN
    INSERT INTO public.user_currency(user_id, coins)
    VALUES (p_user_id, v_coins_to_add)
    ON CONFLICT (user_id) DO UPDATE
      SET coins = public.user_currency.coins + EXCLUDED.coins,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'previous_xp', v_current_xp,
    'new_xp', v_new_xp,
    'xp_gained', p_amount,
    'previous_level', v_current_level,
    'new_level', v_new_level,
    'leveled_up', v_leveled_up,
    'rank', v_new_rank,
    'season_xp', v_new_season_xp,
    'coins_added', v_coins_to_add
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_xp(uuid, integer) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.add_xp(uuid, integer) TO service_role;

-- Rebuild the secure quiz submission so reward eligibility is calculated from
-- server-owned question history, not the client's allowXP flag.
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
  v_role text;
  v_profile_grade text;
  v_quiz public.quizzes%ROWTYPE;
  v_total integer;
  v_correct integer := 0;
  v_score integer := 0;
  v_xp integer := 0;
  v_question record;
  v_selected text;
  v_correct_bool boolean;
  v_requested_grade_number text;
  v_profile_grade_number text;
  v_max_time integer;
  v_reward_eligible boolean := true;
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
  IF jsonb_object_length(p_answers) > 100 THEN
    RAISE EXCEPTION 'Answers payload is too large';
  END IF;

  SELECT grade INTO v_profile_grade
  FROM public.profiles
  WHERE id = v_user_id;

  SELECT public.get_user_role(v_user_id) INTO v_role;

  SELECT * INTO v_quiz
  FROM public.quizzes
  WHERE id = p_quiz_id
    AND is_approved = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No quiz available';
  END IF;

  IF v_role = 'student' THEN
    IF v_profile_grade IS NULL OR v_quiz.grade IS NULL THEN
      RAISE EXCEPTION 'Student grade is required';
    END IF;

    v_requested_grade_number := substring(lower(trim(v_quiz.grade)) from '[0-9]+');
    v_profile_grade_number := substring(lower(trim(v_profile_grade)) from '[0-9]+');

    IF v_requested_grade_number IS DISTINCT FROM v_profile_grade_number
       AND NOT (
         v_requested_grade_number IS NULL
         AND v_profile_grade_number IS NULL
         AND lower(trim(v_quiz.grade)) = lower(trim(v_profile_grade))
       ) THEN
      RAISE EXCEPTION 'Quiz grade does not match the authenticated student';
    END IF;
  END IF;

  v_max_time := GREATEST(60, LEAST(7200, COALESCE(v_quiz.time_limit, 3600)));
  IF p_time_taken < 0 OR p_time_taken > v_max_time THEN
    RAISE EXCEPTION 'Invalid quiz time';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.quiz_results
    WHERE submission_id = p_submission_id
  ) THEN
    RAISE EXCEPTION 'Duplicate submission';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.questions
  WHERE quiz_id = p_quiz_id;

  IF v_total = 0 OR v_total > 100 THEN
    RAISE EXCEPTION 'Invalid quiz question set';
  END IF;

  FOR v_question IN
    SELECT id, correct_answer,
           coalesce(difficulty, v_quiz.difficulty) AS difficulty,
           points
    FROM public.questions
    WHERE quiz_id = p_quiz_id
    ORDER BY order_index, created_at
  LOOP
    -- If any question in this real quiz was already attempted by this
    -- student, this submission is a practice/retake and earns no quiz reward.
    IF EXISTS (
      SELECT 1
      FROM public.question_attempts
      WHERE user_id = v_user_id
        AND question_id = v_question.id
    ) THEN
      v_reward_eligible := false;
    END IF;

    v_selected := p_answers ->> (v_question.id::text);
    v_correct_bool := v_selected IS NOT NULL
      AND v_selected = v_question.correct_answer;

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
      COALESCE(v_selected, 'no_answer'),
      v_correct_bool,
      GREATEST(0, p_time_taken / GREATEST(v_total, 1)),
      1
    );
  END LOOP;

  INSERT INTO public.quiz_results (
    quiz_id, student_id, score, total_questions, correct_answers,
    time_taken, xp_earned, answers, submission_id, reward_eligible
  ) VALUES (
    p_quiz_id, v_user_id, v_score, v_total, v_correct,
    p_time_taken, v_xp, p_answers, p_submission_id, v_reward_eligible
  );

  RETURN jsonb_build_object(
    'quiz_id', p_quiz_id,
    'score', v_score,
    'total_questions', v_total,
    'correct_answers', v_correct,
    'time_taken', p_time_taken,
    'xp_earned', v_xp,
    'reward_eligible', v_reward_eligible,
    'difficulty', v_quiz.difficulty
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) TO authenticated;

-- Reward claims are also server-owned: a client cannot bypass the UI's
-- retake rules by calling claim_quiz_reward directly.
CREATE OR REPLACE FUNCTION public.claim_quiz_reward(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.quiz_results%ROWTYPE;
  v_xp integer;
  v_coins integer;
  v_level integer;
  v_new_level integer;
  v_new_xp integer;
  v_new_rank text;
  v_new_season_xp integer;
  v_claimed boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.get_user_role(uid) <> 'student' THEN
    RAISE EXCEPTION 'Only student accounts can claim quiz rewards';
  END IF;

  SELECT *
  INTO r
  FROM public.quiz_results
  WHERE submission_id = p_submission_id
    AND student_id = uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz submission not found';
  END IF;

  IF NOT COALESCE(r.reward_eligible, true) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_claimed', false,
      'ineligible', true,
      'xp_awarded', 0,
      'coins_awarded', 0,
      'new_level', (SELECT level FROM public.profiles WHERE id = uid)
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.quiz_reward_claims
    WHERE submission_id = p_submission_id
  ) INTO v_claimed;

  IF v_claimed THEN
    SELECT xp_awarded, coins_awarded
      INTO v_xp, v_coins
    FROM public.quiz_reward_claims
    WHERE submission_id = p_submission_id;

    SELECT level INTO v_new_level
    FROM public.profiles
    WHERE id = uid;

    RETURN jsonb_build_object(
      'success', true,
      'already_claimed', true,
      'xp_awarded', v_xp,
      'coins_awarded', v_coins,
      'new_level', v_new_level
    );
  END IF;

  v_xp := greatest(0, least(coalesce(r.xp_earned, 0), 500));
  v_coins := greatest(
    0,
    least(
      20,
      5 + floor(
        (coalesce(r.correct_answers, 0)::numeric
          / greatest(r.total_questions, 1)) * 15
      )::integer
    )
  );

  SELECT xp, level, season_xp
    INTO v_new_xp, v_level, v_new_season_xp
  FROM public.profiles
  WHERE id = uid
  FOR UPDATE;

  v_new_xp := coalesce(v_new_xp, 0) + v_xp;
  v_new_level := floor(v_new_xp / 100)::integer + 1;
  v_new_rank := public.calculate_rank(v_new_xp);
  v_new_season_xp := greatest(0, coalesce(v_new_season_xp, 0) + v_xp);

  UPDATE public.profiles
  SET xp = v_new_xp,
      total_xp = greatest(coalesce(total_xp, 0) + v_xp, v_new_xp),
      season_xp = v_new_season_xp,
      level = v_new_level,
      rank = v_new_rank,
      updated_at = now()
  WHERE id = uid;

  INSERT INTO public.user_currency(user_id, coins)
  VALUES (uid, v_coins)
  ON CONFLICT (user_id) DO UPDATE
    SET coins = public.user_currency.coins + excluded.coins,
        updated_at = now();

  INSERT INTO public.quiz_reward_claims(
    submission_id, user_id, xp_awarded, coins_awarded
  )
  VALUES (p_submission_id, uid, v_xp, v_coins);

  RETURN jsonb_build_object(
    'success', true,
    'already_claimed', false,
    'ineligible', false,
    'xp_awarded', v_xp,
    'coins_awarded', v_coins,
    'new_level', v_new_level,
    'rank', v_new_rank,
    'season_xp', v_new_season_xp
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_quiz_reward(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_quiz_reward(uuid) TO authenticated;
