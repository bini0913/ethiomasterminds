-- Master Minds final production integrity pass.
-- Protect identity/tier/progression fields and make quiz rewards fully server-owned.

CREATE OR REPLACE FUNCTION public.guard_student_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text := auth.role();
  caller_user_role text;
BEGIN
  IF caller_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  caller_user_role := public.get_user_role(auth.uid());

  IF caller_user_role IN ('admin', 'manager', 'extreme_admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only update your own profile';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.xp IS DISTINCT FROM OLD.xp
     OR NEW.total_xp IS DISTINCT FROM OLD.total_xp
     OR NEW.season_xp IS DISTINCT FROM OLD.season_xp
     OR NEW.level IS DISTINCT FROM OLD.level
     OR NEW.rank IS DISTINCT FROM OLD.rank
     OR NEW.badges IS DISTINCT FROM OLD.badges THEN
    RAISE EXCEPTION 'Progression fields are server-managed';
  END IF;

  IF NEW.login_mode IS DISTINCT FROM OLD.login_mode THEN
    RAISE EXCEPTION 'Login mode is server-managed';
  END IF;

  IF NEW.grade IS DISTINCT FROM OLD.grade AND OLD.grade IS NOT NULL THEN
    RAISE EXCEPTION 'Grade changes require staff approval';
  END IF;

  IF NEW.education_level IS DISTINCT FROM OLD.education_level
     AND OLD.education_level IS NOT NULL THEN
    RAISE EXCEPTION 'Education level changes require staff approval';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_student_profile_updates ON public.profiles;
CREATE TRIGGER guard_student_profile_updates
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_student_profile_updates();

REVOKE ALL ON FUNCTION public.guard_student_profile_updates() FROM PUBLIC;

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

  SELECT * INTO r
  FROM public.quiz_results
  WHERE submission_id = p_submission_id
    AND student_id = uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz submission not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.quiz_reward_claims
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
      5 + floor((coalesce(r.correct_answers, 0)::numeric / greatest(r.total_questions, 1)) * 15)
    )::integer
  );

  SELECT xp, level
    INTO v_new_xp, v_level
  FROM public.profiles
  WHERE id = uid
  FOR UPDATE;

  v_new_xp := coalesce(v_new_xp, 0) + v_xp;
  v_new_level := floor(v_new_xp / 100)::integer + 1;
  v_new_rank := public.calculate_rank(v_new_xp);
  v_new_season_xp := greatest(
    0,
    coalesce((SELECT season_xp FROM public.profiles WHERE id = uid), 0) + v_xp
  );

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

  INSERT INTO public.quiz_reward_claims(submission_id, user_id, xp_awarded, coins_awarded)
  VALUES (p_submission_id, uid, v_xp, v_coins);

  RETURN jsonb_build_object(
    'success', true,
    'already_claimed', false,
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

CREATE INDEX IF NOT EXISTS idx_quizzes_grade_subject_difficulty_approved
  ON public.quizzes (grade, subject, difficulty, is_approved);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_order
  ON public.questions (quiz_id, order_index);
