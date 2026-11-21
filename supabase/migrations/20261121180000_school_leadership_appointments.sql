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

CREATE POLICY school_leadership_appointments_read
  ON public.school_leadership_appointments
  FOR SELECT TO authenticated
  USING (public.school_can_view_leadership_appointment(id));

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
BEGIN
  v_school_id := COALESCE(NEW.school_id, OLD.school_id);
  v_appointment_id := COALESCE(NEW.id, OLD.id);
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
    COALESCE(NEW.change_reason, OLD.change_reason),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

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

  SELECT * INTO v_actor
  FROM public.school_memberships
  WHERE user_id = auth.uid() AND school_role = 'manager' AND status = 'active'
  ORDER BY created_at
  LIMIT 1;
  IF v_actor.id IS NULL THEN RAISE EXCEPTION 'An active School Manager membership is required'; END IF;

  SELECT * INTO v_target
  FROM public.school_memberships
  WHERE id = p_target_membership_id
    AND school_id = v_actor.school_id
    AND status = 'active'
    AND school_role IN ('admin', 'teacher', 'finance');
  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Choose an active Admin, Teacher, or Finance membership in this school';
  END IF;
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
  IF COALESCE(p_permissions, ARRAY[]::text[]) - v_allowed_permissions <> ARRAY[]::text[] THEN
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
