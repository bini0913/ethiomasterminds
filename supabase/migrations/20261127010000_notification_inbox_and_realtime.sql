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

-- Persist a per-member read cursor so group chat unread badges are real rather
-- than hard-coded to zero.
ALTER TABLE public.chat_group_members
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;
UPDATE public.chat_group_members
  SET last_read_at = joined_at
  WHERE last_read_at IS NULL;
ALTER TABLE public.chat_group_members
  ALTER COLUMN last_read_at SET DEFAULT now(),
  ALTER COLUMN last_read_at SET NOT NULL;

DROP POLICY IF EXISTS "Members update own group read cursor" ON public.chat_group_members;
CREATE POLICY "Members update own group read cursor"
  ON public.chat_group_members
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
GRANT UPDATE (last_read_at) ON TABLE public.chat_group_members TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_group_unread_counts()
RETURNS TABLE(group_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    membership.group_id,
    count(message.id)::bigint AS unread_count
  FROM public.chat_group_members AS membership
  LEFT JOIN public.group_messages AS message
    ON message.group_id = membership.group_id
   AND message.sender_id <> (SELECT auth.uid())
   AND message.created_at > membership.last_read_at
  WHERE membership.user_id = (SELECT auth.uid())
  GROUP BY membership.group_id;
$function$;

REVOKE ALL ON FUNCTION public.get_my_group_unread_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_group_unread_counts() TO authenticated;
