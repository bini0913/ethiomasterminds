-- School Manager Part 3.2: real timetable scheduling and school calendar.
-- No sample schedules/events are seeded. All writes use manager-guarded RPCs.

CREATE TABLE IF NOT EXISTS public.school_schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year_id uuid NOT NULL,
  section_id uuid NOT NULL,
  teacher_membership_id uuid NOT NULL,
  subject_name text NOT NULL CHECK (length(trim(subject_name)) BETWEEN 1 AND 120),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  room_label text NOT NULL DEFAULT '' CHECK (length(room_label) <= 100),
  effective_from date NOT NULL,
  effective_until date,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled')),
  created_by_membership_id uuid NOT NULL,
  updated_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_schedule_time_check CHECK (ends_at > starts_at),
  CONSTRAINT school_schedule_effective_dates_check CHECK (effective_until IS NULL OR effective_until >= effective_from),
  CONSTRAINT school_schedule_year_school_fk FOREIGN KEY (academic_year_id, school_id)
    REFERENCES public.school_academic_years(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT school_schedule_section_school_fk FOREIGN KEY (section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT school_schedule_teacher_school_fk FOREIGN KEY (teacher_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT school_schedule_creator_school_fk FOREIGN KEY (created_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT school_schedule_updater_school_fk FOREIGN KEY (updated_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.school_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 180),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  event_type text NOT NULL CHECK (event_type IN ('academic','exam','holiday','meeting','school_event','deadline','other')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  location text NOT NULL DEFAULT '' CHECK (length(location) <= 180),
  audience_type text NOT NULL DEFAULT 'school' CHECK (audience_type IN ('school','grade','section')),
  grade_label text,
  section_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled')),
  created_by_membership_id uuid NOT NULL,
  updated_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_calendar_event_time_check CHECK (ends_at > starts_at),
  CONSTRAINT school_calendar_event_audience_check CHECK (
    (audience_type = 'school' AND grade_label IS NULL AND section_id IS NULL)
    OR (audience_type = 'grade' AND grade_label IS NOT NULL AND length(trim(grade_label)) BETWEEN 1 AND 80 AND section_id IS NULL)
    OR (audience_type = 'section' AND section_id IS NOT NULL)
  ),
  CONSTRAINT school_calendar_event_section_school_fk FOREIGN KEY (section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT school_calendar_event_creator_school_fk FOREIGN KEY (created_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  CONSTRAINT school_calendar_event_updater_school_fk FOREIGN KEY (updated_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.school_operations_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_membership_id uuid,
  entity_type text NOT NULL CHECK (entity_type IN ('schedule_entry','calendar_event')),
  entity_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('created','updated')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 1000),
  before_state jsonb,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_schedule_entries_scope_idx
  ON public.school_schedule_entries (school_id, academic_year_id, section_id, weekday, starts_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS school_schedule_entries_teacher_idx
  ON public.school_schedule_entries (school_id, teacher_membership_id, weekday, starts_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS school_calendar_events_scope_idx
  ON public.school_calendar_events (school_id, starts_at, status);
CREATE INDEX IF NOT EXISTS school_operations_audit_scope_idx
  ON public.school_operations_audit_events (school_id, created_at DESC);

ALTER TABLE public.school_schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_operations_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_schedule_entries_read ON public.school_schedule_entries;
CREATE POLICY school_schedule_entries_read ON public.school_schedule_entries
FOR SELECT TO authenticated USING (
  public.is_school_manager_or_admin(school_id)
  OR public.is_active_school_member(school_id, NULL::text[])
);
DROP POLICY IF EXISTS school_calendar_events_read ON public.school_calendar_events;
CREATE POLICY school_calendar_events_read ON public.school_calendar_events
FOR SELECT TO authenticated USING (
  public.is_school_manager_or_admin(school_id)
  OR (
    status = 'published'
    AND public.is_active_school_member(school_id, NULL::text[])
    AND (
      audience_type = 'school'
      OR EXISTS (
        SELECT 1 FROM public.school_memberships member
        WHERE member.id = public.school_my_membership_id(school_calendar_events.school_id)
          AND (
            (school_calendar_events.audience_type = 'grade' AND member.grade_label = school_calendar_events.grade_label)
            OR (school_calendar_events.audience_type = 'section' AND member.section_id = school_calendar_events.section_id)
          )
      )
    )
  )
);
DROP POLICY IF EXISTS school_operations_audit_events_read ON public.school_operations_audit_events;
CREATE POLICY school_operations_audit_events_read ON public.school_operations_audit_events
FOR SELECT TO authenticated USING (public.is_school_manager_or_admin(school_id));

REVOKE ALL ON public.school_schedule_entries, public.school_calendar_events, public.school_operations_audit_events FROM anon, authenticated;
GRANT SELECT ON public.school_schedule_entries, public.school_calendar_events, public.school_operations_audit_events TO authenticated;

CREATE OR REPLACE FUNCTION public.school_prevent_operations_audit_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'School operations audit events are append-only';
END;
$$;
DROP TRIGGER IF EXISTS school_operations_audit_events_immutable ON public.school_operations_audit_events;
CREATE TRIGGER school_operations_audit_events_immutable
BEFORE UPDATE OR DELETE ON public.school_operations_audit_events
FOR EACH ROW EXECUTE FUNCTION public.school_prevent_operations_audit_mutation();

CREATE OR REPLACE FUNCTION public.school_manager_save_schedule_entry(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_section_id uuid,
  p_teacher_membership_id uuid,
  p_subject_name text,
  p_weekday smallint,
  p_starts_at time,
  p_ends_at time,
  p_room_label text,
  p_effective_from date,
  p_effective_until date,
  p_status text,
  p_reason text,
  p_entry_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id uuid;
  v_actor uuid;
  v_before jsonb;
  v_after jsonb;
  v_entry public.school_schedule_entries%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_school_manager_or_admin(p_school_id) THEN
    RAISE EXCEPTION 'School Manager or School Admin access required';
  END IF;
  IF length(trim(COALESCE(p_reason,''))) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'A reason of at least 5 characters is required';
  END IF;
  IF p_weekday NOT BETWEEN 1 AND 7 OR p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at
     OR p_effective_from IS NULL OR (p_effective_until IS NOT NULL AND p_effective_until < p_effective_from)
     OR p_status NOT IN ('scheduled','cancelled') THEN
    RAISE EXCEPTION 'Schedule date, weekday, time, or status is invalid';
  END IF;
  IF length(trim(COALESCE(p_subject_name,''))) NOT BETWEEN 1 AND 120 OR length(COALESCE(p_room_label,'')) > 100 THEN
    RAISE EXCEPTION 'Subject or room is invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.school_academic_years year
    WHERE year.id = p_academic_year_id AND year.school_id = p_school_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.school_sections section
    WHERE section.id = p_section_id AND section.school_id = p_school_id
      AND section.academic_year_id = p_academic_year_id
  ) THEN
    RAISE EXCEPTION 'Choose a section and academic year belonging to this school';
  END IF;
  IF p_status = 'scheduled' AND NOT EXISTS (
    SELECT 1 FROM public.school_memberships teacher
    JOIN public.school_teacher_assignments assignment
      ON assignment.teacher_membership_id = teacher.id
     AND assignment.school_id = teacher.school_id
    WHERE teacher.id = p_teacher_membership_id
      AND teacher.school_id = p_school_id
      AND teacher.school_role = 'teacher'
      AND teacher.status = 'active'
      AND assignment.section_id = p_section_id
      AND assignment.assignment_kind = 'subject'
      AND lower(trim(assignment.subject_name)) = lower(trim(p_subject_name))
  ) THEN
    RAISE EXCEPTION 'The selected teacher must have an active assignment for this section and subject';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_school_id::text, 0));
  v_actor := public.school_my_membership_id(p_school_id);
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Active school manager membership required'; END IF;

  IF p_entry_id IS NOT NULL THEN
    SELECT to_jsonb(entry) INTO v_before
    FROM public.school_schedule_entries entry
    WHERE entry.id = p_entry_id AND entry.school_id = p_school_id
    FOR UPDATE;
    IF v_before IS NULL THEN RAISE EXCEPTION 'Schedule entry not found in this school'; END IF;
  END IF;

  IF p_status = 'scheduled' THEN
    IF EXISTS (
      SELECT 1 FROM public.school_schedule_entries entry
      WHERE entry.school_id = p_school_id AND entry.status = 'scheduled'
        AND entry.id IS DISTINCT FROM p_entry_id
        AND entry.weekday = p_weekday
        AND entry.effective_from <= COALESCE(p_effective_until, 'infinity'::date)
        AND COALESCE(entry.effective_until, 'infinity'::date) >= p_effective_from
        AND entry.starts_at < p_ends_at AND entry.ends_at > p_starts_at
        AND entry.teacher_membership_id = p_teacher_membership_id
    ) THEN RAISE EXCEPTION 'Teacher conflict: this teacher already has a lesson during that time'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.school_schedule_entries entry
      WHERE entry.school_id = p_school_id AND entry.status = 'scheduled'
        AND entry.id IS DISTINCT FROM p_entry_id
        AND entry.weekday = p_weekday
        AND entry.effective_from <= COALESCE(p_effective_until, 'infinity'::date)
        AND COALESCE(entry.effective_until, 'infinity'::date) >= p_effective_from
        AND entry.starts_at < p_ends_at AND entry.ends_at > p_starts_at
        AND entry.section_id = p_section_id
    ) THEN RAISE EXCEPTION 'Section conflict: this class already has a lesson during that time'; END IF;
    IF length(trim(COALESCE(p_room_label,''))) > 0 AND EXISTS (
      SELECT 1 FROM public.school_schedule_entries entry
      WHERE entry.school_id = p_school_id AND entry.status = 'scheduled'
        AND entry.id IS DISTINCT FROM p_entry_id
        AND entry.weekday = p_weekday
        AND entry.effective_from <= COALESCE(p_effective_until, 'infinity'::date)
        AND COALESCE(entry.effective_until, 'infinity'::date) >= p_effective_from
        AND entry.starts_at < p_ends_at AND entry.ends_at > p_starts_at
        AND lower(trim(entry.room_label)) = lower(trim(p_room_label))
    ) THEN RAISE EXCEPTION 'Room conflict: this room is already booked during that time'; END IF;
  END IF;

  IF p_entry_id IS NULL THEN
    INSERT INTO public.school_schedule_entries(
      school_id, academic_year_id, section_id, teacher_membership_id, subject_name,
      weekday, starts_at, ends_at, room_label, effective_from, effective_until,
      status, created_by_membership_id, updated_by_membership_id
    ) VALUES (
      p_school_id, p_academic_year_id, p_section_id, p_teacher_membership_id, trim(p_subject_name),
      p_weekday, p_starts_at, p_ends_at, trim(COALESCE(p_room_label,'')), p_effective_from, p_effective_until,
      p_status, v_actor, v_actor
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.school_schedule_entries SET
      academic_year_id=p_academic_year_id, section_id=p_section_id,
      teacher_membership_id=p_teacher_membership_id, subject_name=trim(p_subject_name),
      weekday=p_weekday, starts_at=p_starts_at, ends_at=p_ends_at,
      room_label=trim(COALESCE(p_room_label,'')), effective_from=p_effective_from,
      effective_until=p_effective_until, status=p_status,
      updated_by_membership_id=v_actor, updated_at=now()
    WHERE id=p_entry_id AND school_id=p_school_id
    RETURNING id INTO v_id;
  END IF;
  SELECT to_jsonb(entry) INTO v_after FROM public.school_schedule_entries entry WHERE entry.id=v_id;
  INSERT INTO public.school_operations_audit_events(
    school_id, actor_user_id, actor_membership_id, entity_type, entity_id,
    action_type, reason, before_state, after_state
  ) VALUES (
    p_school_id, auth.uid(), v_actor, 'schedule_entry', v_id,
    CASE WHEN p_entry_id IS NULL THEN 'created' ELSE 'updated' END,
    trim(p_reason), v_before, v_after
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_manager_save_calendar_event(
  p_school_id uuid,
  p_title text,
  p_description text,
  p_event_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_all_day boolean,
  p_location text,
  p_audience_type text,
  p_grade_label text,
  p_section_id uuid,
  p_status text,
  p_reason text,
  p_event_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id uuid;
  v_actor uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_school_manager_or_admin(p_school_id) THEN
    RAISE EXCEPTION 'School Manager or School Admin access required';
  END IF;
  IF length(trim(COALESCE(p_reason,''))) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'A reason of at least 5 characters is required';
  END IF;
  IF length(trim(COALESCE(p_title,''))) NOT BETWEEN 2 AND 180
    OR length(COALESCE(p_description,'')) > 4000
    OR length(COALESCE(p_location,'')) > 180
    OR p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at
    OR p_event_type NOT IN ('academic','exam','holiday','meeting','school_event','deadline','other')
    OR p_status NOT IN ('draft','published','cancelled')
    OR p_audience_type NOT IN ('school','grade','section') THEN
    RAISE EXCEPTION 'Calendar event details are invalid';
  END IF;
  IF p_audience_type = 'school' AND (p_grade_label IS NOT NULL OR p_section_id IS NOT NULL) THEN
    RAISE EXCEPTION 'School-wide events cannot have a grade or section filter';
  ELSIF p_audience_type = 'grade' AND (
    p_grade_label IS NULL OR length(trim(p_grade_label)) NOT BETWEEN 1 AND 80 OR p_section_id IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM public.school_sections section WHERE section.school_id=p_school_id AND section.grade_label=trim(p_grade_label))
  ) THEN
    RAISE EXCEPTION 'Choose a grade configured in this school';
  ELSIF p_audience_type = 'section' AND (
    p_section_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.school_sections section WHERE section.id=p_section_id AND section.school_id=p_school_id)
    OR p_grade_label IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Choose a section belonging to this school';
  END IF;

  v_actor := public.school_my_membership_id(p_school_id);
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Active school manager membership required'; END IF;
  IF p_event_id IS NOT NULL THEN
    SELECT to_jsonb(event) INTO v_before
    FROM public.school_calendar_events event
    WHERE event.id=p_event_id AND event.school_id=p_school_id
    FOR UPDATE;
    IF v_before IS NULL THEN RAISE EXCEPTION 'Calendar event not found in this school'; END IF;
    UPDATE public.school_calendar_events SET
      title=trim(p_title), description=COALESCE(p_description,''), event_type=p_event_type,
      starts_at=p_starts_at, ends_at=p_ends_at, all_day=COALESCE(p_all_day,false),
      location=trim(COALESCE(p_location,'')), audience_type=p_audience_type,
      grade_label=CASE WHEN p_audience_type='grade' THEN trim(p_grade_label) ELSE NULL END,
      section_id=CASE WHEN p_audience_type='section' THEN p_section_id ELSE NULL END,
      status=p_status, updated_by_membership_id=v_actor, updated_at=now()
    WHERE id=p_event_id AND school_id=p_school_id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.school_calendar_events(
      school_id,title,description,event_type,starts_at,ends_at,all_day,location,
      audience_type,grade_label,section_id,status,created_by_membership_id,updated_by_membership_id
    ) VALUES (
      p_school_id,trim(p_title),COALESCE(p_description,''),p_event_type,p_starts_at,p_ends_at,
      COALESCE(p_all_day,false),trim(COALESCE(p_location,'')),p_audience_type,
      CASE WHEN p_audience_type='grade' THEN trim(p_grade_label) ELSE NULL END,
      CASE WHEN p_audience_type='section' THEN p_section_id ELSE NULL END,
      p_status,v_actor,v_actor
    ) RETURNING id INTO v_id;
  END IF;
  SELECT to_jsonb(event) INTO v_after FROM public.school_calendar_events event WHERE event.id=v_id;
  INSERT INTO public.school_operations_audit_events(
    school_id,actor_user_id,actor_membership_id,entity_type,entity_id,
    action_type,reason,before_state,after_state
  ) VALUES (
    p_school_id,auth.uid(),v_actor,'calendar_event',v_id,
    CASE WHEN p_event_id IS NULL THEN 'created' ELSE 'updated' END,
    trim(p_reason),v_before,v_after
  );
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.school_manager_save_schedule_entry(uuid,uuid,uuid,uuid,text,smallint,time,time,text,date,date,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_manager_save_calendar_event(uuid,text,text,text,timestamptz,timestamptz,boolean,text,text,text,uuid,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_manager_save_schedule_entry(uuid,uuid,uuid,uuid,text,smallint,time,time,text,date,date,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_manager_save_calendar_event(uuid,text,text,text,timestamptz,timestamptz,boolean,text,text,text,uuid,text,text,uuid) TO authenticated;

COMMENT ON TABLE public.school_schedule_entries IS 'School-owned weekly timetable entries with teacher, section, room and effective-date conflict validation.';
COMMENT ON TABLE public.school_calendar_events IS 'School calendar events with draft/published/cancelled lifecycle and school, grade or section audiences.';
COMMENT ON TABLE public.school_operations_audit_events IS 'Append-only audit history for School Manager timetable and calendar changes.';
