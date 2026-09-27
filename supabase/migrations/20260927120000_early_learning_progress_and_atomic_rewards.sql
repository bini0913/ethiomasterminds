-- Early KG-4 learning progress and atomic activity rewards.
-- Keeps rewards and skill progress in one server-side transaction.

CREATE TABLE IF NOT EXISTS public.early_activity_attempts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id text NOT NULL,
  skill text NOT NULL,
  correct boolean NOT NULL,
  xp_earned integer NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  coins_earned integer NOT NULL DEFAULT 0 CHECK (coins_earned >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.early_activity_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id text NOT NULL,
  skill text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  correct_answers integer NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  completions integer NOT NULL DEFAULT 0 CHECK (completions >= 0),
  xp_earned integer NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  coins_earned integer NOT NULL DEFAULT 0 CHECK (coins_earned >= 0),
  last_played_at timestamptz,
  PRIMARY KEY (user_id, activity_id)
);

ALTER TABLE public.early_activity_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.early_activity_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own early attempts" ON public.early_activity_attempts;
CREATE POLICY "Users can view own early attempts"
ON public.early_activity_attempts FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own early progress" ON public.early_activity_progress;
CREATE POLICY "Users can view own early progress"
ON public.early_activity_progress FOR SELECT
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_early_attempts_user_created
ON public.early_activity_attempts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_early_progress_user_skill
ON public.early_activity_progress(user_id, skill);

