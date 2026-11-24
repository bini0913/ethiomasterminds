-- Match cleanup is privileged global maintenance. It must not be callable
-- directly by ordinary signed-in users; trusted service processing retains access.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_multiplayer_rooms() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_multiplayer_rooms() TO service_role;

COMMIT;
