BEGIN;
SELECT plan(16);

SELECT ok(
  has_function_privilege('authenticated', 'public.wallet_action(text,integer,uuid)', 'EXECUTE'),
  'authenticated users can call guarded wallet actions'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.wallet_action(text,integer,uuid)', 'EXECUTE'),
  'anonymous users cannot call wallet actions'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.initialize_user_currency()', 'EXECUTE'),
  'authenticated users can initialize their own wallet'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.initialize_user_currency()', 'EXECUTE'),
  'anonymous users cannot initialize wallets'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.sync_student_achievement_progress(text)', 'EXECUTE'),
  'authenticated users can sync evidence-based achievements'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.claim_daily_mission(uuid)', 'EXECUTE'),
  'authenticated users can claim their own completed missions'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.claim_daily_mission(uuid)', 'EXECUTE'),
  'anonymous users cannot claim missions'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.add_xp(uuid,integer)', 'EXECUTE'),
  'legacy arbitrary-user XP helper is not callable by students'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.user_currency', 'INSERT'),
  'students cannot insert wallet rows directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.user_currency', 'UPDATE'),
  'students cannot update wallet balances directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.user_currency', 'DELETE'),
  'students cannot delete wallet rows directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.user_inventory', 'INSERT'),
  'students cannot mint inventory rows directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.user_achievements', 'UPDATE'),
  'students cannot modify achievement claims directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.user_missions', 'UPDATE'),
  'students cannot modify mission progress or claims directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.early_user_collection', 'INSERT'),
  'students cannot mint collectibles directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.quiz_results', 'INSERT'),
  'quiz results must be created by the secure grading RPC'
);

SELECT * FROM finish();
ROLLBACK;
