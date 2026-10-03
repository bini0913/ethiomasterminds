-- Super Admin completion and privilege hardening.
-- Privileged control RPCs must never be callable by anonymous API clients.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'extreme_admin_%'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', fn.proname, fn.args);
  END LOOP;
END $$;

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'finance_%'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', fn.proname, fn.args);
  END LOOP;
END $$;

-- The trigger only touches NEW and now(); pin its search path as well.
ALTER FUNCTION public.finance_set_updated_at()
  SET search_path = '';

CREATE OR REPLACE FUNCTION public.extreme_admin_get_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Super Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'students', (SELECT count(*) FROM public.user_roles WHERE role='student'),
    'teachers', (SELECT count(*) FROM public.user_roles WHERE role='teacher'),
    'managers', (SELECT count(*) FROM public.user_roles WHERE role='manager'),
    'admins', (SELECT count(*) FROM public.user_roles WHERE role='admin'),
    'finance', (SELECT count(*) FROM public.user_roles WHERE role='finance'),
    'super_admins', (SELECT count(*) FROM public.user_roles WHERE role='extreme_admin'),
    'messages', (SELECT count(*) FROM public.messages),
    'group_messages', (SELECT count(*) FROM public.group_messages),
    'room_messages', (SELECT count(*) FROM public.room_chat_messages),
    'lobby_messages', (SELECT count(*) FROM public.lobby_messages),
    'ai_conversations', (SELECT count(*) FROM public.ai_tutor_conversations),
    'reports', (SELECT count(*) FROM public.reports),
    'pending_reports', (SELECT count(*) FROM public.reports WHERE status='pending'),
    'posts', (SELECT count(*) FROM public.social_posts),
    'books', (SELECT count(*) FROM public.library_books),
    'active_users_10m', (SELECT count(*) FROM public.user_presence WHERE last_seen>now()-interval '10 minutes')
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.extreme_admin_get_system_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Super Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'admins', (SELECT count(*) FROM public.user_roles WHERE role='admin'),
    'managers', (SELECT count(*) FROM public.user_roles WHERE role='manager'),
    'teachers', (SELECT count(*) FROM public.user_roles WHERE role='teacher'),
    'students', (SELECT count(*) FROM public.user_roles WHERE role='student'),
    'finance', (SELECT count(*) FROM public.user_roles WHERE role='finance'),
    'super_admins', (SELECT count(*) FROM public.user_roles WHERE role='extreme_admin'),
    'reports', (SELECT count(*) FROM public.reports),
    'pending_reports', (SELECT count(*) FROM public.reports WHERE status='pending'),
    'posts', (SELECT count(*) FROM public.social_posts),
    'books', (SELECT count(*) FROM public.library_books),
    'messages', (SELECT count(*) FROM public.messages),
    'ai_conversations', (SELECT count(*) FROM public.ai_tutor_conversations)
  );
END
$function$;

REVOKE EXECUTE ON FUNCTION public.extreme_admin_get_dashboard() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.extreme_admin_get_system_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_system_overview() TO authenticated;
