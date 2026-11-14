BEGIN;
SELECT plan(8);

SELECT ok(
  to_regprocedure('public.submit_exam_result_secure(uuid,uuid[],jsonb,integer,uuid,text,text)') IS NOT NULL,
  'secure configurable exam submission function exists'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.submit_exam_result_secure(uuid,uuid[],jsonb,integer,uuid,text,text)', 'EXECUTE'),
  'authenticated students can submit configurable exam results'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.submit_exam_result_secure(uuid,uuid[],jsonb,integer,uuid,text,text)', 'EXECUTE'),
  'anonymous users cannot submit configurable exam results'
);
SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.submit_exam_result_secure(uuid,uuid[],jsonb,integer,uuid,text,text)')),
  'exam grading runs with a controlled security-definer function'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.quiz_results', 'INSERT'),
  'students cannot bypass server-side exam grading with direct inserts'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.quiz_results', 'UPDATE'),
  'students cannot rewrite stored exam scores or rewards'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.quiz_results', 'DELETE'),
  'students cannot delete stored exam submissions'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.claim_quiz_reward(uuid)', 'EXECUTE'),
  'anonymous users cannot claim exam rewards'
);

SELECT * FROM finish();
ROLLBACK;
