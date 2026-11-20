BEGIN;
SELECT plan(15);

SELECT ok(
  has_function_privilege('authenticated', 'public.get_daily_challenge_question()', 'EXECUTE'),
  'authenticated students can load the server-selected daily challenge'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.get_daily_challenge_question()', 'EXECUTE'),
  'anonymous users cannot load daily challenges'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.submit_daily_challenge_answer(uuid,text)', 'EXECUTE'),
  'authenticated students can submit daily challenge answers'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.submit_daily_challenge_answer(uuid,text)', 'EXECUTE'),
  'anonymous users cannot submit daily challenge answers'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.daily_challenge_attempts', 'SELECT'),
  'daily challenge attempts are not directly readable by clients'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.daily_challenge_attempts', 'INSERT'),
  'daily challenge attempts cannot be forged by clients'
);
SELECT ok(
  (SELECT count(*) >= 3 FROM public.daily_missions WHERE is_active IS TRUE),
  'active daily mission definitions exist for assignment'
);
SELECT ok(
  EXISTS (SELECT 1 FROM public.daily_missions WHERE is_active IS TRUE AND mission_type = 'quiz')
  AND EXISTS (SELECT 1 FROM public.daily_missions WHERE is_active IS TRUE AND mission_type = 'perfect_score'),
  'mission definitions match the server-side quiz progress trigger'
);
SELECT ok(
  to_regclass('public.user_missions_user_mission_date_uidx') IS NOT NULL,
  'a student cannot receive the same mission assignment twice on one day'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.wallet_action(text,integer,uuid)', 'EXECUTE'),
  'authenticated students can use guarded wallet actions'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.user_currency', 'UPDATE'),
  'students cannot directly edit wallet balances'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.submit_early_quiz_answer(uuid,text,text)', 'EXECUTE'),
  'early quiz answers still use the verified answer RPC'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.early_activity_attempts', 'INSERT'),
  'students cannot forge early quiz attempt history'
);

SELECT like(
  has_column('public', 'user_streaks', 'last_daily_reward_date'),
  'ok%',
  'daily reward claims use a separate date from normal learning activity'
);
SELECT like(
  pg_get_functiondef('public.wallet_action(text,integer,uuid)'::regprocedure),
  '%INSERT INTO public.transactions%',
  'wallet actions write to the existing transaction history'
);

SELECT * FROM finish();
ROLLBACK;
