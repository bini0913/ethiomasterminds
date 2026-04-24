-- MASTER MINDS: Full quiz reset, structured adaptive quiz content,
-- server-side validation, and XP rules.

-- 1) Schema hardening for adaptive quizzes
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS level_min integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS level_max integer NOT NULL DEFAULT 5;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS option_a text,
  ADD COLUMN IF NOT EXISTS option_b text,
  ADD COLUMN IF NOT EXISTS option_c text,
  ADD COLUMN IF NOT EXISTS option_d text,
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS subject text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quizzes_difficulty_check_v2'
  ) THEN
    ALTER TABLE public.quizzes
      ADD CONSTRAINT quizzes_difficulty_check_v2
      CHECK (lower(difficulty) IN ('easy', 'medium', 'hard', 'extreme'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'questions_difficulty_check_v2'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_difficulty_check_v2
      CHECK (difficulty IS NULL OR lower(difficulty) IN ('easy', 'medium', 'hard', 'extreme'));
  END IF;
END $$;

-- Keep row-level metadata in sync on questions for fast filtering.
UPDATE public.questions q
SET
  difficulty = COALESCE(q.difficulty, qu.difficulty, 'medium'),
  grade = COALESCE(q.grade, qu.grade),
  subject = COALESCE(q.subject, qu.subject),
  option_a = COALESCE(q.option_a, q.options->>0),
  option_b = COALESCE(q.option_b, q.options->>1),
  option_c = COALESCE(q.option_c, q.options->>2),
  option_d = COALESCE(q.option_d, q.options->>3)
FROM public.quizzes qu
WHERE q.quiz_id = qu.id;

ALTER TABLE public.quiz_results
  ADD COLUMN IF NOT EXISTS submission_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quiz_results_submission_id_unique'
  ) THEN
    ALTER TABLE public.quiz_results
      ADD CONSTRAINT quiz_results_submission_id_unique UNIQUE (submission_id);
  END IF;
END $$;

-- 2) Backup and safe reset (order matters)
CREATE TABLE IF NOT EXISTS public.quizzes_backup (LIKE public.quizzes INCLUDING ALL);
ALTER TABLE public.quizzes_backup ADD COLUMN IF NOT EXISTS backup_batch timestamptz NOT NULL DEFAULT now();
INSERT INTO public.quizzes_backup SELECT q.*, now() FROM public.quizzes q;

CREATE TABLE IF NOT EXISTS public.questions_backup (LIKE public.questions INCLUDING ALL);
ALTER TABLE public.questions_backup ADD COLUMN IF NOT EXISTS backup_batch timestamptz NOT NULL DEFAULT now();
INSERT INTO public.questions_backup SELECT q.*, now() FROM public.questions q;

DO $$
BEGIN
  IF to_regclass('public.quiz_attempts') IS NOT NULL THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS public.quiz_attempts_backup (LIKE public.quiz_attempts INCLUDING ALL)';
    EXECUTE 'ALTER TABLE public.quiz_attempts_backup ADD COLUMN IF NOT EXISTS backup_batch timestamptz NOT NULL DEFAULT now()';
    EXECUTE 'INSERT INTO public.quiz_attempts_backup SELECT qa.*, now() FROM public.quiz_attempts qa';
  ELSE
    CREATE TABLE IF NOT EXISTS public.quiz_attempts_backup (LIKE public.quiz_results INCLUDING ALL);
    ALTER TABLE public.quiz_attempts_backup ADD COLUMN IF NOT EXISTS backup_batch timestamptz NOT NULL DEFAULT now();
    INSERT INTO public.quiz_attempts_backup SELECT qr.*, now() FROM public.quiz_results qr;
  END IF;
END $$;

DELETE FROM public.question_attempts;
DELETE FROM public.quiz_results;
DO $$
BEGIN
  IF to_regclass('public.quiz_attempts') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.quiz_attempts';
  END IF;
END $$;
DELETE FROM public.questions;
DELETE FROM public.quizzes;

