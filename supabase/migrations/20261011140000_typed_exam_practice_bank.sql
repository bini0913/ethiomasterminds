-- Add explicit exam classification so Academic Prep can recommend approved sets
-- by structured type instead of guessing from quiz titles alone.
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS exam_type text NOT NULL DEFAULT 'general'
  CHECK (exam_type IN (
    'general',
    'school_exam',
    'coursework',
    'grade12_exit',
    'entrance_exam',
    'past_paper',
    'mock_exam'
  ));

CREATE INDEX IF NOT EXISTS quizzes_exam_type_grade_subject_approved_idx
  ON public.quizzes (exam_type, grade, subject)
  WHERE is_approved = true;

COMMENT ON COLUMN public.quizzes.exam_type IS
  'Optional structured classification for approved Academic Prep practice sets.';
