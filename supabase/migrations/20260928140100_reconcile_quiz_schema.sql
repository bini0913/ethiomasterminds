-- Reconcile quiz schema with the production frontend/backend contract.
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS level_min integer,
  ADD COLUMN IF NOT EXISTS level_max integer;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS option_a text,
  ADD COLUMN IF NOT EXISTS option_b text,
  ADD COLUMN IF NOT EXISTS option_c text,
  ADD COLUMN IF NOT EXISTS option_d text,
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS subject text;

CREATE INDEX IF NOT EXISTS idx_quizzes_grade_subject_difficulty_approved
  ON public.quizzes (grade, subject, difficulty, is_approved);

CREATE INDEX IF NOT EXISTS idx_questions_quiz_order
  ON public.questions (quiz_id, order_index);