-- The multiplayer client invokes this bounded maintenance RPC during lobby
-- refresh and every minute so stale matches can be finalized without a
-- browser remaining open in the room. Keep anonymous access revoked.
revoke all on function public.cleanup_expired_multiplayer_rooms() from public, anon;
grant execute on function public.cleanup_expired_multiplayer_rooms() to authenticated;
grant execute on function public.cleanup_expired_multiplayer_rooms() to service_role;
