begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select ok(
  to_regclass('public.notification_preferences') is not null,
  'notification preferences table exists'
);
select ok(
  (select count(*) = 4
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'notification_preferences'
     and column_name in ('user_id', 'daily_reminders', 'quiet_start', 'reminder_hour')),
  'notification preferences has the client contract columns'
);
select ok(
  has_table_privilege('authenticated', 'public.notification_preferences', 'select')
  and has_table_privilege('authenticated', 'public.notification_preferences', 'insert')
  and has_table_privilege('authenticated', 'public.notification_preferences', 'update'),
  'authenticated users can persist their own notification preferences'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notification_preferences'
      and policyname = 'Users manage own notification preferences'
  ),
  'notification preferences are protected by the own-user policy'
);
select ok(not has_table_privilege('anon', 'public.notification_preferences', 'select'), 'anonymous users cannot read notification preferences');
select ok(has_function_privilege('authenticated', 'public.get_student_leaderboard()', 'execute'), 'authenticated users can call the leaderboard RPC');
select ok(not has_function_privilege('anon', 'public.get_student_leaderboard()', 'execute'), 'anonymous users cannot call the leaderboard RPC');
select ok(has_function_privilege('authenticated', 'public.upsert_notification_device(text,text,text,boolean)', 'execute'), 'authenticated users can register devices');
select ok(has_function_privilege('authenticated', 'public.disable_notification_device(text)', 'execute'), 'authenticated users can disable devices');
select ok((select p.proconfig @> array['search_path=pg_catalog'] from pg_proc p where p.oid = 'public.get_student_leaderboard()'::regprocedure), 'leaderboard RPC keeps its hardened search path');

select * from finish();
rollback;
