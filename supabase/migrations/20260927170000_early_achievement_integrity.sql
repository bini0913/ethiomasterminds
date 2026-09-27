-- Harden Early achievements: eligibility and persistence must be server-controlled.
-- Prevent clients from self-granting/un-granting achievements and claiming rewards.

DROP POLICY IF EXISTS "Users insert own Early achievements" ON public.early_user_achievements;
DROP POLICY IF EXISTS "Users update own Early achievements" ON public.early_user_achievements;

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
  v_xp_reward integer := 0;
  v_coin_reward integer := 0;
  v_xp integer;
  v_level integer;
  v_rank text;
  v_coins integer;
  v_achievement_key text;
  v_achievement_id uuid;
  v_requirement_type text;
  v_requirement_value integer;
  v_current_progress integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_attempt_id IS NULL THEN RAISE EXCEPTION 'Attempt id is required'; END IF;
  IF p_activity_id IS NULL OR length(trim(p_activity_id)) = 0 THEN RAISE EXCEPTION 'Activity id is required'; END IF;
  IF p_skill IS NULL OR length(trim(p_skill)) = 0 THEN RAISE EXCEPTION 'Skill is required'; END IF;

  SELECT grade INTO v_grade FROM public.profiles WHERE id = v_user_id;
  IF v_grade IS NULL OR NOT (
    lower(trim(v_grade)) ~ '^(k|kindergarten|pre-?k)$'
    OR lower(trim(v_grade)) ~ '^(?:grade\s*)?[1-4]\+?$'
  ) THEN
    RAISE EXCEPTION 'Early activities are only available to KG through Grade 4';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.early_activity_attempts
    WHERE id = p_attempt_id AND user_id = v_user_id
  ) THEN
    SELECT xp, level, rank INTO v_xp, v_level, v_rank FROM public.profiles WHERE id = v_user_id;
    SELECT coins INTO v_coins FROM public.user_currency WHERE user_id = v_user_id;
    RETURN jsonb_build_object('processed', false, 'duplicate', true, 'xp', COALESCE(v_xp,0),
      'level', COALESCE(v_level,1), 'rank', v_rank, 'coins', COALESCE(v_coins,0));
  END IF;

  IF trim(p_activity_id) LIKE 'achievement-%' THEN
    v_achievement_key := substring(trim(p_activity_id) from 13);

    SELECT id, requirement_type, requirement_value, reward_xp, reward_coins
      INTO v_achievement_id, v_requirement_type, v_requirement_value, v_xp_reward, v_coin_reward
    FROM public.early_achievements
    WHERE key = v_achievement_key AND active = true;

    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown Early achievement'; END IF;

    IF EXISTS (
      SELECT 1 FROM public.early_user_achievements
      WHERE user_id = v_user_id AND achievement_id = v_achievement_id AND completed = true
    ) THEN
      SELECT xp, level, rank INTO v_xp, v_level, v_rank FROM public.profiles WHERE id = v_user_id;
      SELECT coins INTO v_coins FROM public.user_currency WHERE user_id = v_user_id;
      RETURN jsonb_build_object('processed', false, 'duplicate', true, 'xp', COALESCE(v_xp,0),
        'level', COALESCE(v_level,1), 'rank', v_rank, 'coins', COALESCE(v_coins,0));
    END IF;

    SELECT COALESCE(
      CASE v_requirement_type
        WHEN 'completions' THEN (
          SELECT COALESCE(SUM(completions),0)::integer
          FROM public.early_activity_progress WHERE user_id = v_user_id
        )
        WHEN 'math_attempts' THEN (
          SELECT COALESCE(SUM(attempts),0)::integer
          FROM public.early_activity_progress
          WHERE user_id = v_user_id AND skill IN ('number sense','shapes','patterns')
        )
        WHEN 'reading_attempts' THEN (
          SELECT COALESCE(SUM(attempts),0)::integer
          FROM public.early_activity_progress
          WHERE user_id = v_user_id AND skill IN ('vocabulary','phonics')
        )
        WHEN 'science_attempts' THEN (
          SELECT COALESCE(SUM(attempts),0)::integer
          FROM public.early_activity_progress
          WHERE user_id = v_user_id AND skill = 'animals'
        )
        WHEN 'coding_attempts' THEN (
          SELECT COALESCE(SUM(attempts),0)::integer
          FROM public.early_activity_progress
          WHERE user_id = v_user_id AND skill = 'sequencing'
        )
        WHEN 'accuracy_80' THEN (
          SELECT CASE
            WHEN COALESCE(SUM(attempts),0) >= 10
             AND COALESCE(SUM(correct_answers),0)::numeric / NULLIF(SUM(attempts),0) >= 0.8
            THEN 10 ELSE COALESCE(SUM(attempts),0)::integer END
          FROM public.early_activity_progress WHERE user_id = v_user_id
        )
        WHEN 'xp_earned' THEN (
          SELECT COALESCE(SUM(xp_earned),0)::integer
          FROM public.early_activity_progress WHERE user_id = v_user_id
        )
        ELSE 0
      END, 0
    ) INTO v_current_progress;

    IF v_current_progress < v_requirement_value THEN
      RAISE EXCEPTION 'Early achievement requirement not met';
    END IF;
  ELSIF trim(p_activity_id) LIKE 'quiz-%' THEN
    v_xp_reward := 8;
    v_coin_reward := 3;
  ELSIF trim(p_activity_id) IN (
    'number-quest','word-match','shape-hunt','pattern-builder','memory-match',
    'odd-one-out','sort-safari','animal-detective','word-builder','coding-robot'
  ) THEN
    v_xp_reward := 5;
    v_coin_reward := 2;
  ELSIF trim(p_activity_id) = 'early-discover' THEN
    v_xp_reward := 5;
    v_coin_reward := 2;
  ELSE
    RAISE EXCEPTION 'Unknown Early activity';
  END IF;

  IF v_achievement_id IS NOT NULL THEN
    INSERT INTO public.early_user_achievements (
      user_id, achievement_id, progress, completed, unlocked_at
    ) VALUES (
      v_user_id, v_achievement_id, v_requirement_value, true, now()
    );
  END IF;

  INSERT INTO public.early_activity_attempts (
    id,user_id,activity_id,skill,correct,xp_earned,coins_earned
  ) VALUES (
    p_attempt_id,v_user_id,trim(p_activity_id),trim(p_skill),p_correct,
    CASE WHEN p_correct THEN v_xp_reward ELSE 0 END,
    CASE WHEN p_correct THEN v_coin_reward ELSE 0 END
  );

  INSERT INTO public.early_activity_progress (
    user_id,activity_id,skill,attempts,correct_answers,completions,xp_earned,coins_earned,last_played_at
  ) VALUES (
    v_user_id,trim(p_activity_id),trim(p_skill),1,
    CASE WHEN p_correct THEN 1 ELSE 0 END,
    CASE WHEN p_completed THEN 1 ELSE 0 END,
    CASE WHEN p_correct THEN v_xp_reward ELSE 0 END,
    CASE WHEN p_correct THEN v_coin_reward ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id,activity_id) DO UPDATE SET
    attempts=public.early_activity_progress.attempts+1,
    correct_answers=public.early_activity_progress.correct_answers+CASE WHEN p_correct THEN 1 ELSE 0 END,
    completions=public.early_activity_progress.completions+CASE WHEN p_completed THEN 1 ELSE 0 END,
    xp_earned=public.early_activity_progress.xp_earned+CASE WHEN p_correct THEN v_xp_reward ELSE 0 END,
    coins_earned=public.early_activity_progress.coins_earned+CASE WHEN p_correct THEN v_coin_reward ELSE 0 END,
    skill=EXCLUDED.skill,last_played_at=now();

  IF p_correct AND v_xp_reward > 0 THEN
    UPDATE public.profiles
    SET xp=COALESCE(xp,0)+v_xp_reward,
        level=FLOOR((COALESCE(xp,0)+v_xp_reward)/100)+1,
        rank=calculate_rank(COALESCE(xp,0)+v_xp_reward)
    WHERE id=v_user_id
    RETURNING xp,level,rank INTO v_xp,v_level,v_rank;
  ELSE
    SELECT xp,level,rank INTO v_xp,v_level,v_rank FROM public.profiles WHERE id=v_user_id;
  END IF;

  INSERT INTO public.user_currency(user_id,coins)
  VALUES(v_user_id,CASE WHEN p_correct THEN v_coin_reward ELSE 0 END)
  ON CONFLICT(user_id) DO UPDATE SET
    coins=public.user_currency.coins+CASE WHEN p_correct THEN v_coin_reward ELSE 0 END,
    updated_at=now()
  RETURNING coins INTO v_coins;

  RETURN jsonb_build_object('processed',true,'duplicate',false,'xp',COALESCE(v_xp,0),
    'level',COALESCE(v_level,1),'rank',v_rank,'coins',COALESCE(v_coins,0),
    'reward_xp',CASE WHEN p_correct THEN v_xp_reward ELSE 0 END,
    'reward_coins',CASE WHEN p_correct THEN v_coin_reward ELSE 0 END);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.complete_early_activity(uuid,text,text,boolean,boolean) TO authenticated;
