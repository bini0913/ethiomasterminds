BEGIN;
SELECT plan(11);

SELECT ok(
  has_function_privilege('authenticated', 'public.submit_early_quiz_answer(uuid,text,text)', 'EXECUTE'),
  'authenticated students can submit answers to the verified quiz RPC'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.submit_early_quiz_answer(uuid,text,text)', 'EXECUTE'),
  'anonymous users cannot submit early quiz answers'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.complete_early_activity(uuid,text,text,boolean,boolean)', 'EXECUTE'),
  'legacy client-reported correctness RPC is no longer callable'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.claim_early_achievement(text)', 'EXECUTE'),
  'students can claim achievements through verified progress'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.early_quiz_questions', 'SELECT'),
  'answer keys are not readable through the client Data API'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.early_activity_attempts', 'INSERT'),
  'students cannot forge early activity attempts'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.early_activity_attempts', 'UPDATE'),
  'students cannot alter early activity attempts'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.early_activity_progress', 'UPDATE'),
  'students cannot forge early progress'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.early_user_achievements', 'INSERT'),
  'students cannot self-create early achievement claims'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.early_user_achievements', 'UPDATE'),
  'students cannot modify early achievement claims'
);
SELECT is(
  (SELECT count(*)::integer FROM public.early_quiz_questions WHERE active = true),
  54,
  'all 54 fixed early quiz questions have server-side answer keys'
);

SELECT * FROM finish();
ROLLBACK;
