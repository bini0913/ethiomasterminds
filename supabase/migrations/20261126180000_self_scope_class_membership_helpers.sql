-- These SECURITY DEFINER helpers are used by RLS and guarded RPCs with auth.uid()
-- as the supplied subject. Prevent authenticated callers from probing arbitrary IDs.
-- Keep the deployed input argument names: CREATE OR REPLACE cannot rename them.
-- Read the names from pg_proc so this migration also tolerates a clean migration chain
-- whose historical parameter names differ from the currently deployed database.
DO $migration$
DECLARE
  v_student_subject_arg text;
  v_student_class_arg text;
  v_teacher_subject_arg text;
  v_teacher_class_arg text;
BEGIN
  SELECT proargnames[1], proargnames[2]
    INTO v_student_subject_arg, v_student_class_arg
  FROM pg_proc
  WHERE oid = 'public.is_student_in_class(uuid, uuid)'::regprocedure;

  SELECT proargnames[1], proargnames[2]
    INTO v_teacher_subject_arg, v_teacher_class_arg
  FROM pg_proc
  WHERE oid = 'public.is_teacher_of_class(uuid, uuid)'::regprocedure;

  IF v_student_subject_arg IS NULL OR v_student_class_arg IS NULL
     OR v_teacher_subject_arg IS NULL OR v_teacher_class_arg IS NULL THEN
    RAISE EXCEPTION 'Class membership helper signatures are missing or unnamed';
  END IF;

  EXECUTE format($definition$
    CREATE OR REPLACE FUNCTION public.is_student_in_class(%I uuid, %I uuid)
    RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
    AS $body$
      SELECT auth.uid() IS NOT NULL
        AND auth.uid() = %I
        AND EXISTS (
          SELECT 1 FROM public.class_students
          WHERE student_id = %I AND class_id = %I
        );
    $body$;
  $definition$,
    v_student_subject_arg, v_student_class_arg,
    v_student_subject_arg, v_student_subject_arg, v_student_class_arg
  );

  EXECUTE format($definition$
    CREATE OR REPLACE FUNCTION public.is_teacher_of_class(%I uuid, %I uuid)
    RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
    AS $body$
      SELECT auth.uid() IS NOT NULL
        AND auth.uid() = %I
        AND EXISTS (
          SELECT 1 FROM public.classes
          WHERE id = %I AND teacher_id = %I
        );
    $body$;
  $definition$,
    v_teacher_subject_arg, v_teacher_class_arg,
    v_teacher_subject_arg, v_teacher_class_arg, v_teacher_subject_arg
  );
END;
$migration$;

REVOKE ALL ON FUNCTION public.is_student_in_class(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_student_in_class(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_teacher_of_class(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(uuid, uuid) TO authenticated;
