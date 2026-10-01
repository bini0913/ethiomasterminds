-- Apply to production Supabase project mytbjkchvfybhyqcynnl (SQL editor or controlled migration).
-- Fix: "permission denied for function has_role" during profile/RLS bootstrap.
-- RLS policy expressions run as the CALLING role (anon/authenticated). Migration
-- 20260928140000_production_security_reconciliation.sql revoked EXECUTE on helpers
-- that policies call, so profile reads error out even for a user's own row.
-- Helpers are SECURITY DEFINER, STABLE, return only booleans: no data exposure.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
DO $$
BEGIN
  IF to_regprocedure('public.is_teacher_of_student(uuid, uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.is_teacher_of_student(uuid, uuid) TO authenticated, anon; END IF;
  IF to_regprocedure('public.is_teacher_of_class(uuid, uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid, uuid) TO authenticated, anon; END IF;
  IF to_regprocedure('public.is_student_in_class(uuid, uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.is_student_in_class(uuid, uuid) TO authenticated, anon; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

-- Verify:
SELECT p.proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
  FROM pg_proc p CROSS JOIN pg_roles r
 WHERE p.pronamespace = 'public'::regnamespace
   AND p.proname IN ('has_role','get_user_role','is_teacher_of_student','is_teacher_of_class','is_student_in_class')
   AND r.rolname IN ('anon','authenticated') ORDER BY 1,2;
