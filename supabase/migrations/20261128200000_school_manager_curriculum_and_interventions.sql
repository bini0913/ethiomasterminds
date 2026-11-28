-- School Manager Part 2: curriculum delivery and academic interventions.
-- No curriculum is seeded: schools must enter/verify their own curriculum sources.
-- All mutations are guarded RPCs; audit events are append-only.

CREATE TABLE IF NOT EXISTS public.school_curriculum_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL REFERENCES public.school_academic_years(id) ON DELETE RESTRICT,
  grade_label text NOT NULL CHECK (length(trim(grade_label)) BETWEEN 1 AND 80),
  subject_name text NOT NULL CHECK (length(trim(subject_name)) BETWEEN 1 AND 120),
  unit_code text NOT NULL CHECK (length(trim(unit_code)) BETWEEN 1 AND 40),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 180),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  sequence_number integer NOT NULL CHECK (sequence_number > 0),
  source_type text NOT NULL DEFAULT 'school_defined'
    CHECK (source_type IN ('official_curriculum', 'textbook', 'teacher_planned', 'school_defined', 'other')),
  source_title text NOT NULL DEFAULT '' CHECK (length(source_title) <= 240),
  source_url text,
  source_catalog_id uuid REFERENCES public.curriculum_textbook_catalog(id) ON DELETE SET NULL,
  source_library_book_id uuid REFERENCES public.library_books(id) ON DELETE SET NULL,
  source_verification text NOT NULL DEFAULT 'unverified'
    CHECK (source_verification IN ('unverified', 'verified_by_school')),
  expected_start date,
  expected_end date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_curriculum_units_id_school_id_key UNIQUE (id, school_id),
  CONSTRAINT school_curriculum_unit_year_school_fk
    FOREIGN KEY (academic_year_id, school_id)
    REFERENCES public.school_academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT school_curriculum_unit_dates_check
    CHECK (expected_start IS NULL OR expected_end IS NULL OR expected_end >= expected_start),
  CONSTRAINT school_curriculum_unit_source_url_check
    CHECK (source_url IS NULL OR source_url ~* '^https?://'),
  CONSTRAINT school_curriculum_unit_single_linked_source_check
    CHECK (source_catalog_id IS NULL OR source_library_book_id IS NULL),
  CONSTRAINT school_curriculum_unit_unique
    UNIQUE (school_id, academic_year_id, grade_label, subject_name, unit_code)
);

