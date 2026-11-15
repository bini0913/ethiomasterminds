-- Grades 9–12 home dashboard: authoritative topic coverage, daily practice,
-- and a one-time exam target. All progress rows are written inside the
-- trusted quiz-result transaction, never by the browser.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS topic text;

CREATE TABLE IF NOT EXISTS public.upper_student_topic_progress (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  topic text NOT NULL,
  questions_attempted integer NOT NULL DEFAULT 0 CHECK (questions_attempted >= 0),
  correct_answers integer NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  accuracy_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (accuracy_percentage BETWEEN 0 AND 100),
  last_practiced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subject, topic),
  CHECK (correct_answers <= questions_attempted)
);

CREATE INDEX IF NOT EXISTS upper_student_topic_progress_recent_idx
  ON public.upper_student_topic_progress(user_id, last_practiced_at DESC);

ALTER TABLE public.upper_student_topic_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS upper_student_topic_progress_select_own
  ON public.upper_student_topic_progress;
CREATE POLICY upper_student_topic_progress_select_own
  ON public.upper_student_topic_progress
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.upper_student_topic_progress FROM anon, authenticated;
GRANT SELECT ON public.upper_student_topic_progress TO authenticated;

CREATE TABLE IF NOT EXISTS public.upper_student_daily_activity (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  quiz_count integer NOT NULL DEFAULT 0 CHECK (quiz_count >= 0),
  question_count integer NOT NULL DEFAULT 0 CHECK (question_count >= 0),
  correct_count integer NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  xp_earned integer NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_date),
  CHECK (correct_count <= question_count)
);

CREATE INDEX IF NOT EXISTS upper_student_daily_activity_recent_idx
  ON public.upper_student_daily_activity(user_id, activity_date DESC);

ALTER TABLE public.upper_student_daily_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS upper_student_daily_activity_select_own
  ON public.upper_student_daily_activity;
CREATE POLICY upper_student_daily_activity_select_own
  ON public.upper_student_daily_activity
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.upper_student_daily_activity FROM anon, authenticated;
GRANT SELECT ON public.upper_student_daily_activity TO authenticated;

