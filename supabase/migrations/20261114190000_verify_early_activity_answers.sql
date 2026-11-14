-- Early KG-4 rewards must be verified against a server-owned question key.
ALTER TABLE public.early_activity_attempts
  ADD COLUMN IF NOT EXISTS question_id text;

CREATE TABLE IF NOT EXISTS public.early_quiz_questions (
  id text PRIMARY KEY,
  subject text NOT NULL,
  skill text NOT NULL,
  grade_min integer NOT NULL CHECK (grade_min BETWEEN 0 AND 4),
  grade_max integer NOT NULL CHECK (grade_max BETWEEN grade_min AND 4),
  correct_answer text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.early_quiz_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.early_quiz_questions FROM PUBLIC, anon, authenticated;

INSERT INTO public.early_quiz_questions
  (id, subject, skill, grade_min, grade_max, correct_answer)
VALUES
('reading-0', 'Reading', 'reading', 0, 0, 'A'),
('reading-1', 'Reading', 'reading', 0, 0, 'S'),
('reading-2', 'Reading', 'reading', 0, 1, 'HAT'),
('reading-3', 'Reading', 'reading', 0, 1, 'D'),
('reading-4', 'Reading', 'reading', 1, 2, 'Tiger'),
('reading-5', 'Reading', 'reading', 1, 2, 'Book'),
('reading-6', 'Reading', 'reading', 1, 2, 'Small'),
('reading-7', 'Reading', 'reading', 1, 3, 'Pig'),
('reading-8', 'Reading', 'reading', 2, 3, 'The dog runs fast.'),
('reading-9', 'Reading', 'reading', 2, 3, 'Jump'),
('reading-10', 'Reading', 'reading', 2, 4, 'Boxes'),
('reading-11', 'Reading', 'reading', 3, 4, 'Garden'),
('reading-12', 'Reading', 'reading', 3, 4, 'She runs fast.'),
('reading-13', 'Reading', 'reading', 3, 4, 'Very big'),
('reading-14', 'Reading', 'reading', 4, 4, 'Brave'),
('reading-15', 'Reading', 'reading', 4, 4, 'Joyful'),
('reading-16', 'Reading', 'reading', 4, 4, 'addis ababa'),
('science-17', 'Science', 'science', 0, 1, '🐦 Bird'),
('science-18', 'Science', 'science', 0, 1, '🐱 Cat'),
('science-19', 'Science', 'science', 0, 1, '🌳 Tree'),
('science-20', 'Science', 'science', 1, 2, 'Rock'),
('science-21', 'Science', 'science', 1, 2, 'Water'),
('science-22', 'Science', 'science', 1, 3, 'Sunlight and water'),
('science-23', 'Science', 'science', 2, 3, 'Smell'),
('science-24', 'Science', 'science', 2, 4, '0'),
('science-25', 'Science', 'science', 2, 4, 'Earth'),
('science-26', 'Science', 'science', 3, 4, 'Sunlight'),
('science-27', 'Science', 'science', 3, 4, 'Carbon dioxide'),
('science-28', 'Science', 'science', 3, 4, 'Precipitation'),
('science-29', 'Science', 'science', 4, 4, 'Heart'),
('science-30', 'Science', 'science', 4, 4, 'Iron nails'),
('science-31', 'Science', 'science', 4, 4, 'Herbivores'),
('world-32', 'World', 'general-knowledge', 0, 1, '👟 Shoes'),
('world-33', 'World', 'general-knowledge', 0, 1, 'Green'),
('world-34', 'World', 'general-knowledge', 1, 2, '7'),
('world-35', 'World', 'general-knowledge', 1, 2, 'Doctor'),
('world-36', 'World', 'general-knowledge', 2, 3, 'Addis Ababa'),
('world-37', 'World', 'general-knowledge', 2, 3, '12'),
('world-38', 'World', 'general-knowledge', 2, 4, 'Pacific'),
('world-39', 'World', 'general-knowledge', 3, 4, 'Africa'),
('world-40', 'World', 'general-knowledge', 3, 4, 'Lake Tana'),
('world-41', 'World', 'general-knowledge', 4, 4, '7'),
('world-42', 'World', 'general-knowledge', 4, 4, 'East'),
('logic-43', 'Logic', 'patterns', 0, 1, '🔴'),
('logic-44', 'Logic', 'patterns', 0, 1, 'Triangle'),
('logic-45', 'Logic', 'patterns', 0, 1, '🍌'),
('logic-46', 'Logic', 'patterns', 1, 2, '8'),
('logic-47', 'Logic', 'patterns', 1, 2, 'Elephant'),
('logic-48', 'Logic', 'patterns', 2, 3, '20'),
('logic-49', 'Logic', 'patterns', 2, 4, 'Tuesday'),
('logic-50', 'Logic', 'patterns', 3, 4, '25'),
('logic-51', 'Logic', 'patterns', 3, 4, '4'),
('logic-52', 'Logic', 'patterns', 4, 4, 'Ben'),
('logic-53', 'Logic', 'patterns', 4, 4, '48')
ON CONFLICT (id) DO UPDATE SET
  subject = EXCLUDED.subject,
  skill = EXCLUDED.skill,
  grade_min = EXCLUDED.grade_min,
  grade_max = EXCLUDED.grade_max,
  correct_answer = EXCLUDED.correct_answer,
  active = true;

CREATE OR REPLACE FUNCTION public.submit_early_quiz_answer(
  p_attempt_id uuid,
  p_question_id text,
  p_answer text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_grade text;
  v_grade_num integer;
  v_question public.early_quiz_questions%rowtype;
  v_correct boolean;
  v_xp_reward integer := 8;
  v_coin_reward integer := 3;
  v_daily_rewards integer := 0;
  v_xp integer := 0;
  v_level integer := 1;
  v_rank text;
  v_season_xp integer := 0;
  v_coins integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_attempt_id IS NULL OR nullif(trim(p_question_id), '') IS NULL OR p_answer IS NULL THEN
    RAISE EXCEPTION 'Attempt, question and answer are required';
  END IF;

  SELECT grade INTO v_grade
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF lower(trim(v_grade)) ~ '^(k|kindergarten|pre-?k)$' THEN
    v_grade_num := 0;
  ELSIF lower(trim(v_grade)) ~ '^(?:grade\\s*)?[1-4]\\+?$' THEN
    v_grade_num := substring(lower(trim(v_grade)) from '([1-4])')::integer;
  ELSE
    RAISE EXCEPTION 'Early quizzes are only available to KG through Grade 4';
  END IF;

  SELECT * INTO v_question
  FROM public.early_quiz_questions
  WHERE id = trim(p_question_id)
    AND active = true
    AND v_grade_num BETWEEN grade_min AND grade_max;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('processed', false, 'unsupported_question', true, 'reward_xp', 0, 'reward_coins', 0);
  END IF;

  IF EXISTS (SELECT 1 FROM public.early_activity_attempts WHERE id = p_attempt_id AND user_id = v_user_id) THEN
    SELECT xp, level, rank, season_xp INTO v_xp, v_level, v_rank, v_season_xp
    FROM public.profiles WHERE id = v_user_id;
    SELECT coins INTO v_coins FROM public.user_currency WHERE user_id = v_user_id;
    RETURN jsonb_build_object('processed', false, 'duplicate', true,
      'xp', coalesce(v_xp,0), 'level', coalesce(v_level,1), 'rank', v_rank,
      'season_xp', coalesce(v_season_xp,0), 'coins', coalesce(v_coins,0));
  END IF;

  v_correct := p_answer = v_question.correct_answer;

  SELECT count(*) INTO v_daily_rewards
  FROM public.early_activity_attempts
  WHERE user_id = v_user_id
    AND question_id IS NOT NULL
    AND created_at >= date_trunc('day', now())
    AND (xp_earned > 0 OR coins_earned > 0);

  IF v_daily_rewards >= 100 THEN
    v_xp_reward := 0;
    v_coin_reward := 0;
  END IF;

  INSERT INTO public.early_activity_attempts
    (id, user_id, activity_id, skill, correct, xp_earned, coins_earned, question_id)
  VALUES (
    p_attempt_id, v_user_id, 'early-quiz-' || lower(v_question.subject),
    v_question.skill, v_correct,
    CASE WHEN v_correct THEN v_xp_reward ELSE 0 END,
    CASE WHEN v_correct THEN v_coin_reward ELSE 0 END,
    v_question.id
  );

  INSERT INTO public.early_activity_progress
    (user_id, activity_id, skill, attempts, correct_answers, completions,
     xp_earned, coins_earned, last_played_at)
  VALUES (
    v_user_id, 'early-quiz-' || lower(v_question.subject), v_question.skill,
    1, CASE WHEN v_correct THEN 1 ELSE 0 END, 0,
    CASE WHEN v_correct THEN v_xp_reward ELSE 0 END,
    CASE WHEN v_correct THEN v_coin_reward ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id, activity_id) DO UPDATE SET
    attempts = public.early_activity_progress.attempts + 1,
    correct_answers = public.early_activity_progress.correct_answers + CASE WHEN v_correct THEN 1 ELSE 0 END,
    xp_earned = public.early_activity_progress.xp_earned + CASE WHEN v_correct THEN v_xp_reward ELSE 0 END,
    coins_earned = public.early_activity_progress.coins_earned + CASE WHEN v_correct THEN v_coin_reward ELSE 0 END,
    skill = EXCLUDED.skill,
    last_played_at = now();

  IF v_correct AND v_xp_reward > 0 THEN
    UPDATE public.profiles
    SET xp = xp + v_xp_reward,
        level = greatest(1, floor((xp + v_xp_reward) / 100.0)::integer + 1),
        rank = public.calculate_rank(xp + v_xp_reward),
        season_xp = greatest(0, season_xp + v_xp_reward),
        updated_at = now()
    WHERE id = v_user_id
    RETURNING xp, level, rank, season_xp INTO v_xp, v_level, v_rank, v_season_xp;
  ELSE
    SELECT xp, level, rank, season_xp INTO v_xp, v_level, v_rank, v_season_xp
    FROM public.profiles WHERE id = v_user_id;
  END IF;

  INSERT INTO public.user_currency(user_id, coins, gems)
  VALUES (v_user_id, CASE WHEN v_correct THEN v_coin_reward ELSE 0 END, 0)
  ON CONFLICT (user_id) DO UPDATE SET
    coins = public.user_currency.coins + EXCLUDED.coins,
    updated_at = now()
  RETURNING coins INTO v_coins;

  RETURN jsonb_build_object(
    'processed', true, 'duplicate', false, 'correct', v_correct,
    'xp', coalesce(v_xp,0), 'level', coalesce(v_level,1), 'rank', v_rank,
    'season_xp', coalesce(v_season_xp,0), 'coins', coalesce(v_coins,0),
    'reward_xp', CASE WHEN v_correct THEN v_xp_reward ELSE 0 END,
    'reward_coins', CASE WHEN v_correct THEN v_coin_reward ELSE 0 END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_early_achievement(p_achievement_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_grade text;
  v_achievement record;
  v_existing public.early_user_achievements%rowtype;
  v_attempts integer := 0;
  v_correct integer := 0;
  v_progress integer := 0;
  v_xp_total integer := 0;
  v_reward_xp integer := 0;
  v_reward_coins integer := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF nullif(trim(p_achievement_key), '') IS NULL THEN RAISE EXCEPTION 'Achievement key is required'; END IF;

  SELECT grade INTO v_grade FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND OR NOT (
    lower(trim(v_grade)) ~ '^(k|kindergarten|pre-?k)$'
    OR lower(trim(v_grade)) ~ '^(?:grade\\s*)?[1-4]\\+?$'
  ) THEN
    RAISE EXCEPTION 'Early achievements are only available to KG through Grade 4';
  END IF;

  SELECT id, requirement_type, requirement_value, reward_xp, reward_coins
  INTO v_achievement
  FROM public.early_achievements
  WHERE key = trim(p_achievement_key) AND active = true;

  IF NOT FOUND THEN RAISE EXCEPTION 'Achievement not found'; END IF;

  SELECT * INTO v_existing
  FROM public.early_user_achievements
  WHERE user_id = v_user_id AND achievement_id = v_achievement.id
  FOR UPDATE;

  IF FOUND AND v_existing.completed THEN
    RETURN jsonb_build_object('success', false, 'already_claimed', true);
  END IF;

  SELECT count(*)::integer,
         count(*) FILTER (WHERE correct)::integer,
         coalesce(sum(xp_earned),0)::integer
  INTO v_attempts, v_correct, v_xp_total
  FROM public.early_activity_attempts
  WHERE user_id = v_user_id AND question_id IS NOT NULL;

  CASE v_achievement.requirement_type
    WHEN 'completions' THEN
      SELECT count(DISTINCT activity_id)::integer INTO v_progress
      FROM public.early_activity_attempts
      WHERE user_id = v_user_id AND question_id IS NOT NULL AND correct = true;
    WHEN 'math_attempts' THEN
      SELECT count(*)::integer INTO v_progress FROM public.early_activity_attempts
      WHERE user_id = v_user_id AND question_id IS NOT NULL AND skill = 'math';
    WHEN 'reading_attempts' THEN
      SELECT count(*)::integer INTO v_progress FROM public.early_activity_attempts
      WHERE user_id = v_user_id AND question_id IS NOT NULL AND skill = 'reading';
    WHEN 'science_attempts' THEN
      SELECT count(*)::integer INTO v_progress FROM public.early_activity_attempts
      WHERE user_id = v_user_id AND question_id IS NOT NULL AND skill = 'science';
    WHEN 'coding_attempts' THEN
      SELECT count(*)::integer INTO v_progress FROM public.early_activity_attempts
      WHERE user_id = v_user_id AND question_id IS NOT NULL AND skill = 'sequencing';
    WHEN 'accuracy_80' THEN
      v_progress := CASE WHEN v_attempts >= 10 AND v_correct::numeric / greatest(v_attempts,1) >= 0.8
        THEN 10 ELSE least(v_attempts,10) END;
    WHEN 'xp_earned' THEN
      v_progress := v_xp_total;
    ELSE
      v_progress := 0;
  END CASE;

  IF v_progress < v_achievement.requirement_value THEN
    RAISE EXCEPTION 'Achievement requirement has not been met by verified quiz activity';
  END IF;

  v_reward_xp := greatest(0, coalesce(v_achievement.reward_xp,0));
  v_reward_coins := greatest(0, coalesce(v_achievement.reward_coins,0));

  IF FOUND THEN
    UPDATE public.early_user_achievements
    SET progress = v_progress, completed = true, unlocked_at = coalesce(unlocked_at, now())
    WHERE id = v_existing.id;
  ELSE
    INSERT INTO public.early_user_achievements(user_id, achievement_id, progress, completed, unlocked_at)
    VALUES (v_user_id, v_achievement.id, v_progress, true, now());
  END IF;

  UPDATE public.profiles
  SET xp = xp + v_reward_xp,
      level = greatest(1, floor((xp + v_reward_xp) / 100.0)::integer + 1),
      rank = public.calculate_rank(xp + v_reward_xp),
      season_xp = greatest(0, season_xp + v_reward_xp),
      updated_at = now()
  WHERE id = v_user_id;

  INSERT INTO public.user_currency(user_id, coins, gems)
  VALUES (v_user_id, v_reward_coins, 0)
  ON CONFLICT (user_id) DO UPDATE SET
    coins = public.user_currency.coins + EXCLUDED.coins,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'xp_awarded', v_reward_xp, 'coins_awarded', v_reward_coins);
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_early_activity(uuid, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_early_quiz_answer(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_early_quiz_answer(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.claim_early_achievement(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_early_achievement(text) TO authenticated;
