-- Complete teacher assignment workflow.
-- Assignment creation is performed server-side so client callers cannot forge
-- teacher/class/quiz relationships or bypass grade compatibility.

CREATE OR REPLACE FUNCTION public.create_teacher_assignment(
  p_quiz_id uuid,
  p_class_id uuid,
  p_due_date timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id uuid;
  v_quiz_grade text;
  v_class_grade text;
  v_teacher_id uuid := auth.uid();
BEGIN
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_quiz_id IS NULL OR p_class_id IS NULL THEN
    RAISE EXCEPTION 'Quiz and class are required';
  END IF;

  SELECT q.grade INTO v_quiz_grade
  FROM public.quizzes q
  WHERE q.id = p_quiz_id
    AND (
      q.created_by = v_teacher_id
      OR public.has_role(v_teacher_id, 'admin'::public.app_role)
      OR public.has_role(v_teacher_id, 'manager'::public.app_role)
      OR public._is_extreme_admin()
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can only assign quizzes that you own or manage';
  END IF;

  SELECT c.grade INTO v_class_grade
  FROM public.classes c
  WHERE c.id = p_class_id
    AND (
      c.teacher_id = v_teacher_id
      OR public.has_role(v_teacher_id, 'admin'::public.app_role)
      OR public.has_role(v_teacher_id, 'manager'::public.app_role)
      OR public._is_extreme_admin()
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can only assign work to classes that you manage';
  END IF;

  IF NULLIF(trim(coalesce(v_quiz_grade, '')), '') IS NOT NULL
     AND NULLIF(trim(coalesce(v_class_grade, '')), '') IS NOT NULL
     AND lower(trim(v_quiz_grade)) <> lower(trim(v_class_grade)) THEN
    RAISE EXCEPTION 'Quiz grade % does not match class grade %', v_quiz_grade, v_class_grade;
  END IF;

  IF p_due_date IS NOT NULL AND p_due_date < now() THEN
    RAISE EXCEPTION 'Due date must be in the future';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quiz_assignments qa
    WHERE qa.quiz_id = p_quiz_id
      AND qa.class_id = p_class_id
      AND qa.student_id IS NULL
  ) THEN
    RAISE EXCEPTION 'This quiz is already assigned to the class';
  END IF;

  INSERT INTO public.quiz_assignments (quiz_id, class_id, assigned_by, due_date)
  VALUES (p_quiz_id, p_class_id, v_teacher_id, p_due_date)
  RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_teacher_assignment(uuid, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_teacher_assignment(uuid, uuid, timestamptz) TO authenticated;
