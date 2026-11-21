-- School leadership appointments are school-level assignments, not global roles.
CREATE TABLE IF NOT EXISTS public.school_leadership_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL,
  position text NOT NULL CHECK (position IN (
    'main_director', 'vice_director', 'kg_director', 'elementary_director',
    'middle_school_director', 'high_school_director', 'team_leader'
  )),
  division_scope text CHECK (division_scope IN ('kg', 'elementary', 'middle_school', 'high_school')),
  team_name text CHECK (team_name IS NULL OR char_length(trim(team_name)) BETWEEN 2 AND 120),
  permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'ended')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  appointed_by_membership_id uuid NOT NULL,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (appointed_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  CHECK (end_date IS NULL OR end_date >= start_date),
  CHECK (
    (position = 'kg_director' AND division_scope = 'kg')
    OR (position = 'elementary_director' AND division_scope = 'elementary')
    OR (position = 'middle_school_director' AND division_scope = 'middle_school')
    OR (position = 'high_school_director' AND division_scope = 'high_school')
    OR (position IN ('main_director', 'vice_director') AND division_scope IS NULL)
    OR (position = 'team_leader' AND division_scope IS NOT NULL)
  ),
  CHECK ((position = 'team_leader' AND team_name IS NOT NULL) OR (position <> 'team_leader' AND team_name IS NULL)),
  CHECK (permissions <@ ARRAY[
    'view_students', 'view_staff', 'view_attendance', 'review_attendance',
    'view_academics', 'review_assessments', 'review_results', 'view_curriculum',
    'manage_team_tasks', 'assign_team_tasks', 'view_reports', 'publish_announcements',
    'view_discipline', 'review_discipline', 'view_finance_summary', 'manage_meetings'
  ]::text[])
);

CREATE UNIQUE INDEX IF NOT EXISTS school_leadership_one_active_singleton_position
  ON public.school_leadership_appointments(school_id, position)
  WHERE status = 'active' AND position <> 'team_leader';

CREATE UNIQUE INDEX IF NOT EXISTS school_leadership_one_active_team_assignment
  ON public.school_leadership_appointments(school_id, division_scope, lower(team_name))
  WHERE status = 'active' AND position = 'team_leader';

CREATE INDEX IF NOT EXISTS school_leadership_appointments_member_idx
  ON public.school_leadership_appointments(membership_id, status);

CREATE INDEX IF NOT EXISTS school_leadership_appointments_school_idx
  ON public.school_leadership_appointments(school_id, status, position);

