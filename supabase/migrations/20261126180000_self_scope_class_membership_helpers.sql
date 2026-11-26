-- These SECURITY DEFINER helpers are used by RLS and guarded RPCs with auth.uid()
-- as the supplied subject. Prevent authenticated callers from probing arbitrary IDs
-- through direct RPC invocation.
-- Preserve the existing input argument names: Postgres cannot rename parameters
-- through CREATE OR REPLACE FUNCTION without dropping the dependent function.
CREATE OR REPLACE FUNCTION public.is_student_in_class(_student_id uuid, _class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT auth.uid() IS NOT NULL
    AND auth.uid() = _student_id
    AND EXISTS (
      SELECT 1 FROM public.class_students
      WHERE student_id = _student_id AND class_id = _class_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_class(_teacher_id uuid, _class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT auth.uid() IS NOT NULL
    AND auth.uid() = _teacher_id
    AND EXISTS (
      SELECT 1 FROM public.classes
      WHERE id = _class_id AND teacher_id = _teacher_id
    );
$$;

REVOKE ALL ON FUNCTION public.is_student_in_class(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_student_in_class(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_teacher_of_class(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid, uuid) TO authenticated;
