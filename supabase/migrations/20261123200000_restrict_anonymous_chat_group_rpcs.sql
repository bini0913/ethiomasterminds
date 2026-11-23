-- Chat-group mutation RPCs must never be callable by anonymous clients.
-- Authenticated RPCs retain their guarded application contract. The multiplayer
-- cleanup trigger wrapper is trigger-only and must not be exposed as an RPC.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.add_chat_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_chat_group_member(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_chat_group(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_chat_group(text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.join_chat_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_chat_group(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.leave_chat_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_chat_group(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.send_group_message(uuid, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_group_message(uuid, text, text, uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_multiplayer_rooms_trigger() FROM PUBLIC, anon, authenticated;

COMMIT;
