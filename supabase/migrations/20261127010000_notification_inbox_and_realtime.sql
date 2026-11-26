-- Restore authenticated access to each user's own notification inbox.
-- The existing RLS policies remain the authorization boundary; column grants
-- restrict clients to changing only read/archive state.
ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.notification_events TO authenticated;
GRANT UPDATE (read_at, archived_at) ON TABLE public.notification_events TO authenticated;

DROP POLICY IF EXISTS "Users read own notification events" ON public.notification_events;
CREATE POLICY "Users read own notification events"
  ON public.notification_events
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own notification events" ON public.notification_events;
CREATE POLICY "Users update own notification events"
  ON public.notification_events
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS notification_events_unarchived_user_created_idx
  ON public.notification_events (user_id, created_at DESC)
  WHERE archived_at IS NULL;

-- The existing in-app alert listeners depend on postgres_changes. These tables
-- were not in the production Realtime publication, so friend/message/group
-- alerts silently failed while the app was open.
DO $migration$
DECLARE
  v_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH v_table IN ARRAY ARRAY['friends', 'messages', 'group_messages', 'notification_events']
    LOOP
      IF to_regclass('public.' || v_table) IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
            AND schemaname = 'public'
            AND tablename = v_table
        )
      THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
      END IF;
    END LOOP;
  END IF;
END;
$migration$;