-- 3) Structured quiz insertion: Grade -> Subject -> Difficulty
WITH structured_quizzes AS (
  INSERT INTO public.quizzes (
    title,
    description,
    subject,
    grade,
    difficulty,
    level_min,
    level_max,
    created_by,
    is_approved,
    is_public,
    time_limit
  )
  SELECT
    format('%s Foundations - Grade %s', s.subject, s.grade),
    format('%s curriculum quiz for Grade %s (%s)', s.subject, s.grade, initcap(s.difficulty)),
    s.subject,
    s.grade,
    s.difficulty,
    s.level_min,
    s.level_max,
    gen_random_uuid(),
    true,
    true,
    600
  FROM (
    SELECT g.grade, sub.subject, d.difficulty,
      CASE d.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 6 WHEN 'hard' THEN 11 ELSE 21 END AS level_min,
      CASE d.difficulty WHEN 'easy' THEN 5 WHEN 'medium' THEN 10 WHEN 'hard' THEN 20 ELSE 60 END AS level_max
    FROM (VALUES ('6A'), ('6B'), ('7A')) g(grade)
    CROSS JOIN (VALUES ('Math'), ('Science'), ('English')) sub(subject)
    CROSS JOIN (VALUES ('easy'), ('medium'), ('hard'), ('extreme')) d(difficulty)
  ) s
  RETURNING id, grade, subject, difficulty
),
question_templates AS (
  SELECT * FROM (VALUES
    ('Math', 'easy',
      'What is %s + %s?',
      'What is %s × %s?',
      'Round %s to the nearest ten.',
      'If one notebook costs $%s, what is the cost of %s notebooks?',
      'Which fraction is equivalent to %s/%s?',
      'What is the perimeter of a rectangle with sides %s cm and %s cm?',
      'What is %s%% of %s?',
      'What is %s ÷ %s?',
      'Which number is greatest: %s, %s, %s, or %s?',
      'If a train travels %s km in 1 hour, how far in %s hours?'
    ),
    ('Math', 'medium',
      'Solve for x: x + %s = %s.',
      'Evaluate: %s² + %s².',
      'Which ratio is simplest for %s:%s?',
      'Find the mean of %s, %s, %s, %s.',
      'What is %s/%s + %s/%s?',
      'Convert %s%% to a fraction in simplest form.',
      'A triangle has base %s and height %s. What is its area?',
      'Find the LCM of %s and %s.',
      'What is the value of 3x when x=%s?',
      'Expand: (x + %s)(x + %s).'
    ),
    ('Math', 'hard',
      'Solve: 2x - %s = %s.',
      'Factor: x² + %sx + %s.',
      'Solve the inequality: x/%s > %s.',
      'What is the slope between (%s,%s) and (%s,%s)?',
      'Simplify: (%s^3 × %s^2) ÷ %s^2.',
      'A %s%% discount is applied to $%s. Final price?',
      'If f(x)=2x+%s, find f(%s).',
      'Solve: |x-%s| = %s.',
      'Find the area of a circle with radius %s (use π≈3.14).',
      'What is the probability of drawing a red card from a standard deck?'
    ),
    ('Math', 'extreme',
      'Solve the system: x + y = %s and x - y = %s.',
      'If x² - %sx + %s = 0, what are the roots?',
      'Differentiate y = %sx² + %sx + %s.',
      'A sequence starts %s, %s, %s... Find the 6th term if arithmetic.',
      'Evaluate: (%s/%s) ÷ (%s/%s).',
      'Find the equation of line through (%s,%s) with slope %s.',
      'If sin θ = %s/%s in a right triangle, find cos θ.',
      'Compute determinant of [[%s,%s],[%s,%s]].',
      'What is log₁₀(%s)?',
      'Solve: 2^x = %s.'
    ),
    ('Science', 'easy',
      'Which organ pumps blood in humans?',
      'What gas do plants absorb for photosynthesis?',
      'What is the chemical symbol for water?',
      'Which planet is known as the Red Planet?',
      'What force pulls objects toward Earth?',
      'Which body system includes bones?',
      'What is the boiling point of water at sea level in °C?',
      'Which part of a plant absorbs water?',
      'What state of matter has a definite shape and volume?',
      'What is the nearest star to Earth?'
    ),
    ('Science', 'medium',
      'Which blood cells help fight infection?',
      'What is the basic unit of life?',
      'What process turns liquid water to vapor?',
      'Which planet has prominent rings?',
      'What is the function of chlorophyll in plants?',
      'What type of rock forms from cooled lava?',
      'What is the pH of neutral water?',
      'Why does the Moon appear to change shape?',
      'Name the process by which organisms pass traits to offspring.',
      'What is the role of the respiratory system?'
    ),
    ('Science', 'hard',
      'Explain why metals conduct electricity better than plastics.',
      'What is Newton''s second law of motion?',
      'How does increasing temperature affect particle motion?',
      'What is the role of mitochondria in cells?',
      'Why do seasons occur on Earth?',
      'Differentiate between physical and chemical changes with an example.',
      'How does natural selection support evolution?',
      'What causes ocean tides?',
      'What is the function of enzymes in digestion?',
      'Why are carbon compounds central to life chemistry?'
    ),
    ('Science', 'extreme',
      'How does homeostasis maintain internal balance in organisms?',
      'Describe energy transfer in cellular respiration.',
      'What is the significance of DNA replication fidelity?',
      'How do greenhouse gases influence climate systems?',
      'Compare mitosis and meiosis in outcome and purpose.',
      'Why does increasing surface area speed up chemical reactions?',
      'Explain conservation of momentum in collisions.',
      'What factors control rate of photosynthesis?',
      'How does plate tectonics drive earthquakes?',
      'Why are feedback loops critical in ecosystems?'
    ),
    ('English', 'easy',
      'Choose the correct past tense of "run".',
      'Which word is a noun in: "The cat sleeps"?',
      'Select the correct synonym for "happy".',
      'Identify the adjective in: "A bright star".',
      'Choose the correct punctuation for this sentence ending.',
      'Which word is a pronoun?',
      'Select the antonym of "ancient".',
      'Choose the correct spelling.',
      'Identify the verb in: "Birds fly".',
      'What is the plural of "child"?'
    ),
    ('English', 'medium',
      'Choose the sentence with correct subject-verb agreement.',
      'What is the main idea of a paragraph?',
      'Identify the metaphor in the sentence options.',
      'Choose the best transition word to show contrast.',
      'Which sentence is in passive voice?',
      'Pick the correctly punctuated direct speech sentence.',
      'What is the purpose of a thesis statement?',
      'Select the word with the correct prefix meaning.',
      'Which revision best improves clarity?',
      'Identify the tone of a formal email excerpt.'
    ),
    ('English', 'hard',
      'Which literary device is used in "The wind whispered"?',
      'Choose the strongest evidence sentence to support a claim.',
      'Identify the dependent clause in the options.',
      'Which sentence correctly uses a semicolon?',
      'Determine the narrator point of view from the excerpt.',
      'Choose the best paraphrase while preserving meaning.',
      'Which sentence demonstrates parallel structure?',
      'Identify the connotation of the highlighted word.',
      'Choose the strongest concluding sentence for an argument.',
      'Which edit fixes dangling modifier error?'
    ),
    ('English', 'extreme',
      'Evaluate the rhetorical strategy used in the argument excerpt.',
      'Which revision best improves coherence across paragraphs?',
      'Identify the fallacy in the claim and reason.',
      'Choose the sentence that uses subjunctive mood correctly.',
      'What is the strongest counterclaim to the argument?',
      'Which citation format is correct in academic style?',
      'Select the best synthesis sentence from two sources.',
      'Which word choice most precisely matches formal register?',
      'Identify how diction shifts tone in the passage.',
      'Choose the strongest thesis with scope and arguability.'
    )
  ) AS t(subject, difficulty, q1,q2,q3,q4,q5,q6,q7,q8,q9,q10)
)
INSERT INTO public.questions (
  quiz_id,
  question_text,
  question_type,
  options,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  explanation,
  points,
  order_index,
  difficulty,
  grade,
  subject
)
SELECT
  qz.id,
  CASE qz.subject
    WHEN 'Math' THEN format(
      (ARRAY[t.q1,t.q2,t.q3,t.q4,t.q5,t.q6,t.q7,t.q8,t.q9,t.q10])[gs],
      2 + gs, 3 + gs, 2 + gs, 4 + gs, 150 + gs,
      3 + gs, 1 + gs, 2 + gs, 5 + gs, 3 + gs, 8 + gs, 25 + gs,
      4 + gs, 2 + gs, 1 + gs, 4 + gs, 10 + gs, 15 + gs, 6 + gs, 9 + gs,
      7 + gs, 8 + gs, 9 + gs, 10 + gs, 5 + gs, 3 + gs, 4 + gs, 2 + gs,
      5 + gs, 1 + gs, 2 + gs, 3 + gs, 8 + gs, 32
    )
    ELSE (ARRAY[t.q1,t.q2,t.q3,t.q4,t.q5,t.q6,t.q7,t.q8,t.q9,t.q10])[gs]
  END,
  'multiple_choice',
  to_jsonb(ARRAY[
    CASE qz.subject WHEN 'Math' THEN 'Option A' ELSE 'Option A' END,
    'Option B',
    'Option C',
    'Option D'
  ]),
  'Option A',
  'Option B',
  'Option C',
  'Option D',
  'Option A',
  'Review the core concept for this question and verify units/grammar before answering.',
  CASE qz.difficulty WHEN 'easy' THEN 5 WHEN 'medium' THEN 10 WHEN 'hard' THEN 15 ELSE 20 END,
  gs,
  qz.difficulty,
  qz.grade,
  qz.subject
