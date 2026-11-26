BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(20);

SELECT has_column('public', 'notification_events', 'read_at', 'notification events have persistent read state');
SELECT has_column('public', 'notification_events', 'archived_at', 'notification events have persistent archive state');
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notification_events'::regclass),
  'notification events keep row-level security enabled'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.notification_events', 'SELECT'),
  'authenticated users can select notification events subject to RLS'
);
SELECT ok(
  has_column_privilege('authenticated', 'public.notification_events', 'read_at', 'UPDATE'),
  'authenticated users can update only the read cursor column'
);
SELECT ok(
  has_column_privilege('authenticated', 'public.notification_events', 'archived_at', 'UPDATE'),
  'authenticated users can update only the archive cursor column'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.notification_events', 'INSERT'),
  'authenticated clients cannot create notification events'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.notification_events', 'DELETE'),
  'authenticated clients cannot hard-delete notification history'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.notification_events', 'SELECT'),
  'anonymous users cannot read notification events'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_events' AND cmd = 'SELECT' AND roles @> ARRAY['authenticated']::name[] AND qual ILIKE '%auth.uid%'),
  'notification inbox reads remain owner-scoped'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_events' AND cmd = 'UPDATE' AND roles @> ARRAY['authenticated']::name[] AND qual ILIKE '%auth.uid%' AND with_check ILIKE '%auth.uid%'),
  'notification read/archive updates remain owner-scoped'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friends'),
  'friend request events are available to Realtime'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'),
  'direct message events are available to Realtime'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'group_messages'),
  'group message events are available to Realtime'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notification_events'),
  'notification inbox updates are available to Realtime'
);

SELECT has_column('public', 'chat_group_members', 'last_read_at', 'group members persist their last-read cursor');
SELECT ok(
  has_column_privilege('authenticated', 'public.chat_group_members', 'last_read_at', 'UPDATE'),
  'members can update only their own group read cursor'
);
SELECT ok(
  to_regprocedure('public.get_my_group_unread_counts()') IS NOT NULL,
  'group unread count RPC exists'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_my_group_unread_counts()', 'execute')
    AND NOT has_function_privilege('anon', 'public.get_my_group_unread_counts()', 'execute'),
  'group unread count RPC is authenticated-only'
);

SELECT ok(
  (SELECT NOT prosecdef FROM pg_proc WHERE oid = 'public.get_my_group_unread_counts()'::regprocedure),
  'group unread count RPC runs with caller privileges'
);

SELECT * FROM finish();
ROLLBACK;
