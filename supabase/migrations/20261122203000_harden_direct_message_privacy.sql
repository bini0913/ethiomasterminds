-- Direct messages and friendship state are server-owned workflows.
-- Preserve authenticated reads and presence heartbeats while removing unused direct table writes.

revoke all on public.friends from anon;
revoke all on public.messages from anon;

revoke insert, update, delete on public.friends from authenticated;
revoke insert, update, delete on public.messages from authenticated;

-- Presence is intentionally writable by the authenticated user's own client heartbeat.
revoke all on public.user_presence from anon;
revoke delete on public.user_presence from authenticated;
grant select, insert, update on public.user_presence to authenticated;
