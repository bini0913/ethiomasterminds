-- Prevent client-forged Early achievements.
-- The achievement RPC now verifies the requirement from server-owned progress
-- before unlocking or paying the achievement reward.

CREATE OR REPLACE FUNCTION public.complete_early_activity(
  p_attempt_id uuid,
  p_activity_id text,
  p_skill text,
  p_correct boolean,
  p_completed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_grade text;
  v_activity text := trim(coalesce(p_activity_id, ''));
  v_skill text := trim(coalesce(p_skill, ''));
  v_xp_reward integer := 0;
  v_coin_reward integer := 0;
  v_xp integer;
  v_level integer;
  v_rank text;
  v_season_xp integer;
  v_coins integer;
  v_achievement_key text;
  v_achievement_id uuid;
  v_requirement_type text;
  v_requirement_value integer;
  v_requirement_progress integer := 0;
  v_attempts integer := 0;
  v_correct_attempts integer := 0;
  v_daily_rewards integer;
  v_is_achievement boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_attempt_id IS NULL THEN
    RAISE EXCEPTION 'Attempt id is required';
  END IF;

  IF v_activity = '' OR length(v_activity) > 80 THEN
    RAISE EXCEPTION 'Invalid activity id';
  END IF;

  IF v_skill = '' OR length(v_skill) > 80 THEN
    RAISE EXCEPTION 'Invalid skill';
  END IF;

  -- Serialize reward/achievement decisions for this profile.
  PERFORM 1
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT grade
    INTO v_grade
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_grade IS NULL OR NOT (
    lower(trim(v_grade)) ~ '^(k|kindergarten|pre-?k)$'
    OR lower(trim(v_grade)) ~ '^(?:grade\s*)?[1-4]\+?$'
  ) THEN
    RAISE EXCEPTION 'Early activities are only available to KG through Grade 4';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.early_activity_attempts
    WHERE id = p_attempt_id
      AND user_id = v_user_id
  ) THEN
    SELECT xp, level, rank, season_xp
      INTO v_xp, v_level, v_rank, v_season_xp
    FROM public.profiles
    WHERE id = v_user_id;

    SELECT coins
      INTO v_coins
    FROM public.user_currency
    WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
      'processed', false,
      'duplicate', true,
      'xp', coalesce(v_xp, 0),
      'level', coalesce(v_level, 1),
      'rank', v_rank,
      'season_xp', coalesce(v_season_xp, 0),
      'coins', coalesce(v_coins, 0)
    );
  END IF;

  IF v_activity LIKE 'achievement-%' THEN
    v_is_achievement := true;
    v_achievement_key := substring(v_activity from 13);

    SELECT id, requirement_type, requirement_value, reward_xp, reward_coins
      INTO v_achievement_id, v_requirement_type, v_requirement_value,
           v_xp_reward, v_coin_reward
    FROM public.early_achievements
    WHERE key = v_achievement_key
      AND active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown Early achievement';
    END IF;

    -- Recalculate the requirement exclusively from server-owned activity data.
    SELECT
      coalesce(sum(attempts), 0),
      coalesce(sum(correct_answers), 0)
      INTO v_attempts, v_correct_attempts
    FROM public.early_activity_progress
    WHERE user_id = v_user_id;

    SELECT coalesce(sum(completions), 0), coalesce(sum(xp_earned), 0)
      INTO v_requirement_progress, v_xp
    FROM public.early_activity_progress
    WHERE user_id = v_user_id;

    IF v_requirement_type = 'math_attempts' THEN
      SELECT coalesce(sum(attempts), 0)
        INTO v_requirement_progress
      FROM public.early_activity_progress
      WHERE user_id = v_user_id
        AND skill IN ('number sense', 'shapes', 'patterns');
    ELSIF v_requirement_type = 'reading_attempts' THEN
      SELECT coalesce(sum(attempts), 0)
        INTO v_requirement_progress
      FROM public.early_activity_progress
      WHERE user_id = v_user_id
        AND skill IN ('vocabulary', 'phonics');
    ELSIF v_requirement_type = 'science_attempts' THEN
      SELECT coalesce(sum(attempts), 0)
        INTO v_requirement_progress
      FROM public.early_activity_progress
      WHERE user_id = v_user_id
        AND skill = 'animals';
    ELSIF v_requirement_type = 'coding_attempts' THEN
      SELECT coalesce(sum(attempts), 0)
        INTO v_requirement_progress
      FROM public.early_activity_progress
      WHERE user_id = v_user_id
        AND skill = 'sequencing';
    ELSIF v_requirement_type = 'accuracy_80' THEN
      IF v_attempts >= 10 AND (v_correct_attempts::numeric / greatest(v_attempts, 1)) >= 0.80 THEN
        v_requirement_progress := 10;
      ELSE
        v_requirement_progress := least(v_attempts, 10);
      END IF;
    ELSIF v_requirement_type = 'xp_earned' THEN
      SELECT coalesce(sum(xp_earned), 0)
        INTO v_requirement_progress
      FROM public.early_activity_progress
      WHERE user_id = v_user_id;
    END IF;

    IF v_requirement_progress < v_requirement_value THEN
      RAISE EXCEPTION 'Achievement requirement has not been completed';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.early_user_achievements
      WHERE user_id = v_user_id
        AND achievement_id = v_achievement_id
        AND completed = true
    ) THEN
      SELECT xp, level, rank, season_xp
        INTO v_xp, v_level, v_rank, v_season_xp
      FROM public.profiles
      WHERE id = v_user_id;

      SELECT coins INTO v_coins
      FROM public.user_currency
      WHERE user_id = v_user_id;

      RETURN jsonb_build_object(
        'processed', false,
        'duplicate', true,
        'xp', coalesce(v_xp, 0),
        'level', coalesce(v_level, 1),
        'rank', v_rank,
        'season_xp', coalesce(v_season_xp, 0),
        'coins', coalesce(v_coins, 0)
      );
    END IF;
  ELSIF v_activity IN ('early-quiz-k', 'early-quiz-g1', 'early-quiz-g3') THEN
    v_xp_reward := 8;
    v_coin_reward := 3;
  ELSIF v_activity IN (
    'number-quest','word-match','shape-hunt','pattern-builder','memory-match',
    'odd-one-out','sort-safari','animal-detective','word-builder','coding-robot'
  ) THEN
    v_xp_reward := 5;
    v_coin_reward := 2;
  ELSIF v_activity = 'early-discover' THEN
    v_xp_reward := 5;
    v_coin_reward := 2;
  ELSE
    RAISE EXCEPTION 'Unknown Early activity';
  END IF;

  SELECT count(*)
    INTO v_daily_rewards
  FROM public.early_activity_attempts
  WHERE user_id = v_user_id
    AND created_at >= date_trunc('day', now())
    AND (xp_earned > 0 OR coins_earned > 0);

  -- Child activities use client-reported correctness, so keep a hard daily
  -- reward ceiling. Achievements are still verified against server progress.
  IF v_daily_rewards >= 100 THEN
    v_xp_reward := 0;
    v_coin_reward := 0;
  END IF;

  IF v_is_achievement THEN
    INSERT INTO public.early_user_achievements (
      user_id, achievement_id, progress, completed, unlocked_at
    )
    VALUES (
      v_user_id, v_achievement_id, v_requirement_progress, true, now()
    )
    ON CONFLICT (user_id, achievement_id) DO UPDATE SET
      progress = EXCLUDED.progress,
      completed = true,
      unlocked_at = coalesce(public.early_user_achievements.unlocked_at, now());
  ELSE
    INSERT INTO public.early_activity_attempts (
      id, user_id, activity_id, skill, correct, xp_earned, coins_earned
    )
    VALUES (
      p_attempt_id,
      v_user_id,
      v_activity,
      v_skill,
      p_correct,
      CASE WHEN p_correct THEN v_xp_reward ELSE 0 END,
      CASE WHEN p_correct THEN v_coin_reward ELSE 0 END
    );

    INSERT INTO public.early_activity_progress (
      user_id, activity_id, skill, attempts, correct_answers,
      completions, xp_earned, coins_earned, last_played_at
    )
    VALUES (
      v_user_id,
      v_activity,
      v_skill,
      1,
      CASE WHEN p_correct THEN 1 ELSE 0 END,
      CASE WHEN p_completed THEN 1 ELSE 0 END,
      CASE WHEN p_correct THEN v_xp_reward ELSE 0 END,
      CASE WHEN p_correct THEN v_coin_reward ELSE 0 END,
      now()
    )
    ON CONFLICT (user_id, activity_id) DO UPDATE SET
      attempts = public.early_activity_progress.attempts + 1,
      correct_answers = public.early_activity_progress.correct_answers
        + CASE WHEN p_correct THEN 1 ELSE 0 END,
      completions = public.early_activity_progress.completions
        + CASE WHEN p_completed THEN 1 ELSE 0 END,
      xp_earned = public.early_activity_progress.xp_earned
        + CASE WHEN p_correct THEN v_xp_reward ELSE 0 END,
      coins_earned = public.early_activity_progress.coins_earned
        + CASE WHEN p_correct THEN v_coin_reward ELSE 0 END,
      skill = EXCLUDED.skill,
      last_played_at = now();
  END IF;

  IF p_correct AND v_xp_reward > 0 THEN
    UPDATE public.profiles
       SET xp = coalesce(xp, 0) + v_xp_reward,
           level = floor((coalesce(xp, 0) + v_xp_reward) / 100) + 1,
           rank = calculate_rank(coalesce(xp, 0) + v_xp_reward),
           season_xp = greatest(0, coalesce(season_xp, 0) + v_xp_reward)
     WHERE id = v_user_id
     RETURNING xp, level, rank, season_xp
       INTO v_xp, v_level, v_rank, v_season_xp;
  ELSE
    SELECT xp, level, rank, season_xp
      INTO v_xp, v_level, v_rank, v_season_xp
    FROM public.profiles
    WHERE id = v_user_id;
  END IF;

  INSERT INTO public.user_currency(user_id, coins)
  VALUES (
    v_user_id,
    CASE WHEN p_correct THEN v_coin_reward ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    coins = public.user_currency.coins + EXCLUDED.coins,
    updated_at = now()
  RETURNING coins INTO v_coins;

  RETURN jsonb_build_object(
    'processed', true,
    'duplicate', false,
    'xp', coalesce(v_xp, 0),
    'level', coalesce(v_level, 1),
    'rank', v_rank,
    'season_xp', coalesce(v_season_xp, 0),
    'coins', coalesce(v_coins, 0),
    'reward_xp', CASE WHEN p_correct THEN v_xp_reward ELSE 0 END,
    'reward_coins', CASE WHEN p_correct THEN v_coin_reward ELSE 0 END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_early_activity(uuid, text, text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_early_activity(uuid, text, text, boolean, boolean) TO authenticated;