CREATE TABLE IF NOT EXISTS public.school_leadership_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL REFERENCES public.school_leadership_appointments(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_membership_id uuid REFERENCES public.school_memberships(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('appointed', 'updated')),
  reason text,
  before_state jsonb,
  after_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_leadership_audit_school_idx
  ON public.school_leadership_audit_events(school_id, created_at DESC);

ALTER TABLE public.school_leadership_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_leadership_audit_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.school_can_view_leadership_appointment(p_appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_leadership_appointments appointment
    WHERE appointment.id = p_appointment_id
      AND (
        public.is_school_manager(appointment.school_id)
        OR EXISTS (
          SELECT 1 FROM public.school_memberships own_membership
          WHERE own_membership.id = appointment.membership_id
            AND own_membership.user_id = auth.uid()
            AND own_membership.status = 'active'
        )
        OR EXISTS (
          SELECT 1
          FROM public.school_leadership_appointments main_appointment
          JOIN public.school_memberships main_membership
            ON main_membership.id = main_appointment.membership_id
          WHERE main_appointment.school_id = appointment.school_id
            AND main_appointment.position = 'main_director'
            AND main_appointment.status = 'active'
            AND main_membership.user_id = auth.uid()
            AND main_membership.status = 'active'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_leadership_audit(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND public.is_school_manager(p_school_id);
$$;

DROP POLICY IF EXISTS school_leadership_appointments_read ON public.school_leadership_appointments;
CREATE POLICY school_leadership_appointments_read
  ON public.school_leadership_appointments
  FOR SELECT TO authenticated
  USING (public.school_can_view_leadership_appointment(id));

DROP POLICY IF EXISTS school_leadership_audit_read ON public.school_leadership_audit_events;
CREATE POLICY school_leadership_audit_read
  ON public.school_leadership_audit_events
  FOR SELECT TO authenticated
  USING (public.school_can_view_leadership_audit(school_id));

CREATE OR REPLACE FUNCTION public.school_audit_leadership_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_school_id uuid;
  v_appointment_id uuid;
  v_actor_membership_id uuid;
  v_reason text;
  v_before_state jsonb;
  v_after_state jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_school_id := NEW.school_id;
    v_appointment_id := NEW.id;
    v_reason := NEW.change_reason;
    v_before_state := NULL;
    v_after_state := to_jsonb(NEW);
  ELSE
    v_school_id := NEW.school_id;
    v_appointment_id := NEW.id;
    v_reason := NEW.change_reason;
    v_before_state := to_jsonb(OLD);
    v_after_state := to_jsonb(NEW);
  END IF;

  SELECT membership.id INTO v_actor_membership_id
  FROM public.school_memberships membership
  WHERE membership.school_id = v_school_id
    AND membership.user_id = auth.uid()
    AND membership.school_role = 'manager'
    AND membership.status = 'active'
  LIMIT 1;

  INSERT INTO public.school_leadership_audit_events (
    school_id, appointment_id, actor_user_id, actor_membership_id,
    event_type, reason, before_state, after_state
  ) VALUES (
    v_school_id,
    v_appointment_id,
    auth.uid(),
    v_actor_membership_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'appointed' ELSE 'updated' END,
    v_reason,
    v_before_state,
    v_after_state
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_leadership_appointment_audit ON public.school_leadership_appointments;
CREATE TRIGGER school_leadership_appointment_audit
  AFTER INSERT OR UPDATE ON public.school_leadership_appointments
  FOR EACH ROW EXECUTE FUNCTION public.school_audit_leadership_appointment();

CREATE OR REPLACE FUNCTION public.school_appoint_leader(
  p_target_membership_id uuid,
  p_position text,
  p_division_scope text DEFAULT NULL,
  p_team_name text DEFAULT NULL,
  p_permissions text[] DEFAULT ARRAY[]::text[],
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target public.school_memberships%ROWTYPE;
  v_actor public.school_memberships%ROWTYPE;
  v_appointment_id uuid;
  v_allowed_permissions text[] := ARRAY[
    'view_students', 'view_staff', 'view_attendance', 'review_attendance',
    'view_academics', 'review_assessments', 'review_results', 'view_curriculum',
    'manage_team_tasks', 'assign_team_tasks', 'view_reports', 'publish_announcements',
    'view_discipline', 'review_discipline', 'view_finance_summary', 'manage_meetings'
  ]::text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_target
  FROM public.school_memberships
  WHERE id = p_target_membership_id
    AND status = 'active'
    AND school_role IN ('admin', 'teacher', 'finance');
  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Choose an active Admin, Teacher, or Finance membership in a school you manage';
  END IF;

  SELECT * INTO v_actor
  FROM public.school_memberships
  WHERE school_id = v_target.school_id
    AND user_id = auth.uid()
    AND school_role = 'manager'
    AND status = 'active'
  LIMIT 1;
  IF v_actor.id IS NULL THEN RAISE EXCEPTION 'An active School Manager membership in the target school is required'; END IF;
  IF v_target.user_id = auth.uid() THEN RAISE EXCEPTION 'The School Manager cannot appoint themselves'; END IF;

  IF p_position NOT IN (
    'main_director', 'vice_director', 'kg_director', 'elementary_director',
    'middle_school_director', 'high_school_director', 'team_leader'
  ) THEN RAISE EXCEPTION 'Invalid leadership position'; END IF;

  IF p_position = 'kg_director' AND p_division_scope IS DISTINCT FROM 'kg'
    OR p_position = 'elementary_director' AND p_division_scope IS DISTINCT FROM 'elementary'
    OR p_position = 'middle_school_director' AND p_division_scope IS DISTINCT FROM 'middle_school'
    OR p_position = 'high_school_director' AND p_division_scope IS DISTINCT FROM 'high_school' THEN
    RAISE EXCEPTION 'Select the division that matches the director position';
  END IF;
  IF p_position IN ('main_director', 'vice_director') AND p_division_scope IS NOT NULL THEN
    RAISE EXCEPTION 'Main Director and Vice Director are school-wide positions';
  END IF;
  IF p_position = 'team_leader' AND (
    p_division_scope NOT IN ('kg', 'elementary', 'middle_school', 'high_school')
    OR nullif(trim(p_team_name), '') IS NULL
  ) THEN RAISE EXCEPTION 'Team Leaders require a valid division and team name'; END IF;

  IF p_end_date IS NOT NULL AND p_end_date < COALESCE(p_start_date, CURRENT_DATE) THEN
    RAISE EXCEPTION 'Appointment end date cannot precede its start date';
  END IF;
  IF NOT (COALESCE(p_permissions, ARRAY[]::text[]) <@ v_allowed_permissions) THEN
    RAISE EXCEPTION 'One or more permissions are not supported';
  END IF;

  INSERT INTO public.school_leadership_appointments (
    school_id, membership_id, position, division_scope, team_name,
    permissions, status, start_date, end_date, appointed_by_membership_id
  ) VALUES (
    v_actor.school_id, v_target.id, p_position, p_division_scope,
    CASE WHEN p_position = 'team_leader' THEN trim(p_team_name) ELSE NULL END,
    COALESCE(p_permissions, ARRAY[]::text[]), 'active',
    COALESCE(p_start_date, CURRENT_DATE), p_end_date, v_actor.id
  ) RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_update_leadership_appointment(
  p_appointment_id uuid,
  p_status text,
  p_end_date date DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appointment public.school_leadership_appointments%ROWTYPE;
  v_actor public.school_memberships%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_appointment
  FROM public.school_leadership_appointments
  WHERE id = p_appointment_id
  FOR UPDATE;
  IF v_appointment.id IS NULL THEN RAISE EXCEPTION 'Leadership appointment not found'; END IF;

  SELECT * INTO v_actor
  FROM public.school_memberships
  WHERE school_id = v_appointment.school_id
    AND user_id = auth.uid()
    AND school_role = 'manager'
    AND status = 'active'
  LIMIT 1;
  IF v_actor.id IS NULL THEN RAISE EXCEPTION 'Only the School Manager can change leadership appointments'; END IF;

  IF p_status NOT IN ('active', 'suspended', 'ended') THEN RAISE EXCEPTION 'Invalid appointment status'; END IF;
  IF p_status <> 'active' AND nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required to suspend or end an appointment';
  END IF;
  IF p_status = 'ended' AND COALESCE(p_end_date, CURRENT_DATE) < v_appointment.start_date THEN
    RAISE EXCEPTION 'Appointment end date cannot precede its start date';
  END IF;
  IF v_appointment.status = 'ended' AND p_status <> 'ended' THEN
    RAISE EXCEPTION 'Ended appointments are historical and cannot be reactivated; create a new appointment';
  END IF;

  UPDATE public.school_leadership_appointments
  SET status = p_status,
      end_date = CASE WHEN p_status = 'ended' THEN COALESCE(p_end_date, CURRENT_DATE) ELSE NULL END,
      change_reason = nullif(trim(p_reason), ''),
      updated_at = now()
  WHERE id = p_appointment_id;

  RETURN true;
END;
$$;

REVOKE ALL ON TABLE public.school_leadership_appointments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.school_leadership_appointments TO authenticated;
REVOKE ALL ON TABLE public.school_leadership_audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.school_leadership_audit_events TO authenticated;

REVOKE ALL ON FUNCTION public.school_can_view_leadership_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_leadership_appointment(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.school_can_view_leadership_audit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_leadership_audit(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.school_audit_leadership_appointment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_appoint_leader(uuid, text, text, text, text[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_appoint_leader(uuid, text, text, text, text[], date, date) TO authenticated;
REVOKE ALL ON FUNCTION public.school_update_leadership_appointment(uuid, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_update_leadership_appointment(uuid, text, date, text) TO authenticated;


-- A school configures its own grade-to-division mapping; no grade assumptions are hardcoded.
CREATE UNIQUE INDEX IF NOT EXISTS school_leadership_appointments_id_school_idx
  ON public.school_leadership_appointments(id, school_id);

CREATE TABLE IF NOT EXISTS public.school_division_grade_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  division_scope text NOT NULL CHECK (division_scope IN ('kg', 'elementary', 'middle_school', 'high_school')),
  grade_label text NOT NULL CHECK (char_length(trim(grade_label)) BETWEEN 1 AND 80),
  created_by_membership_id uuid NOT NULL,
  updated_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, grade_label),
  FOREIGN KEY (created_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (updated_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.school_leadership_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  assigned_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, membership_id),
  FOREIGN KEY (appointment_id, school_id)
    REFERENCES public.school_leadership_appointments(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.school_leadership_structure_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_membership_id uuid REFERENCES public.school_memberships(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'division_grade_mapped', 'division_grade_unmapped',
    'team_member_assigned', 'team_member_removed'
  )),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_division_grade_mappings_school_idx
  ON public.school_division_grade_mappings(school_id, division_scope, grade_label);
CREATE INDEX IF NOT EXISTS school_leadership_team_members_appointment_idx
  ON public.school_leadership_team_members(appointment_id, created_at);
CREATE INDEX IF NOT EXISTS school_leadership_structure_events_school_idx
  ON public.school_leadership_structure_events(school_id, created_at DESC);

ALTER TABLE public.school_division_grade_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_leadership_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_leadership_structure_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.school_can_view_division_grade_mapping(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (public.is_active_school_member(p_school_id, NULL::text[]) OR public._is_extreme_admin());
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_leadership_team_member(p_assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_leadership_team_members assignment
    WHERE assignment.id = p_assignment_id
      AND public.school_can_view_leadership_appointment(assignment.appointment_id)
  );
$$;

DROP POLICY IF EXISTS school_division_grade_mappings_read ON public.school_division_grade_mappings;
CREATE POLICY school_division_grade_mappings_read
  ON public.school_division_grade_mappings
  FOR SELECT TO authenticated
  USING (public.school_can_view_division_grade_mapping(school_id));

DROP POLICY IF EXISTS school_leadership_team_members_read ON public.school_leadership_team_members;
CREATE POLICY school_leadership_team_members_read
  ON public.school_leadership_team_members
  FOR SELECT TO authenticated
  USING (public.school_can_view_leadership_team_member(id));

DROP POLICY IF EXISTS school_leadership_structure_events_read ON public.school_leadership_structure_events;
CREATE POLICY school_leadership_structure_events_read
  ON public.school_leadership_structure_events
  FOR SELECT TO authenticated
  USING (public.is_school_manager(school_id));

CREATE OR REPLACE FUNCTION public.school_set_division_grade_mapping(
  p_school_id uuid,
  p_grade_label text,
  p_division_scope text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor public.school_memberships%ROWTYPE;
  v_grade text := nullif(trim(p_grade_label), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_grade IS NULL THEN RAISE EXCEPTION 'Grade label is required'; END IF;

  SELECT * INTO v_actor
  FROM public.school_memberships
  WHERE school_id = p_school_id
    AND user_id = auth.uid()
    AND school_role = 'manager'
    AND status = 'active'
  LIMIT 1;
  IF v_actor.id IS NULL THEN RAISE EXCEPTION 'An active School Manager membership in this school is required'; END IF;

  IF p_division_scope IS NULL THEN
    DELETE FROM public.school_division_grade_mappings
    WHERE school_id = v_actor.school_id AND grade_label = v_grade;
    INSERT INTO public.school_leadership_structure_events (
      school_id, actor_user_id, actor_membership_id, event_type, details
    ) VALUES (
      v_actor.school_id, auth.uid(), v_actor.id, 'division_grade_unmapped',
      jsonb_build_object('grade_label', v_grade)
    );
    RETURN true;
  END IF;

  IF p_division_scope NOT IN ('kg', 'elementary', 'middle_school', 'high_school') THEN
    RAISE EXCEPTION 'Invalid school division';
  END IF;

  INSERT INTO public.school_division_grade_mappings (
    school_id, division_scope, grade_label, created_by_membership_id, updated_by_membership_id
  ) VALUES (
    v_actor.school_id, p_division_scope, v_grade, v_actor.id, v_actor.id
  )
  ON CONFLICT (school_id, grade_label) DO UPDATE
  SET division_scope = EXCLUDED.division_scope,
      updated_by_membership_id = EXCLUDED.updated_by_membership_id,
      updated_at = now();

  INSERT INTO public.school_leadership_structure_events (
    school_id, actor_user_id, actor_membership_id, event_type, details
  ) VALUES (
    v_actor.school_id, auth.uid(), v_actor.id, 'division_grade_mapped',
    jsonb_build_object('grade_label', v_grade, 'division_scope', p_division_scope)
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_assign_leadership_team_member(
  p_appointment_id uuid,
  p_target_membership_id uuid,
  p_assign boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appointment public.school_leadership_appointments%ROWTYPE;
  v_target public.school_memberships%ROWTYPE;
  v_actor public.school_memberships%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_appointment
  FROM public.school_leadership_appointments
  WHERE id = p_appointment_id AND position = 'team_leader' AND status = 'active';
  IF v_appointment.id IS NULL THEN RAISE EXCEPTION 'An active Team Leader appointment is required'; END IF;

  SELECT * INTO v_actor
  FROM public.school_memberships
  WHERE school_id = v_appointment.school_id
    AND user_id = auth.uid()
    AND school_role = 'manager'
    AND status = 'active'
  LIMIT 1;
  IF v_actor.id IS NULL THEN RAISE EXCEPTION 'Only the School Manager can manage team membership'; END IF;

  SELECT * INTO v_target
  FROM public.school_memberships
  WHERE id = p_target_membership_id
    AND school_id = v_appointment.school_id
    AND status = 'active'
    AND school_role IN ('admin', 'teacher', 'finance');
  IF v_target.id IS NULL THEN RAISE EXCEPTION 'Choose active staff from this school'; END IF;

  IF p_assign THEN
    INSERT INTO public.school_leadership_team_members (
      school_id, appointment_id, membership_id, assigned_by_membership_id
    ) VALUES (
      v_appointment.school_id, v_appointment.id, v_target.id, v_actor.id
    ) ON CONFLICT (appointment_id, membership_id) DO NOTHING;
    INSERT INTO public.school_leadership_structure_events (
      school_id, actor_user_id, actor_membership_id, event_type, details
    ) VALUES (
      v_appointment.school_id, auth.uid(), v_actor.id, 'team_member_assigned',
      jsonb_build_object('appointment_id', v_appointment.id, 'membership_id', v_target.id)
    );
  ELSE
    DELETE FROM public.school_leadership_team_members
    WHERE appointment_id = v_appointment.id AND membership_id = v_target.id;
    INSERT INTO public.school_leadership_structure_events (
      school_id, actor_user_id, actor_membership_id, event_type, details
    ) VALUES (
      v_appointment.school_id, auth.uid(), v_actor.id, 'team_member_removed',
      jsonb_build_object('appointment_id', v_appointment.id, 'membership_id', v_target.id)
    );
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON TABLE public.school_division_grade_mappings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.school_division_grade_mappings TO authenticated;
REVOKE ALL ON TABLE public.school_leadership_team_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.school_leadership_team_members TO authenticated;
REVOKE ALL ON TABLE public.school_leadership_structure_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.school_leadership_structure_events TO authenticated;

REVOKE ALL ON FUNCTION public.school_can_view_division_grade_mapping(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_division_grade_mapping(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.school_can_view_leadership_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_leadership_team_member(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.school_set_division_grade_mapping(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_set_division_grade_mapping(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.school_assign_leadership_team_member(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_assign_leadership_team_member(uuid, uuid, boolean) TO authenticated;


-- Shared server-side permission resolver for role-specific leadership read scopes.
-- It never trusts a client-supplied school alone: the active appointment and
-- school membership must belong to auth.uid(), and division/team scope is resolved
-- against school-owned mapping and assignment records.
CREATE OR REPLACE FUNCTION public.school_leadership_has_permission(
  p_school_id uuid,
  p_permission text,
  p_grade_label text DEFAULT NULL,
  p_target_membership_id uuid DEFAULT NULL,
  p_section_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_leadership_appointments appointment
    JOIN public.school_memberships leader
      ON leader.id = appointment.membership_id
     AND leader.school_id = appointment.school_id
    LEFT JOIN public.school_memberships target
      ON target.id = p_target_membership_id
     AND target.school_id = p_school_id
    LEFT JOIN public.school_sections requested_section
      ON requested_section.id = p_section_id
     AND requested_section.school_id = p_school_id
    WHERE appointment.school_id = p_school_id
      AND leader.user_id = auth.uid()
      AND leader.status = 'active'
      AND appointment.status = 'active'
      AND appointment.start_date <= CURRENT_DATE
      AND (appointment.end_date IS NULL OR appointment.end_date >= CURRENT_DATE)
      AND p_permission = ANY(appointment.permissions)
      AND CASE
        WHEN appointment.position IN ('main_director', 'vice_director') THEN true
        WHEN appointment.position IN ('kg_director', 'elementary_director', 'middle_school_director', 'high_school_director') THEN
          EXISTS (
            SELECT 1
            FROM public.school_division_grade_mappings mapping
            WHERE mapping.school_id = appointment.school_id
              AND mapping.division_scope = appointment.division_scope
              AND mapping.grade_label = COALESCE(
                p_grade_label,
                target.grade_label,
                requested_section.grade_label
              )
          )
          OR (
            p_target_membership_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.school_teacher_assignments assignment
              JOIN public.school_sections section
                ON section.id = assignment.section_id
               AND section.school_id = assignment.school_id
              JOIN public.school_division_grade_mappings mapping
                ON mapping.school_id = section.school_id
               AND mapping.grade_label = section.grade_label
               AND mapping.division_scope = appointment.division_scope
              WHERE assignment.school_id = appointment.school_id
                AND assignment.teacher_membership_id = p_target_membership_id
            )
          )
        WHEN appointment.position = 'team_leader' THEN
          EXISTS (
            SELECT 1
            FROM public.school_leadership_team_members team_member
            WHERE team_member.appointment_id = appointment.id
              AND team_member.school_id = appointment.school_id
              AND (
                team_member.membership_id = p_target_membership_id
                OR (
                  target.school_role = 'student'
                  AND target.section_id IS NOT NULL
                  AND EXISTS (
                    SELECT 1
                    FROM public.school_teacher_assignments assignment
                    JOIN public.school_sections team_section
                      ON team_section.id = assignment.section_id
                     AND team_section.school_id = assignment.school_id
                    JOIN public.school_division_grade_mappings team_mapping
                      ON team_mapping.school_id = team_section.school_id
                     AND team_mapping.grade_label = team_section.grade_label
                     AND team_mapping.division_scope = appointment.division_scope
                    WHERE assignment.school_id = appointment.school_id
                      AND assignment.teacher_membership_id = team_member.membership_id
                      AND assignment.section_id = target.section_id
                      AND (p_section_id IS NULL OR p_section_id = assignment.section_id)
                  )
                )
                OR (
                  p_target_membership_id IS NULL
                  AND p_section_id IS NOT NULL
                  AND EXISTS (
                    SELECT 1
                    FROM public.school_teacher_assignments assignment
                    JOIN public.school_sections team_section
                      ON team_section.id = assignment.section_id
                     AND team_section.school_id = assignment.school_id
                    JOIN public.school_division_grade_mappings team_mapping
                      ON team_mapping.school_id = team_section.school_id
                     AND team_mapping.grade_label = team_section.grade_label
                     AND team_mapping.division_scope = appointment.division_scope
                    WHERE assignment.school_id = appointment.school_id
                      AND assignment.teacher_membership_id = team_member.membership_id
                      AND assignment.section_id = p_section_id
                  )
                )
              )
          )
        ELSE false
      END
  );
$$;

REVOKE ALL ON FUNCTION public.school_leadership_has_permission(uuid, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_leadership_has_permission(uuid, text, text, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS school_leadership_view_scoped_memberships ON public.school_memberships;
CREATE POLICY school_leadership_view_scoped_memberships
  ON public.school_memberships
  FOR SELECT TO authenticated
  USING (
    (school_memberships.school_role = 'student' AND public.school_leadership_has_permission(
      school_memberships.school_id, 'view_students', school_memberships.grade_label,
      school_memberships.id, school_memberships.section_id
    ))
    OR (school_memberships.school_role IN ('admin', 'teacher', 'finance') AND public.school_leadership_has_permission(
      school_memberships.school_id, 'view_staff', school_memberships.grade_label,
      school_memberships.id, school_memberships.section_id
    ))
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_sections ON public.school_sections;
CREATE POLICY school_leadership_view_scoped_sections
  ON public.school_sections
  FOR SELECT TO authenticated
  USING (
    public.school_leadership_has_permission(
      school_sections.school_id, 'view_students', school_sections.grade_label, NULL, school_sections.id
    )
    OR public.school_leadership_has_permission(
      school_sections.school_id, 'view_curriculum', school_sections.grade_label, NULL, school_sections.id
    )
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_teacher_assignments ON public.school_teacher_assignments;
CREATE POLICY school_leadership_view_scoped_teacher_assignments
  ON public.school_teacher_assignments
  FOR SELECT TO authenticated
  USING (
    public.school_leadership_has_permission(
      school_teacher_assignments.school_id, 'view_staff',
      (SELECT section.grade_label FROM public.school_sections section
       WHERE section.id = school_teacher_assignments.section_id
         AND section.school_id = school_teacher_assignments.school_id),
      school_teacher_assignments.teacher_membership_id,
      school_teacher_assignments.section_id
    )
    OR public.school_leadership_has_permission(
      school_teacher_assignments.school_id, 'view_curriculum',
      (SELECT section.grade_label FROM public.school_sections section
       WHERE section.id = school_teacher_assignments.section_id
         AND section.school_id = school_teacher_assignments.school_id),
      school_teacher_assignments.teacher_membership_id,
      school_teacher_assignments.section_id
    )
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_attendance_sessions ON public.school_attendance_sessions;
CREATE POLICY school_leadership_view_scoped_attendance_sessions
  ON public.school_attendance_sessions
  FOR SELECT TO authenticated
  USING (
    public.school_leadership_has_permission(
      school_attendance_sessions.school_id, 'view_attendance',
      (SELECT section.grade_label FROM public.school_sections section
       WHERE section.id = school_attendance_sessions.section_id
         AND section.school_id = school_attendance_sessions.school_id),
      NULL,
      school_attendance_sessions.section_id
    )
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_attendance_records ON public.school_attendance_records;
CREATE POLICY school_leadership_view_scoped_attendance_records
  ON public.school_attendance_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.school_attendance_sessions session
      JOIN public.school_sections section
        ON section.id = session.section_id
       AND section.school_id = session.school_id
      WHERE session.id = school_attendance_records.session_id
        AND session.school_id = school_attendance_records.school_id
        AND public.school_leadership_has_permission(
          school_attendance_records.school_id, 'view_attendance', section.grade_label,
          school_attendance_records.student_membership_id, session.section_id
        )
    )
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_assessments ON public.school_assessments;
CREATE POLICY school_leadership_view_scoped_assessments
  ON public.school_assessments
  FOR SELECT TO authenticated
  USING (
    public.school_leadership_has_permission(
      school_assessments.school_id, 'view_academics',
      (SELECT section.grade_label FROM public.school_sections section
       WHERE section.id = school_assessments.section_id
         AND section.school_id = school_assessments.school_id),
      NULL, school_assessments.section_id
    )
    OR public.school_leadership_has_permission(
      school_assessments.school_id, 'review_assessments',
      (SELECT section.grade_label FROM public.school_sections section
       WHERE section.id = school_assessments.section_id
         AND section.school_id = school_assessments.school_id),
      NULL, school_assessments.section_id
    )
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_marks ON public.school_student_marks;
CREATE POLICY school_leadership_view_scoped_marks
  ON public.school_student_marks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.school_assessments assessment
      JOIN public.school_sections section
        ON section.id = assessment.section_id
       AND section.school_id = assessment.school_id
      WHERE assessment.id = school_student_marks.assessment_id
        AND assessment.school_id = school_student_marks.school_id
        AND (
          public.school_leadership_has_permission(
            school_student_marks.school_id, 'view_academics', section.grade_label,
            school_student_marks.student_membership_id, section.id
          )
          OR public.school_leadership_has_permission(
            school_student_marks.school_id, 'review_results', section.grade_label,
            school_student_marks.student_membership_id, section.id
          )
        )
    )
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_behavior_reports ON public.school_behavior_reports;
CREATE POLICY school_leadership_view_scoped_behavior_reports
  ON public.school_behavior_reports
  FOR SELECT TO authenticated
  USING (
    public.school_leadership_has_permission(
      school_behavior_reports.school_id, 'view_discipline',
      (SELECT section.grade_label FROM public.school_sections section
       WHERE section.id = school_behavior_reports.section_id
         AND section.school_id = school_behavior_reports.school_id),
      school_behavior_reports.student_membership_id,
      school_behavior_reports.section_id
    )
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_homework ON public.school_homework_assignments;
CREATE POLICY school_leadership_view_scoped_homework
  ON public.school_homework_assignments
  FOR SELECT TO authenticated
  USING (
    public.school_leadership_has_permission(
      school_homework_assignments.school_id, 'view_academics',
      (SELECT section.grade_label FROM public.school_sections section
       WHERE section.id = school_homework_assignments.section_id
         AND section.school_id = school_homework_assignments.school_id),
      NULL,
      school_homework_assignments.section_id
    )
  );

DROP POLICY IF EXISTS school_leadership_view_scoped_staff_tasks ON public.school_staff_tasks;
CREATE POLICY school_leadership_view_scoped_staff_tasks
  ON public.school_staff_tasks
  FOR SELECT TO authenticated
  USING (
    public.school_leadership_has_permission(
      school_staff_tasks.school_id, 'manage_team_tasks', NULL,
      school_staff_tasks.assigned_to_membership_id, NULL
    )
    OR public.school_leadership_has_permission(
      school_staff_tasks.school_id, 'assign_team_tasks', NULL,
      school_staff_tasks.assigned_to_membership_id, NULL
    )
  );
