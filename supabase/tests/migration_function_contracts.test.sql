BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(11);

SELECT is(
  pg_get_function_result('public.purchase_store_item(uuid,boolean)'::regprocedure),
  'jsonb',
  'shop purchase RPC keeps its JSON result contract'
);
SELECT is(
  pg_get_function_result('public.equip_store_item(uuid)'::regprocedure),
  'jsonb',
  'shop equip RPC keeps its JSON result contract'
);
SELECT is(
  pg_get_function_result('public.update_user_streak(uuid)'::regprocedure),
  'jsonb',
  'streak RPC keeps its established JSON result contract'
);

SELECT ok(
  has_function_privilege('authenticated','public.purchase_store_item(uuid,boolean)','EXECUTE'),
  'authenticated users can purchase store items through the guarded RPC'
);
SELECT ok(
  NOT has_function_privilege('anon','public.purchase_store_item(uuid,boolean)','EXECUTE'),
  'anonymous users cannot purchase store items'
);
SELECT ok(
  has_function_privilege('authenticated','public.equip_store_item(uuid)','EXECUTE'),
  'authenticated users can equip owned store items through the guarded RPC'
);
SELECT ok(
  NOT has_function_privilege('anon','public.equip_store_item(uuid)','EXECUTE'),
  'anonymous users cannot equip store items'
);
SELECT ok(
  has_function_privilege('authenticated','public.update_user_streak(uuid)','EXECUTE'),
  'authenticated users can update their own streak through the guarded RPC'
);
SELECT ok(
  NOT has_function_privilege('anon','public.update_user_streak(uuid)','EXECUTE'),
  'anonymous users cannot update student streaks'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.quizzes'::regclass
      AND conname = 'quizzes_exam_type_check'
      AND pg_get_constraintdef(oid) LIKE '%entrance_practice%'
  ),
  'quizzes support the original entrance-practice category'
);

SELECT is(
  (SELECT pronargdefaults::integer FROM pg_proc
   WHERE oid = 'public.submit_quiz_result_secure(uuid,jsonb,integer,uuid)'::regprocedure),
  0,
  'quiz submission requires an explicit stable idempotency key'
);

SELECT * FROM finish();
ROLLBACK;
