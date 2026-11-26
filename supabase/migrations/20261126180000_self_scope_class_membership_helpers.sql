-- These SECURITY DEFINER helpers are used by RLS and guarded RPCs with auth.uid()
-- as the supplied subject. Prevent authenticated callers from probing arbitrary IDs
-- through direct RPC invocation.
CREATE OR REPLACE FUNCTION public.is_student_in_class(p_student_id uuid, p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT auth.uid() IS NOT NULL
    AND auth.uid() = p_student_id
    AND EXISTS (
      SELECT 1 FROM public.class_students
      WHERE student_id = p_student_id AND class_id = p_class_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_class(p_teacher_id uuid, p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT auth.uid() IS NOT NULL
    AND auth.uid() = p_teacher_id
    AND EXISTS (
      SELECT 1 FROM public.classes
      WHERE id = p_class_id AND teacher_id = p_teacher_id
    );
$$;

REVOKE ALL ON FUNCTION public.is_student_in_class(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_student_in_class(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_teacher_of_class(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid, uuid) TO authenticated;
