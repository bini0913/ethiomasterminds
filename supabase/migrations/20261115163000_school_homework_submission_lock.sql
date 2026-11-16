CREATE OR REPLACE FUNCTION public.school_validate_homework_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_homework public.school_homework_assignments%ROWTYPE;
  v_actor uuid;
  v_student public.school_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_homework FROM public.school_homework_assignments
  WHERE id = NEW.homework_id AND school_id = NEW.school_id;
  SELECT * INTO v_student FROM public.school_memberships
  WHERE id = NEW.student_membership_id AND school_id = NEW.school_id;
  IF v_homework.id IS NULL OR v_student.id IS NULL THEN
    RAISE EXCEPTION 'Homework and student must belong to the same school';
  END IF;

  v_actor := public.school_my_membership_id(NEW.school_id);
  IF TG_OP = 'INSERT' THEN
    IF v_student.user_id <> auth.uid() OR v_student.school_role <> 'student'
       OR v_student.status <> 'active' OR v_student.section_id <> v_homework.section_id
       OR v_homework.status <> 'approved' THEN
      RAISE EXCEPTION 'Only an enrolled student can submit approved homework for their section';
    END IF;
    RETURN NEW;
  END IF;

  IF v_student.user_id = auth.uid() THEN
    IF OLD.status = 'graded'
       OR NEW.school_id IS DISTINCT FROM OLD.school_id
       OR NEW.homework_id IS DISTINCT FROM OLD.homework_id
       OR NEW.student_membership_id IS DISTINCT FROM OLD.student_membership_id
       OR NEW.grade IS DISTINCT FROM OLD.grade
       OR NEW.feedback IS DISTINCT FROM OLD.feedback
       OR NEW.graded_by_membership_id IS DISTINCT FROM OLD.graded_by_membership_id
       OR NEW.graded_at IS DISTINCT FROM OLD.graded_at
       OR NEW.status NOT IN ('submitted', 'returned') THEN
      RAISE EXCEPTION 'Students may update only ungraded homework responses; teacher grading is protected';
    END IF;
    NEW.submitted_at := now();
    RETURN NEW;
  END IF;

  IF v_actor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_teacher_assignments assignment
    WHERE assignment.teacher_membership_id = v_actor
      AND assignment.section_id = v_homework.section_id
      AND (assignment.assignment_kind = 'homeroom' OR assignment.subject_name = v_homework.subject_name)
  ) THEN
    IF NEW.homework_id IS DISTINCT FROM OLD.homework_id
       OR NEW.student_membership_id IS DISTINCT FROM OLD.student_membership_id
       OR NEW.response_text IS DISTINCT FROM OLD.response_text
       OR NEW.attachment_path IS DISTINCT FROM OLD.attachment_path
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      RAISE EXCEPTION 'Teachers can grade submissions but cannot edit student responses';
    END IF;
    NEW.graded_by_membership_id := v_actor;
    NEW.graded_at := now();
    NEW.status := CASE WHEN NEW.grade IS NULL THEN 'returned' ELSE 'graded' END;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only the student or assigned teacher can update this submission';
END;
$$;