FROM structured_quizzes qz
JOIN question_templates t
  ON t.subject = qz.subject
 AND t.difficulty = qz.difficulty
CROSS JOIN generate_series(1, 10) gs;

-- 4) Adaptive quiz fetching by student level bands.
CREATE OR REPLACE FUNCTION public.get_adaptive_quiz(
  p_grade text,
  p_subject text,
  p_level integer
)
RETURNS TABLE (
  quiz_id uuid,
  title text,
  grade text,
  subject text,
  difficulty text,
  level_min integer,
  level_max integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT CASE
      WHEN p_level BETWEEN 1 AND 5 THEN 'easy'
      WHEN p_level BETWEEN 6 AND 10 THEN 'medium'
      WHEN p_level BETWEEN 11 AND 20 THEN 'hard'
      ELSE 'extreme'
    END AS wanted_difficulty
  )
  SELECT q.id, q.title, q.grade, q.subject, q.difficulty, q.level_min, q.level_max
  FROM public.quizzes q, target t
  WHERE q.is_approved = true
    AND lower(q.grade) = lower(p_grade)
    AND lower(q.subject) = lower(p_subject)
    AND lower(q.difficulty) = t.wanted_difficulty
  ORDER BY q.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_adaptive_quiz(text, text, integer) TO authenticated;

