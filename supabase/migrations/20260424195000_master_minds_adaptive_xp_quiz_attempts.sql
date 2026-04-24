-- Master Minds Adaptive XP + Adaptive Quiz upgrade
-- Adds quiz_attempts table to persist finalized quiz summaries for progression logic.

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  correct_answers INTEGER NOT NULL CHECK (correct_answers >= 0),
  wrong_answers INTEGER NOT NULL CHECK (wrong_answers >= 0),
  xp_earned INTEGER NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'Extreme')),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quiz_attempts'
      AND policyname = 'Users can view own quiz attempts'
  ) THEN
    CREATE POLICY "Users can view own quiz attempts"
    ON public.quiz_attempts
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quiz_attempts'
      AND policyname = 'Users can insert own quiz attempts'
  ) THEN
    CREATE POLICY "Users can insert own quiz attempts"
    ON public.quiz_attempts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_completed_at
ON public.quiz_attempts(user_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_user
ON public.quiz_attempts(quiz_id, user_id);

CREATE OR REPLACE FUNCTION public.enforce_quiz_attempt_cooldown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_completed_at timestamptz;
BEGIN
  SELECT completed_at
  INTO v_last_completed_at
  FROM public.quiz_attempts
  WHERE user_id = NEW.user_id
    AND quiz_id = NEW.quiz_id
  ORDER BY completed_at DESC
  LIMIT 1;

  IF v_last_completed_at IS NOT NULL
     AND NEW.completed_at < v_last_completed_at + interval '60 seconds' THEN
    RAISE EXCEPTION 'Quiz cooldown active. Please wait before retrying.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quiz_attempt_cooldown ON public.quiz_attempts;
CREATE TRIGGER trg_quiz_attempt_cooldown
BEFORE INSERT ON public.quiz_attempts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_quiz_attempt_cooldown();