CREATE OR REPLACE FUNCTION public.complete_early_activity(
  p_attempt_id uuid,
  p_activity_id text,
  p_skill text,
  p_correct boolean,
  p_xp integer,
  p_coins integer,
  p_completed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_xp integer;
  v_level integer;
  v_rank text;
  v_coins integer;
  v_grade text;
  v_tier text;
  v_attempts integer;
  v_correct integer;
  v_completions integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_activity_id IS NULL OR length(trim(p_activity_id)) = 0 THEN
    RAISE EXCEPTION 'Activity id is required';
  END IF;

  IF p_skill IS NULL OR length(trim(p_skill)) = 0 THEN
    RAISE EXCEPTION 'Skill is required';
  END IF;

  SELECT grade INTO v_grade FROM public.profiles WHERE id = v_user_id;
  IF v_grade IS NULL OR NOT (lower(trim(v_grade)) ~ '^(k|kindergarten|pre-?k)
    RAISE EXCEPTION 'Invalid reward';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.early_activity_attempts
    WHERE id = p_attempt_id AND user_id = v_user_id
  ) THEN
    SELECT xp, level, rank INTO v_xp, v_level, v_rank
    FROM public.profiles WHERE id = v_user_id;

    SELECT coins INTO v_coins
    FROM public.user_currency WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
      'processed', false,
      'duplicate', true,
      'xp', COALESCE(v_xp, 0),
      'level', COALESCE(v_level, 1),
      'rank', v_rank,
      'coins', COALESCE(v_coins, 0)
    );
  END IF;

  INSERT INTO public.early_activity_attempts (
    id, user_id, activity_id, skill, correct, xp_earned, coins_earned
  ) VALUES (
    p_attempt_id, v_user_id, trim(p_activity_id), trim(p_skill),
    p_correct, CASE WHEN p_correct THEN p_xp ELSE 0 END,
    CASE WHEN p_correct THEN p_coins ELSE 0 END
  );

  INSERT INTO public.early_activity_progress (
    user_id, activity_id, skill, attempts, correct_answers, completions,
    xp_earned, coins_earned, last_played_at
  ) VALUES (
    v_user_id, trim(p_activity_id), trim(p_skill), 1,
    CASE WHEN p_correct THEN 1 ELSE 0 END,
    CASE WHEN p_completed THEN 1 ELSE 0 END,
    CASE WHEN p_correct THEN p_xp ELSE 0 END,
    CASE WHEN p_correct THEN p_coins ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id, activity_id) DO UPDATE SET
    attempts = early_activity_progress.attempts + 1,
    correct_answers = early_activity_progress.correct_answers +
      CASE WHEN p_correct THEN 1 ELSE 0 END,
    completions = early_activity_progress.completions +
      CASE WHEN p_completed THEN 1 ELSE 0 END,
    xp_earned = early_activity_progress.xp_earned +
      CASE WHEN p_correct THEN p_xp ELSE 0 END,
    coins_earned = early_activity_progress.coins_earned +
      CASE WHEN p_correct THEN p_coins ELSE 0 END,
    skill = EXCLUDED.skill,
    last_played_at = now();

  IF p_correct AND p_xp > 0 THEN
    UPDATE public.profiles
    SET xp = COALESCE(xp, 0) + p_xp,
        level = FLOOR((COALESCE(xp, 0) + p_xp) / 100) + 1,
        rank = calculate_rank(COALESCE(xp, 0) + p_xp)
    WHERE id = v_user_id
    RETURNING xp, level, rank INTO v_xp, v_level, v_rank;
  ELSE
    SELECT xp, level, rank INTO v_xp, v_level, v_rank
    FROM public.profiles WHERE id = v_user_id;
  END IF;

  INSERT INTO public.user_currency (user_id, coins)
  VALUES (v_user_id, CASE WHEN p_correct THEN p_coins ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE SET
    coins = public.user_currency.coins +
      CASE WHEN p_correct THEN p_coins ELSE 0 END,
    updated_at = now()
  RETURNING coins INTO v_coins;

  RETURN jsonb_build_object(
    'processed', true,
    'duplicate', false,
    'xp', COALESCE(v_xp, 0),
    'level', COALESCE(v_level, 1),
    'rank', v_rank,
    'coins', COALESCE(v_coins, 0)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.complete_early_activity(uuid, text, text, boolean, integer, integer, boolean)
TO authenticated;
 OR lower(trim(v_grade)) ~ '^(?:grade\\s*)?[1-4]\\+?
    RAISE EXCEPTION 'Invalid reward';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.early_activity_attempts
    WHERE id = p_attempt_id AND user_id = v_user_id
  ) THEN
    SELECT xp, level, rank INTO v_xp, v_level, v_rank
    FROM public.profiles WHERE id = v_user_id;

    SELECT coins INTO v_coins
    FROM public.user_currency WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
      'processed', false,
      'duplicate', true,
      'xp', COALESCE(v_xp, 0),
      'level', COALESCE(v_level, 1),
      'rank', v_rank,
      'coins', COALESCE(v_coins, 0)
    );
  END IF;

  INSERT INTO public.early_activity_attempts (
    id, user_id, activity_id, skill, correct, xp_earned, coins_earned
  ) VALUES (
    p_attempt_id, v_user_id, trim(p_activity_id), trim(p_skill),
    p_correct, CASE WHEN p_correct THEN p_xp ELSE 0 END,
    CASE WHEN p_correct THEN p_coins ELSE 0 END
  );

  INSERT INTO public.early_activity_progress (
    user_id, activity_id, skill, attempts, correct_answers, completions,
    xp_earned, coins_earned, last_played_at
  ) VALUES (
    v_user_id, trim(p_activity_id), trim(p_skill), 1,
    CASE WHEN p_correct THEN 1 ELSE 0 END,
    CASE WHEN p_completed THEN 1 ELSE 0 END,
    CASE WHEN p_correct THEN p_xp ELSE 0 END,
    CASE WHEN p_correct THEN p_coins ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id, activity_id) DO UPDATE SET
    attempts = early_activity_progress.attempts + 1,
    correct_answers = early_activity_progress.correct_answers +
      CASE WHEN p_correct THEN 1 ELSE 0 END,
    completions = early_activity_progress.completions +
      CASE WHEN p_completed THEN 1 ELSE 0 END,
    xp_earned = early_activity_progress.xp_earned +
      CASE WHEN p_correct THEN p_xp ELSE 0 END,
    coins_earned = early_activity_progress.coins_earned +
      CASE WHEN p_correct THEN p_coins ELSE 0 END,
    skill = EXCLUDED.skill,
    last_played_at = now();

  IF p_correct AND p_xp > 0 THEN
    UPDATE public.profiles
    SET xp = COALESCE(xp, 0) + p_xp,
        level = FLOOR((COALESCE(xp, 0) + p_xp) / 100) + 1,
        rank = calculate_rank(COALESCE(xp, 0) + p_xp)
    WHERE id = v_user_id
    RETURNING xp, level, rank INTO v_xp, v_level, v_rank;
  ELSE
    SELECT xp, level, rank INTO v_xp, v_level, v_rank
    FROM public.profiles WHERE id = v_user_id;
  END IF;

  INSERT INTO public.user_currency (user_id, coins)
  VALUES (v_user_id, CASE WHEN p_correct THEN p_coins ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE SET
    coins = public.user_currency.coins +
      CASE WHEN p_correct THEN p_coins ELSE 0 END,
    updated_at = now()
  RETURNING coins INTO v_coins;

  RETURN jsonb_build_object(
    'processed', true,
    'duplicate', false,
    'xp', COALESCE(v_xp, 0),
    'level', COALESCE(v_level, 1),
    'rank', v_rank,
    'coins', COALESCE(v_coins, 0)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.complete_early_activity(uuid, text, text, boolean, integer, integer, boolean)
TO authenticated;
) THEN
    RAISE EXCEPTION 'Early activities are only available to KG through Grade 4';
  END IF;

  IF p_xp < 0 OR p_xp > 50 OR p_coins < 0 OR p_coins > 50 THEN
    RAISE EXCEPTION 'Invalid reward';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.early_activity_attempts
    WHERE id = p_attempt_id AND user_id = v_user_id
  ) THEN
    SELECT xp, level, rank INTO v_xp, v_level, v_rank
    FROM public.profiles WHERE id = v_user_id;

    SELECT coins INTO v_coins
    FROM public.user_currency WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
      'processed', false,
      'duplicate', true,
      'xp', COALESCE(v_xp, 0),
      'level', COALESCE(v_level, 1),
      'rank', v_rank,
      'coins', COALESCE(v_coins, 0)
    );
  END IF;

  INSERT INTO public.early_activity_attempts (
    id, user_id, activity_id, skill, correct, xp_earned, coins_earned
  ) VALUES (
    p_attempt_id, v_user_id, trim(p_activity_id), trim(p_skill),
    p_correct, CASE WHEN p_correct THEN p_xp ELSE 0 END,
    CASE WHEN p_correct THEN p_coins ELSE 0 END
  );

  INSERT INTO public.early_activity_progress (
    user_id, activity_id, skill, attempts, correct_answers, completions,
    xp_earned, coins_earned, last_played_at
  ) VALUES (
    v_user_id, trim(p_activity_id), trim(p_skill), 1,
    CASE WHEN p_correct THEN 1 ELSE 0 END,
    CASE WHEN p_completed THEN 1 ELSE 0 END,
    CASE WHEN p_correct THEN p_xp ELSE 0 END,
    CASE WHEN p_correct THEN p_coins ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id, activity_id) DO UPDATE SET
    attempts = early_activity_progress.attempts + 1,
    correct_answers = early_activity_progress.correct_answers +
      CASE WHEN p_correct THEN 1 ELSE 0 END,
    completions = early_activity_progress.completions +
      CASE WHEN p_completed THEN 1 ELSE 0 END,
    xp_earned = early_activity_progress.xp_earned +
      CASE WHEN p_correct THEN p_xp ELSE 0 END,
    coins_earned = early_activity_progress.coins_earned +
      CASE WHEN p_correct THEN p_coins ELSE 0 END,
    skill = EXCLUDED.skill,
    last_played_at = now();

  IF p_correct AND p_xp > 0 THEN
    UPDATE public.profiles
    SET xp = COALESCE(xp, 0) + p_xp,
        level = FLOOR((COALESCE(xp, 0) + p_xp) / 100) + 1,
        rank = calculate_rank(COALESCE(xp, 0) + p_xp)
    WHERE id = v_user_id
    RETURNING xp, level, rank INTO v_xp, v_level, v_rank;
  ELSE
    SELECT xp, level, rank INTO v_xp, v_level, v_rank
    FROM public.profiles WHERE id = v_user_id;
  END IF;

  INSERT INTO public.user_currency (user_id, coins)
  VALUES (v_user_id, CASE WHEN p_correct THEN p_coins ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE SET
    coins = public.user_currency.coins +
      CASE WHEN p_correct THEN p_coins ELSE 0 END,
    updated_at = now()
  RETURNING coins INTO v_coins;

  RETURN jsonb_build_object(
    'processed', true,
    'duplicate', false,
    'xp', COALESCE(v_xp, 0),
    'level', COALESCE(v_level, 1),
    'rank', v_rank,
    'coins', COALESCE(v_coins, 0)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.complete_early_activity(uuid, text, text, boolean, integer, integer, boolean)
TO authenticated;