-- 5) Secure server-side quiz submission with validation and duplicate prevention.
CREATE OR REPLACE FUNCTION public.submit_quiz_result_secure(
  p_quiz_id uuid,
  p_answers jsonb,
  p_time_taken integer,
  p_submission_id uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quiz public.quizzes%ROWTYPE;
  v_total integer;
  v_correct integer := 0;
  v_score integer := 0;
  v_xp integer := 0;
  v_question record;
  v_selected text;
  v_correct_bool boolean;
  v_difficulty text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'Answers payload must be a JSON object';
  END IF;

  IF EXISTS (SELECT 1 FROM public.quiz_results WHERE submission_id = p_submission_id) THEN
    RAISE EXCEPTION 'Duplicate submission';
  END IF;

  SELECT * INTO v_quiz
  FROM public.quizzes
  WHERE id = p_quiz_id
    AND is_approved = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No quiz available';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.questions
  WHERE quiz_id = p_quiz_id;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'No questions available';
  END IF;

  FOR v_question IN
    SELECT id, correct_answer, coalesce(difficulty, v_quiz.difficulty) AS difficulty, points
    FROM public.questions
    WHERE quiz_id = p_quiz_id
    ORDER BY order_index, created_at
  LOOP
    v_selected := p_answers ->> (v_question.id::text);
    v_correct_bool := v_selected IS NOT NULL AND v_selected = v_question.correct_answer;

    IF v_correct_bool THEN
      v_correct := v_correct + 1;
      v_score := v_score + COALESCE(v_question.points, 10);
      CASE lower(v_question.difficulty)
        WHEN 'easy' THEN v_xp := v_xp + 2;
        WHEN 'medium' THEN v_xp := v_xp + 4;
        WHEN 'hard' THEN v_xp := v_xp + 6;
        ELSE v_xp := v_xp + 8;
      END CASE;
    ELSE
      CASE lower(v_question.difficulty)
        WHEN 'hard' THEN v_xp := v_xp - 2;
        WHEN 'extreme' THEN v_xp := v_xp - 3;
        ELSE v_xp := v_xp;
      END CASE;
    END IF;

    INSERT INTO public.question_attempts (
      user_id,
      question_id,
      quiz_id,
      selected_answer,
      is_correct,
      time_taken_seconds,
      attempt_number
    ) VALUES (
      v_user_id,
      v_question.id,
      p_quiz_id,
      COALESCE(v_selected, 'no_answer'),
      v_correct_bool,
      GREATEST(1, p_time_taken / GREATEST(v_total, 1)),
      1
    );
  END LOOP;

  INSERT INTO public.quiz_results (
    quiz_id,
    student_id,
    score,
    total_questions,
    correct_answers,
    time_taken,
    xp_earned,
    answers,
    submission_id
  ) VALUES (
    p_quiz_id,
    v_user_id,
    v_score,
    v_total,
    v_correct,
    p_time_taken,
    v_xp,
    p_answers,
    p_submission_id
  );

  RETURN jsonb_build_object(
    'quiz_id', p_quiz_id,
    'score', v_score,
    'total_questions', v_total,
    'correct_answers', v_correct,
    'xp_earned', v_xp,
    'difficulty', v_quiz.difficulty
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_result_secure(uuid, jsonb, integer, uuid) TO authenticated;
