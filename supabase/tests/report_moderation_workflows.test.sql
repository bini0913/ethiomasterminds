begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.moderation_actions'::regclass),
  'moderation action audit table has row level security enabled'
);
select ok(has_table_privilege('authenticated', 'public.moderation_actions', 'select'), 'moderators can read moderation audit records');
select ok(not has_table_privilege('authenticated', 'public.moderation_actions', 'insert'), 'clients cannot create moderation audit records directly');
select ok(not has_table_privilege('anon', 'public.moderation_actions', 'select'), 'anonymous users cannot read moderation audit records');
select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='social_posts' and column_name='moderation_status'),
  'social posts have a moderation status'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='social_post_comments' and column_name='moderation_status'),
  'comments have a moderation status'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='messages' and column_name='moderation_status'),
  'direct messages have a moderation status'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='group_messages' and column_name='moderation_status'),
  'group messages have a moderation status'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='lobby_messages' and column_name='moderation_status'),
  'lobby messages have a moderation status'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='room_chat_messages' and column_name='moderation_status'),
  'room chat messages have a moderation status'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='reports' and column_name='moderation_action'),
  'reports store the moderation action'
);
select ok(has_function_privilege('authenticated', 'public.admin_list_reports(integer)', 'execute'), 'authenticated moderators can list reports');
select ok(not has_function_privilege('anon', 'public.admin_list_reports(integer)', 'execute'), 'anonymous users cannot list reports');
select ok(has_function_privilege('authenticated', 'public.moderate_report(uuid,text,text)', 'execute'), 'authenticated moderators can call guarded moderation actions');
select ok(not has_function_privilege('anon', 'public.moderate_report(uuid,text,text)', 'execute'), 'anonymous users cannot moderate reports');
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='social_posts' and policyname='users can view opted-in posts excluding blocked authors' and qual like '%moderation_status%'),
  'removed social posts are hidden by row-level security'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='social_post_comments' and policyname='users can view visible comments excluding blocked authors' and qual like '%moderation_status%'),
  'removed comments are hidden by row-level security'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='involved users can view unblocked messages' and qual like '%moderation_status%'),
  'removed direct messages are hidden by row-level security'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='group_messages' and policyname='members can view group messages excluding blocked senders' and qual like '%moderation_status%'),
  'removed group messages are hidden by row-level security'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='lobby_messages' and policyname='authenticated can view unblocked lobby messages' and qual like '%moderation_status%'),
  'removed lobby messages are hidden by row-level security'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='room_chat_messages' and policyname='room members can view unblocked room chat' and qual like '%moderation_status%'),
  'removed room messages are hidden by row-level security'
);
select ok(
  exists (select 1 from pg_policies where schemaname='public' and tablename='moderation_actions' and policyname='moderators can view moderation actions'),
  'moderation audit records are visible only through the moderator policy'
);

select * from finish();
rollback;
