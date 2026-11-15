BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(13);

SELECT ok(
  to_regclass('public.upper_student_topic_progress') IS NOT NULL,
  'Grades 9–12 topic progress table exists'
);
SELECT ok(
  to_regclass('public.upper_student_daily_activity') IS NOT NULL,
  'Grades 9–12 daily activity table exists'
);
SELECT ok(
  to_regclass('public.student_exam_targets') IS NOT NULL,
  'One-time student exam target table exists'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'topic'
  ),
  'Question bank exposes topic metadata for aggregation'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.upper_student_topic_progress'::regclass),
  'Topic progress has row-level security enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.upper_student_daily_activity'::regclass),
  'Daily activity has row-level security enabled'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.upper_student_topic_progress', 'SELECT'),
  'Authenticated students can read topic progress'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.upper_student_topic_progress', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.upper_student_topic_progress', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.upper_student_topic_progress', 'DELETE'),
  'Students cannot write or alter topic progress'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.upper_student_daily_activity', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.upper_student_daily_activity', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.upper_student_daily_activity', 'UPDATE'),
  'Students can read but cannot forge daily activity'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.student_exam_targets', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.student_exam_targets', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.student_exam_targets', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.student_exam_targets', 'DELETE'),
  'Exam targets are readable but immutable through direct table access'
);
SELECT ok(
  to_regprocedure('public.set_upper_student_exam_target_once(date,text)') IS NOT NULL
  AND has_function_privilege('authenticated', 'public.set_upper_student_exam_target_once(date,text)', 'EXECUTE'),
  'Authenticated users can call the guarded one-time exam target RPC'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.quiz_results'::regclass
      AND tgname = 'record_upper_student_quiz_activity'
      AND NOT tgisinternal
  ),
  'Verified quiz submissions automatically update dashboard aggregates'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'upper_student_daily_activity'
  ),
  'Daily activity is published for realtime dashboard refresh'
);

SELECT * FROM finish();
ROLLBACK;
