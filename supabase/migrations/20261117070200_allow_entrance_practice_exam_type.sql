-- The entrance-practice quiz type is used only for original practice content.
-- Keep every existing supported type and add the missing category safely.
ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_exam_type_check;

ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_exam_type_check
  CHECK (exam_type IN (
    'general',
    'school_exam',
    'coursework',
    'grade12_exit',
    'entrance_exam',
    'past_paper',
    'mock_exam',
    'entrance_practice'
  ));
