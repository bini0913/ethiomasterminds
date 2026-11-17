-- Remove inherited PUBLIC/anon execution from school RPC helpers and trigger
-- functions. Existing authenticated/service_role grants are preserved.
DO $block$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'school\_%' ESCAPE '\'
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
      v_function.proname,
      v_function.identity_args
    );
  END LOOP;

  -- Trigger functions are invoked by their triggers, not directly by clients.
  FOR v_function IN
    SELECT DISTINCT p.proname, pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_trigger t ON t.tgfoid = p.oid
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE 'school\_%' ESCAPE '\'
        OR p.proname LIKE 'notify_linked_parents_for\_%' ESCAPE '\'
      )
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      v_function.proname,
      v_function.identity_args
    );
  END LOOP;
END;
$block$;

-- These functions are intended for signed-in portal workflows only.
REVOKE ALL ON FUNCTION public.is_active_school_member(uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_school_manager(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_school_manager_or_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_school_member(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_manager_or_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.school_next_student_number(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_deactivate_student_membership(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_next_student_number(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_deactivate_student_membership(uuid, text, text) TO authenticated;

-- Legacy cross-portal functions and the older teacher assignment helper are
-- authenticated RPCs; their notification helpers are trigger-only.
REVOKE ALL ON FUNCTION public.can_teacher_view_quiz_result(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_teacher_assignment(uuid, uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_finance_oversight_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_parent_portal_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_teacher_view_quiz_result(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_teacher_assignment(uuid, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_oversight_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_portal_overview() TO authenticated;

REVOKE ALL ON FUNCTION public.notify_linked_parents_for_announcement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_linked_parents_for_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_linked_parents_for_invoice() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_linked_parents_for_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_linked_parents_for_quiz_result() FROM PUBLIC, anon, authenticated;
