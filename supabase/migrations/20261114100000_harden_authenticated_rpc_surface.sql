-- Restrict authenticated-only SECURITY DEFINER RPCs from anonymous callers.
-- Every function below either mutates the caller's own data or is guarded
-- by the authenticated user's role. Public discovery/login/leaderboard
-- endpoints are intentionally left unchanged for compatibility.

revoke all on function public.disable_notification_device(text) from public, anon;
grant execute on function public.disable_notification_device(text) to authenticated;

revoke all on function public.get_early_profile_summary(uuid) from public, anon;
grant execute on function public.get_early_profile_summary(uuid) to authenticated;

revoke all on function public.get_student_leaderboard() from public, anon;
grant execute on function public.get_student_leaderboard() to authenticated;

revoke all on function public.is_student_in_class(uuid, uuid) from public, anon;
grant execute on function public.is_student_in_class(uuid, uuid) to authenticated;

revoke all on function public.is_teacher_of_class(uuid, uuid) from public, anon;
grant execute on function public.is_teacher_of_class(uuid, uuid) to authenticated;

revoke all on function public.is_teacher_of_student(uuid, uuid) from public, anon;
grant execute on function public.is_teacher_of_student(uuid, uuid) to authenticated;

revoke all on function public.manager_get_dashboard() from public, anon;
grant execute on function public.manager_get_dashboard() to authenticated;

revoke all on function public.manager_list_users(text, public.app_role, integer, integer) from public, anon;
grant execute on function public.manager_list_users(text, public.app_role, integer, integer) to authenticated;

revoke all on function public.mark_direct_message_read(uuid) from public, anon;
grant execute on function public.mark_direct_message_read(uuid) to authenticated;

revoke all on function public.purchase_early_item(uuid) from public, anon;
grant execute on function public.purchase_early_item(uuid) to authenticated;

revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

revoke all on function public.send_direct_message(uuid, text) from public, anon;
grant execute on function public.send_direct_message(uuid, text) to authenticated;

revoke all on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

revoke all on function public.upsert_notification_device(text, text, text, boolean) from public, anon;
grant execute on function public.upsert_notification_device(text, text, text, boolean) to authenticated;

-- These functions reference all non-system objects with explicit schemas.
-- A pg_catalog-only search path prevents public-schema object shadowing.
alter function public.disable_notification_device(text) set search_path = pg_catalog;
alter function public.get_early_profile_summary(uuid) set search_path = pg_catalog;
alter function public.get_student_leaderboard() set search_path = pg_catalog;
alter function public.is_student_in_class(uuid, uuid) set search_path = pg_catalog;
alter function public.is_teacher_of_class(uuid, uuid) set search_path = pg_catalog;
alter function public.is_teacher_of_student(uuid, uuid) set search_path = pg_catalog;
alter function public.manager_get_dashboard() set search_path = pg_catalog;
alter function public.manager_list_users(text, public.app_role, integer, integer) set search_path = pg_catalog;
alter function public.mark_direct_message_read(uuid) set search_path = pg_catalog;
alter function public.purchase_early_item(uuid) set search_path = pg_catalog;
alter function public.remove_friend(uuid) set search_path = pg_catalog;
alter function public.respond_friend_request(uuid, boolean) set search_path = pg_catalog;
alter function public.send_direct_message(uuid, text) set search_path = pg_catalog;
alter function public.send_friend_request(uuid) set search_path = pg_catalog;
alter function public.upsert_notification_device(text, text, text, boolean) set search_path = pg_catalog;
