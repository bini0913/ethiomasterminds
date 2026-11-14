-- These RPCs are used only by authenticated student routes and chat policy checks.
-- Remove the default PUBLIC/anon execution path while preserving signed-in and server access.

revoke all on function public.get_early_leaderboard(text, text, text) from public, anon;
revoke all on function public.get_public_leaderboard(integer) from public, anon;
revoke all on function public.is_chat_group_creator(uuid) from public, anon;
revoke all on function public.is_chat_group_member(uuid) from public, anon;

grant execute on function public.get_early_leaderboard(text, text, text) to authenticated, service_role;
grant execute on function public.get_public_leaderboard(integer) to authenticated, service_role;
grant execute on function public.is_chat_group_creator(uuid) to authenticated, service_role;
grant execute on function public.is_chat_group_member(uuid) to authenticated, service_role;
