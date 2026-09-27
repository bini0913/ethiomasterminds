-- Master Minds production integrity hardening batch.
-- Server-authoritative XP, study sessions, quiz access, daily mission claims,
-- access-code redemption, and admin-only season analytics.

CREATE OR REPLACE FUNCTION public.apply_xp_reward(
  p_user_id uuid,
  p_amount integer,
  p_add_legacy_coins boolean DEFAULT false
)
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
  v_season_xp integer;
  v_coins_added integer := 0;
BEGIN
  IF p_user_id IS NULL OR p_amount <= 0 OR p_amount > 500 THEN
    RAISE EXCEPTION 'Invalid XP reward';
  END IF;

  SELECT xp, level, season_xp
    INTO v_current_xp, v_current_level, v_season_xp
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_new_xp := coalesce(v_current_xp, 0) + p_amount;
  v_new_level := floor(v_new_xp / 100) + 1;
  v_new_rank := calculate_rank(v_new_xp);

  UPDATE public.profiles
     SET xp = v_new_xp,
         level = v_new_level,
         rank = v_new_rank,
         season_xp = greatest(0, coalesce(v_season_xp, 0) + p_amount)
   WHERE id = p_user_id;

  IF p_add_legacy_coins THEN
    v_coins_added := floor(p_amount / 100);
    IF v_coins_added > 0 THEN
      INSERT INTO public.user_currency(user_id, coins)
      VALUES (p_user_id, v_coins_added)
      ON CONFLICT (user_id) DO UPDATE
        SET coins = public.user_currency.coins + excluded.coins,
            updated_at = now();
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'previous_xp', v_current_xp,
    'new_xp', v_new_xp,
    'xp_gained', p_amount,
    'previous_level', v_current_level,
    'new_level', v_new_level,
    'leveled_up', v_new_level > coalesce(v_current_level, 1),
    'rank', v_new_rank,
    'season_xp', greatest(0, coalesce(v_season_xp, 0) + p_amount),
    'coins_added', v_coins_added
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_xp_reward(uuid, integer, boolean) FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION public.add_xp(p_user_id uuid, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Kept only as a compatibility wrapper for trusted SECURITY DEFINER callers.
  -- Direct client execution is intentionally revoked below.
  IF p_user_id IS NULL OR p_amount <= 0 OR p_amount > 500 THEN
    RAISE EXCEPTION 'Invalid XP amount';
  END IF;
  RETURN public.apply_xp_reward(p_user_id, p_amount, true);
END;
$$;

REVOKE ALL ON FUNCTION public.add_xp(uuid, integer) FROM PUBLIC, authenticated;

-- Quiz adaptive selection must stay inside the authenticated student's own grade.
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_grade text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT grade INTO v_user_grade
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_user_grade IS NULL OR lower(trim(v_user_grade)) <> lower(trim(p_grade)) THEN
    RAISE EXCEPTION 'Quiz grade does not match your profile grade';
  END IF;

  RETURN QUERY
  WITH target AS (
    SELECT CASE
      WHEN p_level BETWEEN 1 AND 5 THEN 'easy'
      WHEN p_level BETWEEN 6 AND 10 THEN 'medium'
      WHEN p_level BETWEEN 11 AND 20 THEN 'hard'
      ELSE 'extreme'
    END AS wanted_difficulty
  )
  SELECT q.id, q.title, q.grade, q.subject, q.difficulty, q.level_min, q.level_max
  FROM public.quizzes q, target t
  WHERE q.is_approved = true
    AND lower(q.grade) = lower(trim(p_grade))
    AND lower(q.subject) = lower(trim(p_subject))
    AND lower(q.difficulty) = t.wanted_difficulty
  ORDER BY q.created_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_adaptive_quiz(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_adaptive_quiz(text, text, integer) TO authenticated;

-- Secure quiz submission: bound time and enforce the student's tier/grade.
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
  v_quiz public.quizzes%ROWTYPE;
  v_profile_grade text;
  v_user_grade_num integer;
  v_quiz_grade_num integer;
  v_total integer;
  v_correct integer := 0;
  v_score integer := 0;
  v_xp integer := 0;
  v_question record;
  v_selected text;
  v_correct_bool boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'Answers payload must be a JSON object';
  END IF;

  IF p_time_taken IS NULL OR p_time_taken < 0 OR p_time_taken > 7200 THEN
    RAISE EXCEPTION 'Invalid quiz time';
  END IF;

  IF p_submission_id IS NULL THEN
    RAISE EXCEPTION 'Submission id is required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.quiz_results WHERE submission_id = p_submission_id) THEN
    RAISE EXCEPTION 'Duplicate submission';
  END IF;

  SELECT grade INTO v_profile_grade
  FROM public.profiles
  WHERE id = v_user_id;

  SELECT * INTO v_quiz
  FROM public.quizzes
  WHERE id = p_quiz_id
    AND is_approved = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No quiz available';
  END IF;

  v_user_grade_num := NULLIF(substring(coalesce(v_profile_grade, '') from '([0-9]+)'), '')::integer;
  v_quiz_grade_num := NULLIF(substring(coalesce(v_quiz.grade, '') from '([0-9]+)'), '')::integer;

  IF v_user_grade_num IS NULL OR v_quiz_grade_num IS NULL THEN
    RAISE EXCEPTION 'Quiz grade is not compatible with this student account';
  END IF;

  IF (v_user_grade_num BETWEEN 1 AND 4) <> (v_quiz_grade_num BETWEEN 1 AND 4)
     OR (v_user_grade_num BETWEEN 5 AND 8) <> (v_quiz_grade_num BETWEEN 5 AND 8)
     OR (v_user_grade_num >= 9) <> (v_quiz_grade_num >= 9) THEN
    RAISE EXCEPTION 'Quiz is outside your learning tier';
  END IF;

  IF v_user_grade_num <> v_quiz_grade_num THEN
    RAISE EXCEPTION 'Quiz grade does not match your profile grade';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.questions
  WHERE quiz_id = p_quiz_id;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'No questions available';
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
      v_score := v_score + coalesce(v_question.points, 10);
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
      user_id, question_id, quiz_id, selected_answer, is_correct, time_taken_seconds, attempt_number
    ) VALUES (
      v_user_id, v_question.id, p_quiz_id, coalesce(v_selected, 'no_answer'),
      v_correct_bool, greatest(1, p_time_taken / greatest(v_total, 1)), 1
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

REVOKE ALL ON FUNCTION public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) TO authenticated;

-- Quiz reward claims update rank and season XP as well as lifetime XP.
CREATE OR REPLACE FUNCTION public.claim_quiz_reward(p_submission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.quiz_results%rowtype;
  v_xp integer;
  v_coins integer;
  v_result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO r
  FROM public.quiz_results
  WHERE submission_id = p_submission_id
    AND student_id = uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz submission not found';
  END IF;

  SELECT xp_awarded, coins_awarded INTO v_xp, v_coins
  FROM public.quiz_reward_claims
  WHERE submission_id = p_submission_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_claimed', true,
      'xp_awarded', v_xp,
      'coins_awarded', v_coins,
      'new_level', (SELECT level FROM public.profiles WHERE id = uid)
    );
  END IF;

  v_xp := greatest(0, coalesce(r.xp_earned, 0));
  v_coins := 5 + floor((coalesce(r.correct_answers, 0)::numeric / greatest(r.total_questions, 1)) * 15);

  v_result := public.apply_xp_reward(uid, v_xp, false);

  INSERT INTO public.user_currency(user_id, coins)
  VALUES (uid, v_coins)
  ON CONFLICT (user_id) DO UPDATE
    SET coins = public.user_currency.coins + v_coins,
        updated_at = now();

  INSERT INTO public.quiz_reward_claims(submission_id, user_id, xp_awarded, coins_awarded)
  VALUES (p_submission_id, uid, v_xp, v_coins);

  RETURN jsonb_build_object(
    'success', true,
    'already_claimed', false,
    'xp_awarded', v_xp,
    'coins_awarded', v_coins,
    'new_level', (v_result->>'new_level')::integer
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_quiz_reward(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_quiz_reward(uuid) TO authenticated;

-- Study completion is single-use and cannot be inflated with a fake duration.
CREATE OR REPLACE FUNCTION public.complete_study_session(
  p_session_id uuid,
  p_duration_override integer DEFAULT NULL,
  p_task_id uuid DEFAULT NULL,
  p_mark_task_complete boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.study_sessions%ROWTYPE;
  v_elapsed_minutes integer;
  v_minutes integer;
  v_xp integer;
  v_coins integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_session
  FROM public.study_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR v_session.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.status <> 'active' THEN
    RAISE EXCEPTION 'Study session is already completed';
  END IF;

  IF v_session.start_time > now() THEN
    RAISE EXCEPTION 'Invalid session start time';
  END IF;

  v_elapsed_minutes := greatest(1, ceil(extract(epoch from (now() - v_session.start_time))/60)::integer);

  IF p_duration_override IS NULL THEN
    v_minutes := v_elapsed_minutes;
  ELSE
    IF p_duration_override < 1 OR p_duration_override > 180 THEN
      RAISE EXCEPTION 'Invalid study duration';
    END IF;
    IF p_duration_override > v_elapsed_minutes + 1 THEN
      RAISE EXCEPTION 'Study duration exceeds real elapsed time';
    END IF;
    v_minutes := p_duration_override;
  END IF;

  v_minutes := least(v_minutes, 180);
  v_xp := v_minutes * 10;
  v_coins := greatest(1, v_minutes / 5);

  UPDATE public.study_sessions
     SET status = 'completed', end_time = now(), duration = v_minutes
   WHERE id = p_session_id;

  INSERT INTO public.study_live_status(user_id, is_studying, current_session_start, updated_at)
  VALUES (auth.uid(), false, null, now())
  ON CONFLICT (user_id) DO UPDATE
    SET is_studying = false, current_session_start = null, updated_at = now();

  IF v_session.competition_id IS NOT NULL THEN
    INSERT INTO public.study_participants(competition_id, user_id, total_study_time)
    VALUES (v_session.competition_id, auth.uid(), v_minutes)
    ON CONFLICT (competition_id, user_id)
    DO UPDATE SET total_study_time = public.study_participants.total_study_time + v_minutes;
  END IF;

  IF p_task_id IS NOT NULL AND p_mark_task_complete THEN
    UPDATE public.study_tasks
       SET completed = true
     WHERE id = p_task_id AND user_id = auth.uid();
  END IF;

  PERFORM public.apply_xp_reward(auth.uid(), v_xp, true);

  INSERT INTO public.user_currency(user_id, coins)
  VALUES (auth.uid(), v_coins)
  ON CONFLICT (user_id) DO UPDATE
    SET coins = public.user_currency.coins + v_coins,
        updated_at = now();

  RETURN jsonb_build_object('minutes', v_minutes, 'xp_earned', v_xp, 'coins_earned', v_coins);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_study_session(uuid, integer, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_study_session(uuid, integer, uuid, boolean) TO authenticated;

-- Atomic access-code redemption.
CREATE OR REPLACE FUNCTION public.redeem_access_code(
  p_code text,
  p_code_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_code public.access_codes%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_code IS NULL OR length(trim(p_code)) < 4 OR length(trim(p_code)) > 64 THEN
    RAISE EXCEPTION 'Invalid access code';
  END IF;
  IF p_code_type NOT IN ('teacher','admin','manager') THEN
    RAISE EXCEPTION 'Invalid access code type';
  END IF;

  SELECT * INTO v_code
  FROM public.access_codes
  WHERE code = upper(trim(p_code))
    AND code_type = p_code_type
    AND is_used = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or already used access code';
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RAISE EXCEPTION 'Access code has expired';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid AND role = p_code_type
  ) THEN
    RETURN jsonb_build_object('ok', true, 'role', p_code_type, 'already_assigned', true);
  END IF;

  DELETE FROM public.user_roles WHERE user_id = uid AND role = 'student';
  INSERT INTO public.user_roles(user_id, role) VALUES (uid, p_code_type);

  UPDATE public.access_codes
     SET is_used = true, used_by = uid
   WHERE id = v_code.id AND is_used = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access code was already redeemed';
  END IF;

  RETURN jsonb_build_object('ok', true, 'role', p_code_type, 'already_assigned', false);
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_access_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_access_code(text, text) TO authenticated;

-- Daily mission rewards are atomic and caller-bound.
CREATE OR REPLACE FUNCTION public.claim_daily_mission(p_mission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_mission public.user_missions%ROWTYPE;
  v_reward_xp integer;
  v_reward_coins integer;
  v_result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT um.*, dm.reward_xp, dm.reward_coins
    INTO v_mission, v_reward_xp, v_reward_coins
  FROM public.user_missions um
  JOIN public.daily_missions dm ON dm.id = um.mission_id
  WHERE um.id = p_mission_id AND um.user_id = uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;
  IF NOT v_mission.completed THEN
    RAISE EXCEPTION 'Mission not completed yet';
  END IF;
  IF v_mission.claimed THEN
    RAISE EXCEPTION 'Reward already claimed';
  END IF;

  UPDATE public.user_missions
     SET claimed = true
   WHERE id = p_mission_id AND user_id = uid AND claimed = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward already claimed';
  END IF;

  v_reward_xp := greatest(0, least(coalesce(v_reward_xp, 0), 500));
  v_reward_coins := greatest(0, least(coalesce(v_reward_coins, 100), 100));

  IF v_reward_xp > 0 THEN
    v_result := public.apply_xp_reward(uid, v_reward_xp, false);
  END IF;

  IF v_reward_coins > 0 THEN
    INSERT INTO public.user_currency(user_id, coins)
    VALUES (uid, v_reward_coins)
    ON CONFLICT (user_id) DO UPDATE
      SET coins = public.user_currency.coins + v_reward_coins,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'xp_awarded', v_reward_xp,
    'coins_awarded', v_reward_coins
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_mission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_daily_mission(uuid) TO authenticated;

-- Admin-only season analytics.
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
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_state FROM public.season_runtime_state WHERE id = 1;
  SELECT count(*), coalesce(sum(season_xp),0)
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
    'total_users', coalesce(v_total_users,0),
    'total_xp', coalesce(v_total_xp,0),
    'top_player', coalesce(v_top_name,'—')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_season_rewards_preview(
  p_conversion_rate numeric DEFAULT 0.1,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(user_id uuid, name text, season_xp integer, projected_rank integer, projected_coins integer, projected_title text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF p_conversion_rate < 0 OR p_conversion_rate > 1 THEN
    RAISE EXCEPTION 'Invalid conversion rate';
  END IF;
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'Invalid result limit';
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, coalesce(p.season_xp,0),
    row_number() over (order by p.season_xp desc nulls last)::int,
    greatest(0, floor(coalesce(p.season_xp,0) * p_conversion_rate))::int,
    CASE
      WHEN row_number() over (order by p.season_xp desc nulls last) = 1 THEN 'Champion'
      WHEN row_number() over (order by p.season_xp desc nulls last) <= 3 THEN 'Podium'
      WHEN row_number() over (order by p.season_xp desc nulls last) <= 10 THEN 'Top 10'
      ELSE NULL
    END
  FROM public.profiles p
  WHERE coalesce(p.season_xp,0) > 0
  ORDER BY p.season_xp DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_current_season_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_current_season_stats() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_get_season_rewards_preview(numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_season_rewards_preview(numeric, integer) TO authenticated;