CREATE TABLE IF NOT EXISTS public.school_curriculum_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.school_curriculum_units(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.school_sections(id) ON DELETE CASCADE,
  teacher_membership_id uuid NOT NULL REFERENCES public.school_memberships(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'taught', 'needs_support')),
  teacher_note text NOT NULL DEFAULT '' CHECK (length(teacher_note) <= 3000),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_curriculum_progress_school_unit_fk
    FOREIGN KEY (unit_id, school_id)
    REFERENCES public.school_curriculum_units(id, school_id) ON DELETE CASCADE,
  CONSTRAINT school_curriculum_progress_school_section_fk
    FOREIGN KEY (section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE CASCADE,
  CONSTRAINT school_curriculum_progress_teacher_school_fk
    FOREIGN KEY (teacher_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT school_curriculum_progress_unique UNIQUE (unit_id, section_id),
  CONSTRAINT school_curriculum_progress_completion_check
    CHECK ((status = 'taught' AND completed_at IS NOT NULL) OR (status <> 'taught' AND completed_at IS NULL))
);

CREATE TABLE IF NOT EXISTS public.school_curriculum_unit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL,
  actor_user_id uuid,
  event_type text NOT NULL CHECK (event_type IN ('created','updated','archived','reactivated')),
  unit_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_curriculum_progress_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  progress_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  section_id uuid NOT NULL,
  actor_membership_id uuid,
  previous_status text,
  new_status text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_academic_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_membership_id uuid NOT NULL REFERENCES public.school_memberships(id) ON DELETE RESTRICT,
  section_id uuid NOT NULL REFERENCES public.school_sections(id) ON DELETE RESTRICT,
  academic_year_id uuid NOT NULL REFERENCES public.school_academic_years(id) ON DELETE RESTRICT,
  subject_name text NOT NULL CHECK (length(trim(subject_name)) BETWEEN 1 AND 120),
  category text NOT NULL CHECK (category IN ('academic_performance', 'attendance_impact', 'homework_support', 'learning_support', 'other')),
  concern text NOT NULL CHECK (length(trim(concern)) BETWEEN 5 AND 2000),
  action_plan text NOT NULL CHECK (length(trim(action_plan)) BETWEEN 5 AND 3000),
  target_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  outcome text NOT NULL DEFAULT '' CHECK (length(outcome) <= 3000),
  created_by_membership_id uuid NOT NULL REFERENCES public.school_memberships(id) ON DELETE RESTRICT,
  updated_by_membership_id uuid REFERENCES public.school_memberships(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT school_academic_intervention_student_school_fk
    FOREIGN KEY (student_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT school_academic_intervention_section_school_fk
    FOREIGN KEY (section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT school_academic_intervention_year_school_fk
    FOREIGN KEY (academic_year_id, school_id)
    REFERENCES public.school_academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT school_academic_intervention_creator_school_fk
    FOREIGN KEY (created_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT school_academic_intervention_student_check
    CHECK (status NOT IN ('resolved', 'closed') OR length(trim(outcome)) >= 5)
);

CREATE TABLE IF NOT EXISTS public.school_academic_intervention_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  intervention_id uuid NOT NULL REFERENCES public.school_academic_interventions(id) ON DELETE CASCADE,
  actor_membership_id uuid,
  previous_status text,
  new_status text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_curriculum_units_scope_idx
  ON public.school_curriculum_units (school_id, academic_year_id, grade_label, subject_name, sequence_number)
  WHERE is_active;
CREATE INDEX IF NOT EXISTS school_curriculum_progress_scope_idx
  ON public.school_curriculum_progress (school_id, section_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS school_academic_interventions_scope_idx
  ON public.school_academic_interventions (school_id, status, target_date, updated_at DESC);

ALTER TABLE public.school_curriculum_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_curriculum_unit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_curriculum_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_curriculum_progress_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_academic_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_academic_intervention_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_curriculum_units_select ON public.school_curriculum_units;
CREATE POLICY school_curriculum_units_select ON public.school_curriculum_units
FOR SELECT TO authenticated USING (
  public.is_school_manager_or_admin(school_id)
  OR EXISTS (
    SELECT 1 FROM public.school_sections section
    WHERE section.school_id = school_curriculum_units.school_id
      AND section.academic_year_id = school_curriculum_units.academic_year_id
      AND section.grade_label = school_curriculum_units.grade_label
      AND public.school_can_teach_subject(school_curriculum_units.school_id, section.id, school_curriculum_units.subject_name)
  )
);
DROP POLICY IF EXISTS school_curriculum_unit_events_select ON public.school_curriculum_unit_events;
CREATE POLICY school_curriculum_unit_events_select ON public.school_curriculum_unit_events
FOR SELECT TO authenticated USING (public.is_school_manager_or_admin(school_id));
DROP POLICY IF EXISTS school_curriculum_progress_select ON public.school_curriculum_progress;
CREATE POLICY school_curriculum_progress_select ON public.school_curriculum_progress
FOR SELECT TO authenticated USING (
  public.is_school_manager_or_admin(school_id)
  OR EXISTS (
    SELECT 1 FROM public.school_memberships teacher
    WHERE teacher.id = school_curriculum_progress.teacher_membership_id
      AND teacher.user_id = auth.uid()
      AND teacher.school_role = 'teacher'
      AND teacher.status = 'active'
  )
);
DROP POLICY IF EXISTS school_curriculum_progress_events_select ON public.school_curriculum_progress_events;
CREATE POLICY school_curriculum_progress_events_select ON public.school_curriculum_progress_events
FOR SELECT TO authenticated USING (public.is_school_manager_or_admin(school_id));
DROP POLICY IF EXISTS school_academic_interventions_select ON public.school_academic_interventions;
CREATE POLICY school_academic_interventions_select ON public.school_academic_interventions
FOR SELECT TO authenticated USING (public.is_school_manager_or_admin(school_id));
DROP POLICY IF EXISTS school_academic_intervention_events_select ON public.school_academic_intervention_events;
CREATE POLICY school_academic_intervention_events_select ON public.school_academic_intervention_events
FOR SELECT TO authenticated USING (public.is_school_manager_or_admin(school_id));

REVOKE ALL ON public.school_curriculum_units, public.school_curriculum_unit_events, public.school_curriculum_progress,
  public.school_curriculum_progress_events, public.school_academic_interventions,
  public.school_academic_intervention_events FROM anon, authenticated;
GRANT SELECT ON public.school_curriculum_units, public.school_curriculum_unit_events, public.school_curriculum_progress,
  public.school_curriculum_progress_events, public.school_academic_interventions,
  public.school_academic_intervention_events TO authenticated;

CREATE OR REPLACE FUNCTION public.school_prevent_academic_event_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'Academic audit events are append-only';
END;
$function$;

CREATE OR REPLACE FUNCTION public.school_record_curriculum_unit_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_event_type text;
  v_snapshot jsonb;
BEGIN
  v_event_type := CASE
    WHEN TG_OP = 'INSERT' THEN 'created'
    WHEN OLD.is_active AND NOT NEW.is_active THEN 'archived'
    WHEN NOT OLD.is_active AND NEW.is_active THEN 'reactivated'
    ELSE 'updated'
  END;
  v_snapshot := jsonb_build_object(
    'academic_year_id', NEW.academic_year_id, 'grade_label', NEW.grade_label,
    'subject_name', NEW.subject_name, 'unit_code', NEW.unit_code, 'title', NEW.title,
    'description', NEW.description, 'sequence_number', NEW.sequence_number,
    'source_type', NEW.source_type, 'source_title', NEW.source_title,
    'source_url', NEW.source_url, 'source_catalog_id', NEW.source_catalog_id,
    'source_library_book_id', NEW.source_library_book_id, 'source_verification', NEW.source_verification,
    'expected_start', NEW.expected_start, 'expected_end', NEW.expected_end,
    'is_active', NEW.is_active
  );
  INSERT INTO public.school_curriculum_unit_events(
    school_id, unit_id, actor_user_id, event_type, unit_snapshot
  ) VALUES (NEW.school_id, NEW.id, auth.uid(), v_event_type, v_snapshot);
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS school_curriculum_unit_audit ON public.school_curriculum_units;
CREATE TRIGGER school_curriculum_unit_audit
AFTER INSERT OR UPDATE ON public.school_curriculum_units
FOR EACH ROW EXECUTE FUNCTION public.school_record_curriculum_unit_event();
DROP TRIGGER IF EXISTS school_curriculum_unit_events_immutable ON public.school_curriculum_unit_events;
CREATE TRIGGER school_curriculum_unit_events_immutable
BEFORE UPDATE OR DELETE ON public.school_curriculum_unit_events
FOR EACH ROW EXECUTE FUNCTION public.school_prevent_academic_event_mutation();

CREATE OR REPLACE FUNCTION public.school_record_curriculum_progress_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := public.school_my_membership_id(NEW.school_id);
  INSERT INTO public.school_curriculum_progress_events(
    school_id, progress_id, unit_id, section_id, actor_membership_id,
    previous_status, new_status, note
  ) VALUES (
    NEW.school_id, NEW.id, NEW.unit_id, NEW.section_id, v_actor,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    NEW.status, NEW.teacher_note
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS school_curriculum_progress_audit ON public.school_curriculum_progress;
CREATE TRIGGER school_curriculum_progress_audit
AFTER INSERT OR UPDATE ON public.school_curriculum_progress
FOR EACH ROW EXECUTE FUNCTION public.school_record_curriculum_progress_event();

CREATE OR REPLACE FUNCTION public.school_prevent_academic_event_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Academic audit events are append-only';
END;
$$;
DROP TRIGGER IF EXISTS school_curriculum_progress_events_immutable ON public.school_curriculum_progress_events;
CREATE TRIGGER school_curriculum_progress_events_immutable
BEFORE UPDATE OR DELETE ON public.school_curriculum_progress_events
FOR EACH ROW EXECUTE FUNCTION public.school_prevent_academic_event_mutation();
DROP TRIGGER IF EXISTS school_academic_intervention_events_immutable ON public.school_academic_intervention_events;
CREATE TRIGGER school_academic_intervention_events_immutable
BEFORE UPDATE OR DELETE ON public.school_academic_intervention_events
FOR EACH ROW EXECUTE FUNCTION public.school_prevent_academic_event_mutation();

CREATE OR REPLACE FUNCTION public.school_record_academic_intervention_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := public.school_my_membership_id(NEW.school_id);
  INSERT INTO public.school_academic_intervention_events(
    school_id, intervention_id, actor_membership_id, previous_status, new_status, reason
  ) VALUES (
    NEW.school_id, NEW.id, v_actor,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
    NEW.status,
    CASE WHEN TG_OP = 'INSERT' THEN NEW.concern ELSE COALESCE(NULLIF(NEW.outcome, ''), NEW.action_plan) END
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS school_academic_intervention_audit ON public.school_academic_interventions;
CREATE TRIGGER school_academic_intervention_audit
AFTER INSERT OR UPDATE ON public.school_academic_interventions
FOR EACH ROW EXECUTE FUNCTION public.school_record_academic_intervention_event();
DROP TRIGGER IF EXISTS school_academic_intervention_events_immutable ON public.school_academic_intervention_events;
CREATE TRIGGER school_academic_intervention_events_immutable
BEFORE UPDATE OR DELETE ON public.school_academic_intervention_events
FOR EACH ROW EXECUTE FUNCTION public.school_prevent_academic_event_mutation();

CREATE OR REPLACE FUNCTION public.school_manager_save_curriculum_unit(
  p_school_id uuid, p_academic_year_id uuid, p_grade_label text, p_subject_name text,
  p_unit_code text, p_title text, p_description text, p_sequence_number integer,
  p_source_type text, p_source_title text, p_source_url text, p_source_verification text,
  p_expected_start date, p_expected_end date, p_is_active boolean,
  p_source_catalog_id uuid DEFAULT NULL, p_source_library_book_id uuid DEFAULT NULL,
  p_unit_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_school_manager_or_admin(p_school_id) THEN
    RAISE EXCEPTION 'School Manager or School Admin access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_academic_years y WHERE y.id = p_academic_year_id AND y.school_id = p_school_id) THEN
    RAISE EXCEPTION 'Academic year does not belong to this school';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_subjects s WHERE s.school_id = p_school_id
    AND s.academic_year_id = p_academic_year_id AND s.grade_label = trim(p_grade_label)
    AND lower(s.subject_name) = lower(trim(p_subject_name)) AND s.active) THEN
    RAISE EXCEPTION 'Choose an active subject configured for this grade and academic year';
  END IF;
  IF p_sequence_number IS NULL OR p_sequence_number < 1
    OR length(trim(COALESCE(p_unit_code,''))) NOT BETWEEN 1 AND 40
    OR length(trim(COALESCE(p_title,''))) NOT BETWEEN 2 AND 180
    OR length(COALESCE(p_description,'')) > 4000 THEN
    RAISE EXCEPTION 'Unit code, title, sequence, or description is invalid';
  END IF;
  IF p_source_type NOT IN ('official_curriculum','textbook','teacher_planned','school_defined','other')
    OR p_source_verification NOT IN ('unverified','verified_by_school') THEN
    RAISE EXCEPTION 'Invalid curriculum source classification';
  END IF;
  IF p_source_url IS NOT NULL AND p_source_url !~* '^https?://' THEN
    RAISE EXCEPTION 'Source URL must use HTTP or HTTPS';
  END IF;
  IF p_source_catalog_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.curriculum_textbook_catalog catalog
    WHERE catalog.id = p_source_catalog_id
      AND lower(catalog.subject) = lower(trim(p_subject_name))
      AND substring(trim(p_grade_label) from '([0-9]+)') IS NOT NULL
      AND catalog.grade_level = substring(trim(p_grade_label) from '([0-9]+)')::integer
  ) THEN
    RAISE EXCEPTION 'Selected national textbook reference does not match this subject and grade';
  END IF;
  IF p_source_library_book_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.library_books book
    WHERE book.id = p_source_library_book_id AND book.school_id = p_school_id
      AND book.status = 'approved' AND book.school_review_status = 'approved'
      AND lower(book.subject) = lower(trim(p_subject_name))
      AND (book.school_grade_label = trim(p_grade_label)
        OR (substring(trim(p_grade_label) from '([0-9]+)') IS NOT NULL
          AND book.grade_level = substring(trim(p_grade_label) from '([0-9]+)')::integer))
  ) THEN
    RAISE EXCEPTION 'Selected school library book must be approved and match this grade and subject';
  END IF;
  IF p_source_catalog_id IS NOT NULL AND p_source_library_book_id IS NOT NULL THEN
    RAISE EXCEPTION 'Link one textbook source at a time';
  END IF;
  IF p_expected_start IS NOT NULL AND p_expected_end IS NOT NULL AND p_expected_end < p_expected_start THEN
    RAISE EXCEPTION 'Expected end date cannot be before expected start date';
  END IF;
  IF p_unit_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_curriculum_progress progress
    JOIN public.school_curriculum_units existing ON existing.id = progress.unit_id
    WHERE existing.id = p_unit_id AND existing.school_id = p_school_id
      AND (existing.academic_year_id IS DISTINCT FROM p_academic_year_id
        OR existing.grade_label IS DISTINCT FROM trim(p_grade_label)
        OR existing.subject_name IS DISTINCT FROM trim(p_subject_name))
  ) THEN
    RAISE EXCEPTION 'Grade, subject, and academic year cannot change after teachers have recorded delivery progress';
  END IF;
  IF p_unit_id IS NULL THEN
    INSERT INTO public.school_curriculum_units(
      school_id, academic_year_id, grade_label, subject_name, unit_code, title, description,
      sequence_number, source_type, source_title, source_url, source_catalog_id, source_library_book_id, source_verification,
      expected_start, expected_end, is_active, created_by, updated_by
    ) VALUES (
      p_school_id, p_academic_year_id, trim(p_grade_label), trim(p_subject_name),
      trim(p_unit_code), trim(p_title), COALESCE(p_description,''), p_sequence_number,
      p_source_type, COALESCE(p_source_title,''), NULLIF(trim(COALESCE(p_source_url,'')),''),
      p_source_catalog_id, p_source_library_book_id, p_source_verification, p_expected_start, p_expected_end, COALESCE(p_is_active,true),
      auth.uid(), auth.uid()
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.school_curriculum_units SET
      academic_year_id=p_academic_year_id, grade_label=trim(p_grade_label),
      subject_name=trim(p_subject_name), unit_code=trim(p_unit_code), title=trim(p_title),
      description=COALESCE(p_description,''), sequence_number=p_sequence_number,
      source_type=p_source_type, source_title=COALESCE(p_source_title,''),
      source_url=NULLIF(trim(COALESCE(p_source_url,'')),''),
      source_catalog_id=p_source_catalog_id, source_library_book_id=p_source_library_book_id,
      source_verification=p_source_verification, expected_start=p_expected_start,
      expected_end=p_expected_end, is_active=COALESCE(p_is_active,true),
      updated_by=auth.uid(), updated_at=now()
    WHERE id=p_unit_id AND school_id=p_school_id RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Curriculum unit not found in this school'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_teacher_update_curriculum_progress(
  p_unit_id uuid, p_section_id uuid, p_status text, p_teacher_note text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_unit public.school_curriculum_units%ROWTYPE;
  v_section public.school_sections%ROWTYPE;
  v_teacher_id uuid;
  v_progress_id uuid;
BEGIN
  SELECT * INTO v_unit FROM public.school_curriculum_units WHERE id=p_unit_id AND is_active;
  SELECT * INTO v_section FROM public.school_sections WHERE id=p_section_id;
  SELECT id INTO v_teacher_id FROM public.school_memberships
  WHERE school_id = v_unit.school_id AND user_id = auth.uid()
    AND school_role = 'teacher' AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;
  IF v_unit.id IS NULL OR v_section.id IS NULL OR v_section.school_id <> v_unit.school_id
    OR v_section.academic_year_id <> v_unit.academic_year_id
    OR v_section.grade_label <> v_unit.grade_label
    OR NOT public.school_can_teach_subject(v_unit.school_id,p_section_id,v_unit.subject_name)
    OR v_teacher_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM public.school_memberships m WHERE m.id=v_teacher_id AND m.school_role='teacher') THEN
    RAISE EXCEPTION 'Only the assigned teacher can update curriculum progress for this class and subject';
  END IF;
  IF p_status NOT IN ('planned','in_progress','taught','needs_support') THEN
    RAISE EXCEPTION 'Invalid curriculum progress status';
  END IF;
  IF p_status IN ('taught','needs_support') AND length(trim(COALESCE(p_teacher_note,''))) < 5 THEN
    RAISE EXCEPTION 'Add a short teaching note or support reason before submitting this status';
  END IF;
  INSERT INTO public.school_curriculum_progress(
    school_id,unit_id,section_id,teacher_membership_id,status,teacher_note,
    started_at,completed_at,updated_at
  ) VALUES (
    v_unit.school_id,v_unit.id,v_section.id,v_teacher_id,p_status,COALESCE(p_teacher_note,''),
    CASE WHEN p_status IN ('in_progress','taught','needs_support') THEN now() ELSE NULL END,
    CASE WHEN p_status='taught' THEN now() ELSE NULL END,now()
  )
  ON CONFLICT (unit_id,section_id) DO UPDATE SET
    teacher_membership_id=EXCLUDED.teacher_membership_id,
    status=EXCLUDED.status, teacher_note=EXCLUDED.teacher_note,
    started_at=CASE WHEN EXCLUDED.status='planned' THEN NULL ELSE COALESCE(school_curriculum_progress.started_at,now()) END,
    completed_at=CASE WHEN EXCLUDED.status='taught' THEN now() ELSE NULL END,
    updated_at=now()
  RETURNING id INTO v_progress_id;
  RETURN v_progress_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_manager_save_academic_intervention(
  p_school_id uuid, p_student_membership_id uuid, p_section_id uuid, p_academic_year_id uuid,
  p_subject_name text, p_category text, p_concern text, p_action_plan text,
  p_target_date date, p_status text, p_outcome text DEFAULT '', p_intervention_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_school_manager_or_admin(p_school_id) THEN
    RAISE EXCEPTION 'School Manager or School Admin access required';
  END IF;
  v_actor := public.school_my_membership_id(p_school_id);
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Active school membership required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_memberships student
    WHERE student.id=p_student_membership_id AND student.school_id=p_school_id
      AND student.school_role='student' AND student.status IN ('active','suspended')
      AND student.section_id=p_section_id)
    OR NOT EXISTS (SELECT 1 FROM public.school_sections section
      WHERE section.id=p_section_id AND section.school_id=p_school_id
        AND section.academic_year_id=p_academic_year_id)
    OR NOT EXISTS (SELECT 1 FROM public.school_academic_years year
      WHERE year.id=p_academic_year_id AND year.school_id=p_school_id) THEN
    RAISE EXCEPTION 'Student, section, and academic year must match this school';
  END IF;
  IF trim(COALESCE(p_subject_name,'')) <> '' AND NOT EXISTS (
    SELECT 1 FROM public.school_sections section
    JOIN public.school_subjects subject ON subject.school_id = section.school_id
      AND subject.academic_year_id = section.academic_year_id
      AND subject.grade_label = section.grade_label AND subject.active
    WHERE section.id = p_section_id AND section.school_id = p_school_id
      AND subject.subject_name = trim(p_subject_name)
  ) THEN
    RAISE EXCEPTION 'Select a subject configured for the student section and academic year';
  END IF;
  IF p_category NOT IN ('academic_performance','attendance_impact','homework_support','learning_support','other')
    OR length(trim(COALESCE(p_concern,''))) NOT BETWEEN 5 AND 2000
    OR length(trim(COALESCE(p_action_plan,''))) NOT BETWEEN 5 AND 3000
    OR p_status NOT IN ('open','in_progress','resolved','closed') THEN
    RAISE EXCEPTION 'Intervention details or status are invalid';
  END IF;
  IF p_status IN ('resolved','closed') AND length(trim(COALESCE(p_outcome,''))) < 5 THEN
    RAISE EXCEPTION 'Record an outcome before resolving or closing an intervention';
  END IF;
  IF p_intervention_id IS NULL THEN
    INSERT INTO public.school_academic_interventions(
      school_id,student_membership_id,section_id,academic_year_id,subject_name,category,
      concern,action_plan,target_date,status,outcome,created_by_membership_id,
      updated_by_membership_id,resolved_at
    ) VALUES (
      p_school_id,p_student_membership_id,p_section_id,p_academic_year_id,trim(p_subject_name),
      p_category,trim(p_concern),trim(p_action_plan),p_target_date,p_status,
      COALESCE(p_outcome,''),v_actor,v_actor,
      CASE WHEN p_status IN ('resolved','closed') THEN now() ELSE NULL END
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.school_academic_interventions SET
      student_membership_id=p_student_membership_id,section_id=p_section_id,
      academic_year_id=p_academic_year_id,subject_name=trim(p_subject_name),
      category=p_category,concern=trim(p_concern),action_plan=trim(p_action_plan),
      target_date=p_target_date,status=p_status,outcome=COALESCE(p_outcome,''),
      updated_by_membership_id=v_actor,updated_at=now(),
      resolved_at=CASE WHEN p_status IN ('resolved','closed') THEN COALESCE(resolved_at,now()) ELSE NULL END
    WHERE id=p_intervention_id AND school_id=p_school_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Academic intervention not found in this school'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.school_manager_save_curriculum_unit(uuid,uuid,text,text,text,text,text,integer,text,text,text,text,date,date,boolean,uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_teacher_update_curriculum_progress(uuid,uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_manager_save_academic_intervention(uuid,uuid,uuid,uuid,text,text,text,text,date,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_manager_save_curriculum_unit(uuid,uuid,text,text,text,text,text,integer,text,text,text,text,date,date,boolean,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_teacher_update_curriculum_progress(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_manager_save_academic_intervention(uuid,uuid,uuid,uuid,text,text,text,text,date,text,text,uuid) TO authenticated;

COMMENT ON TABLE public.school_curriculum_units IS 'School-defined curriculum units. Source provenance is recorded and school verification is not represented as external certification.';
COMMENT ON TABLE public.school_curriculum_progress IS 'Teacher-reported delivery status per curriculum unit and section; not student mastery.';
COMMENT ON TABLE public.school_academic_interventions IS 'Manager-controlled academic support plans with reason, action plan, target date, status and outcome.';
