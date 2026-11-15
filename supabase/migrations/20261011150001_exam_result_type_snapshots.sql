-- Preserve the exam classification and subject used at attempt time for reporting.
ALTER TABLE public.quiz_results
  ADD COLUMN IF NOT EXISTS exam_type text,
  ADD COLUMN IF NOT EXISTS subject text;

COMMENT ON COLUMN public.quiz_results.exam_type IS
  'Snapshot of the quiz exam_type when this attempt was submitted.';
COMMENT ON COLUMN public.quiz_results.subject IS
  'Snapshot of the quiz subject when this attempt was submitted.';
