-- Record attendance submission time on the database, not from the browser clock.

CREATE OR REPLACE FUNCTION public.school_validate_attendance_session()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_recorder public.school_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_recorder FROM public.school_memberships WHERE id = NEW.recorded_by_membership_id;
  IF v_recorder.id IS NULL OR v_recorder.school_id <> NEW.school_id
     OR v_recorder.school_role <> 'teacher'
     OR NOT public.school_is_homeroom_teacher(NEW.school_id, NEW.section_id) THEN
    RAISE EXCEPTION 'Only the assigned homeroom teacher can create or update this attendance session';
  END IF;
  IF TG_OP = 'INSERT' AND v_recorder.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'The signed-in homeroom teacher must create the attendance session';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.school_id, NEW.section_id, NEW.attendance_date, NEW.recorded_by_membership_id, NEW.created_at)
       IS DISTINCT FROM ROW(OLD.school_id, OLD.section_id, OLD.attendance_date, OLD.recorded_by_membership_id, OLD.created_at) THEN
      RAISE EXCEPTION 'Attendance session identity fields are immutable';
    END IF;
    IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
       AND NOT (OLD.status = 'open' AND NEW.status = 'submitted') THEN
      RAISE EXCEPTION 'Attendance submission time is managed by the database';
    END IF;
    IF OLD.status = 'open' AND NEW.status = 'submitted' THEN
      NEW.submitted_at := now();
    ELSIF NEW.status IS DISTINCT FROM OLD.status
       AND NOT (OLD.status = 'open' AND NEW.status = 'locked') THEN
      RAISE EXCEPTION 'Invalid attendance session status transition';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