-- An exam target is deliberately immutable after the first successful save.
CREATE TABLE IF NOT EXISTS public.student_exam_targets (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  exam_name text NOT NULL CHECK (char_length(trim(exam_name)) BETWEEN 2 AND 100),
  exam_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (exam_date >= (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date)
);

ALTER TABLE public.student_exam_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_exam_targets_select_own ON public.student_exam_targets;
CREATE POLICY student_exam_targets_select_own
  ON public.student_exam_targets
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.student_exam_targets FROM anon, authenticated;
GRANT SELECT ON public.student_exam_targets TO authenticated;

CREATE OR REPLACE FUNCTION public.set_upper_student_exam_target_once(
  p_exam_date date,
  p_exam_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_grade text;
  v_saved public.student_exam_targets%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT grade INTO v_grade
  FROM public.profiles
  WHERE id = v_user_id
  FOR SHARE;

  IF public.get_user_role(v_user_id) <> 'student'
     OR v_grade IS NULL
     OR substring(lower(trim(v_grade)) from '[0-9]+') IS NULL
     OR substring(lower(trim(v_grade)) from '[0-9]+')::integer NOT BETWEEN 9 AND 12 THEN
    RAISE EXCEPTION 'This exam target is available to Grades 9–12 students';
  END IF;

  IF p_exam_date IS NULL
     OR p_exam_date < (now() AT TIME ZONE 'Africa/Addis_Ababa')::date THEN
    RAISE EXCEPTION 'Choose today or a future exam date';
  END IF;

  IF p_exam_name IS NULL OR char_length(trim(p_exam_name)) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Enter an exam name between 2 and 100 characters';
  END IF;

  INSERT INTO public.student_exam_targets(user_id, exam_name, exam_date)
  VALUES (v_user_id, trim(p_exam_name), p_exam_date)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO v_saved;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Your exam date has already been set and cannot be changed';
  END IF;

  RETURN jsonb_build_object(
    'saved', true,
    'exam_name', v_saved.exam_name,
    'exam_date', v_saved.exam_date,
    'created_at', v_saved.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_upper_student_exam_target_once(date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_upper_student_exam_target_once(date, text) TO authenticated;

-- Derive progress from the actual answer payload and trusted question keys.
-- This trigger executes in the same transaction as submit_quiz_result_secure.
CREATE OR REPLACE FUNCTION public.record_upper_student_quiz_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject text;
  v_grade text;
  v_activity_date date;
BEGIN
  SELECT grade INTO v_grade
  FROM public.profiles
  WHERE id = NEW.student_id;

  IF public.get_user_role(NEW.student_id) <> 'student'
     OR substring(lower(trim(COALESCE(v_grade, ''))) from '[0-9]+') IS NULL
     OR substring(lower(trim(v_grade)) from '[0-9]+')::integer NOT BETWEEN 9 AND 12 THEN
    RETURN NEW;
  END IF;

  SELECT subject INTO v_subject
  FROM public.quizzes
  WHERE id = NEW.quiz_id;

  IF v_subject IS NULL THEN
    RETURN NEW;
  END IF;

  v_activity_date := (COALESCE(NEW.completed_at, now()) AT TIME ZONE 'Africa/Addis_Ababa')::date;

  WITH answered_questions AS (
    SELECT
      COALESCE(NULLIF(trim(q.topic), ''), 'General') AS topic,
      (answers.value = q.correct_answer) AS is_correct
    FROM jsonb_each_text(COALESCE(NEW.answers, '{}'::jsonb)) AS answers(key, value)
    JOIN public.questions q
      ON q.id::text = answers.key
     AND q.quiz_id = NEW.quiz_id
  ),
  topic_totals AS (
    SELECT
      topic,
      count(*)::integer AS attempted,
      count(*) FILTER (WHERE is_correct)::integer AS correct
    FROM answered_questions
    GROUP BY topic
  )
  INSERT INTO public.upper_student_topic_progress (
    user_id, subject, topic, questions_attempted, correct_answers,
    accuracy_percentage, last_practiced_at
  )
  SELECT
    NEW.student_id,
    v_subject,
    topic,
    attempted,
    correct,
    CASE WHEN attempted = 0 THEN 0
         ELSE round((correct::numeric / attempted::numeric) * 100, 2)
    END,
    COALESCE(NEW.completed_at, now())
  FROM topic_totals
  ON CONFLICT (user_id, subject, topic) DO UPDATE
  SET questions_attempted = public.upper_student_topic_progress.questions_attempted + EXCLUDED.questions_attempted,
      correct_answers = public.upper_student_topic_progress.correct_answers + EXCLUDED.correct_answers,
      accuracy_percentage = CASE
        WHEN public.upper_student_topic_progress.questions_attempted + EXCLUDED.questions_attempted = 0 THEN 0
        ELSE round(
          (
            public.upper_student_topic_progress.correct_answers + EXCLUDED.correct_answers
          )::numeric
          /
          (
            public.upper_student_topic_progress.questions_attempted + EXCLUDED.questions_attempted
          )::numeric * 100,
          2
        )
      END,
      last_practiced_at = GREATEST(
        public.upper_student_topic_progress.last_practiced_at,
        EXCLUDED.last_practiced_at
      );

  INSERT INTO public.upper_student_daily_activity (
    user_id, activity_date, quiz_count, question_count,
    correct_count, xp_earned, last_activity_at
  )
  VALUES (
    NEW.student_id,
    v_activity_date,
    1,
    GREATEST(COALESCE(NEW.total_questions, 0), 0),
    GREATEST(COALESCE(NEW.correct_answers, 0), 0),
    GREATEST(COALESCE(NEW.xp_earned, 0), 0),
    COALESCE(NEW.completed_at, now())
  )
  ON CONFLICT (user_id, activity_date) DO UPDATE
  SET quiz_count = public.upper_student_daily_activity.quiz_count + 1,
      question_count = public.upper_student_daily_activity.question_count + EXCLUDED.question_count,
      correct_count = public.upper_student_daily_activity.correct_count + EXCLUDED.correct_count,
      xp_earned = public.upper_student_daily_activity.xp_earned + EXCLUDED.xp_earned,
      last_activity_at = GREATEST(
        public.upper_student_daily_activity.last_activity_at,
        EXCLUDED.last_activity_at
      );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_upper_student_quiz_activity
  ON public.quiz_results;
CREATE TRIGGER record_upper_student_quiz_activity
AFTER INSERT ON public.quiz_results
FOR EACH ROW
EXECUTE FUNCTION public.record_upper_student_quiz_activity();


-- Backfill historical upper-tier quiz activity so existing students do not
-- start with an empty dashboard after the migration is installed.
INSERT INTO public.upper_student_topic_progress (
  user_id, subject, topic, questions_attempted, correct_answers,
  accuracy_percentage, last_practiced_at
)
SELECT
  attempts.student_id,
  attempts.subject,
  attempts.topic,
  count(*)::integer,
  count(*) FILTER (WHERE attempts.is_correct)::integer,
  round(
    count(*) FILTER (WHERE attempts.is_correct)::numeric
    / greatest(count(*), 1)::numeric * 100,
    2
  ),
  max(attempts.completed_at)
FROM (
  SELECT
    qr.student_id,
    qu.subject,
    COALESCE(NULLIF(trim(q.topic), ''), 'General') AS topic,
    (answer.value = q.correct_answer) AS is_correct,
    COALESCE(qr.completed_at, now()) AS completed_at
  FROM public.quiz_results qr
  JOIN public.profiles p ON p.id = qr.student_id
  JOIN public.quizzes qu ON qu.id = qr.quiz_id
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(qr.answers) = 'object'
      THEN qr.answers ELSE '{}'::jsonb END
  ) AS answer(key, value)
  JOIN public.questions q
    ON q.id::text = answer.key
   AND q.quiz_id = qr.quiz_id
  WHERE substring(lower(trim(COALESCE(p.grade, ''))) from '[0-9]+') IS NOT NULL
    AND substring(lower(trim(p.grade)) from '[0-9]+')::integer BETWEEN 9 AND 12
) AS attempts
GROUP BY attempts.student_id, attempts.subject, attempts.topic
ON CONFLICT (user_id, subject, topic) DO NOTHING;

INSERT INTO public.upper_student_daily_activity (
  user_id, activity_date, quiz_count, question_count,
  correct_count, xp_earned, last_activity_at
)
SELECT
  qr.student_id,
  (COALESCE(qr.completed_at, now()) AT TIME ZONE 'Africa/Addis_Ababa')::date,
  count(*)::integer,
  sum(GREATEST(COALESCE(qr.total_questions, 0), 0))::integer,
  sum(GREATEST(COALESCE(qr.correct_answers, 0), 0))::integer,
  sum(GREATEST(COALESCE(qr.xp_earned, 0), 0))::integer,
  max(COALESCE(qr.completed_at, now()))
FROM public.quiz_results qr
JOIN public.profiles p ON p.id = qr.student_id
WHERE substring(lower(trim(COALESCE(p.grade, ''))) from '[0-9]+') IS NOT NULL
  AND substring(lower(trim(p.grade)) from '[0-9]+')::integer BETWEEN 9 AND 12
GROUP BY qr.student_id, (COALESCE(qr.completed_at, now()) AT TIME ZONE 'Africa/Addis_Ababa')::date
ON CONFLICT (user_id, activity_date) DO NOTHING;

REVOKE ALL ON FUNCTION public.record_upper_student_quiz_activity() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'upper_student_topic_progress'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.upper_student_topic_progress;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'upper_student_daily_activity'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.upper_student_daily_activity;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'student_exam_targets'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.student_exam_targets;
    END IF;
  END IF;
END;
$$;
