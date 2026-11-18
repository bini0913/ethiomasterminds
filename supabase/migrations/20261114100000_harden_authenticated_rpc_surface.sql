-- Restrict authenticated-only SECURITY DEFINER RPCs from anonymous callers.
-- Every function below either mutates the caller's own data or is guarded
-- by the authenticated user's role. Public discovery/login/leaderboard
-- endpoints are intentionally left unchanged for compatibility.

-- Some RPCs exist only in deployed schemas that received out-of-band fixes.
-- Apply the same hardening whenever each exact signature exists, while keeping
-- a clean database reset independent of functions absent from migrations.
do $migration$
declare
  v_signature text;
  v_function regprocedure;
  v_signatures text[] := array[
    'public.disable_notification_device(text)',
    'public.get_early_profile_summary(uuid)',
    'public.get_student_leaderboard()',
    'public.is_student_in_class(uuid, uuid)',
    'public.is_teacher_of_class(uuid, uuid)',
    'public.is_teacher_of_student(uuid, uuid)',
    'public.manager_get_dashboard()',
    'public.manager_list_users(text, public.app_role, integer, integer)',
    'public.mark_direct_message_read(uuid)',
    'public.purchase_early_item(uuid)',
    'public.remove_friend(uuid)',
    'public.respond_friend_request(uuid, boolean)',
    'public.send_direct_message(uuid, text)',
    'public.send_friend_request(uuid)',
    'public.upsert_notification_device(text, text, text, boolean)'
  ];
begin
  foreach v_signature in array v_signatures loop
    v_function := to_regprocedure(v_signature);
    if v_function is not null then
      execute format('revoke all on function %s from public, anon', v_function);
      execute format('grant execute on function %s to authenticated', v_function);
      -- All listed functions use explicitly-qualified non-catalog objects.
      execute format('alter function %s set search_path = pg_catalog', v_function);
    end if;
  end loop;
end
$migration$;
