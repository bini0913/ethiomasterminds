-- Division-specific leadership: each division has its own Vice Director.
-- Preserve any pre-existing school-wide Vice Director appointment as a legacy
-- appointment (division_scope IS NULL), while all new Vice Director appointments
-- must be assigned to exactly one division.
BEGIN;

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.school_leadership_appointments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%vice_director%'
      AND pg_get_constraintdef(oid) ILIKE '%division_scope%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.school_leadership_appointments DROP CONSTRAINT %I',
      constraint_row.conname
    );
  END LOOP;
END;
$$;

ALTER TABLE public.school_leadership_appointments
  ADD CONSTRAINT school_leadership_appointments_position_division_scope_check
  CHECK (
    (position = 'kg_director' AND division_scope = 'kg')
    OR (position = 'elementary_director' AND division_scope = 'elementary')
    OR (position = 'middle_school_director' AND division_scope = 'middle_school')
    OR (position = 'high_school_director' AND division_scope = 'high_school')
    OR (position = 'main_director' AND division_scope IS NULL)
    OR (position = 'vice_director' AND (division_scope IS NULL OR division_scope IN ('kg', 'elementary', 'middle_school', 'high_school')))
    OR (position = 'team_leader' AND division_scope IS NOT NULL)
  );

DROP INDEX IF EXISTS public.school_leadership_one_active_singleton_position;
CREATE UNIQUE INDEX school_leadership_one_active_singleton_position
  ON public.school_leadership_appointments(school_id, position)
  WHERE status = 'active' AND position NOT IN ('team_leader', 'vice_director');

CREATE UNIQUE INDEX IF NOT EXISTS school_leadership_one_active_vice_director_per_division
  ON public.school_leadership_appointments(school_id, division_scope)
  WHERE status = 'active' AND position = 'vice_director' AND division_scope IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS school_leadership_one_active_legacy_schoolwide_vice_director
  ON public.school_leadership_appointments(school_id)
  WHERE status = 'active' AND position = 'vice_director' AND division_scope IS NULL;

CREATE OR REPLACE FUNCTION public.school_appoint_leader(p_target_membership_id uuid, p_position text, p_division_scope text DEFAULT NULL::text, p_team_name text DEFAULT NULL::text, p_permissions text[] DEFAULT ARRAY[]::text[], p_start_date date DEFAULT CURRENT_DATE, p_end_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  IF p_position = 'main_director' AND v_target.school_role <> 'admin' THEN
    RAISE EXCEPTION 'The Main Director must use the existing School Admin membership';
  END IF;
  IF p_position <> 'main_director' AND v_target.school_role = 'admin' THEN
    RAISE EXCEPTION 'Only the Main Director may use the School Admin membership; appoint other leaders from Teacher or Finance accounts';
  END IF;

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
  IF p_position = 'main_director' AND p_division_scope IS NOT NULL THEN
    RAISE EXCEPTION 'Main Director is a school-wide position';
  END IF;
  IF p_position = 'vice_director' AND p_division_scope NOT IN ('kg', 'elementary', 'middle_school', 'high_school') THEN
    RAISE EXCEPTION 'Vice Directors must be assigned to one of the four school divisions';
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
$function$;

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
        WHEN appointment.position = 'main_director'
          OR (appointment.position = 'vice_director' AND appointment.division_scope IS NULL) THEN true
        WHEN appointment.position IN ('kg_director', 'elementary_director', 'middle_school_director', 'high_school_director', 'vice_director') THEN
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
                (
                  team_member.membership_id = p_target_membership_id
                  AND (
                    p_section_id IS NULL
                    OR EXISTS (
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
          FROM public.school_leadership_appointments division_appointment
          JOIN public.school_memberships division_membership
            ON division_membership.id = division_appointment.membership_id
           AND division_membership.school_id = division_appointment.school_id
          WHERE division_appointment.school_id = appointment.school_id
            AND division_appointment.position IN ('kg_director', 'elementary_director', 'middle_school_director', 'high_school_director')
            AND division_appointment.division_scope = appointment.division_scope
            AND division_appointment.status = 'active'
            AND division_appointment.start_date <= CURRENT_DATE
            AND (division_appointment.end_date IS NULL OR division_appointment.end_date >= CURRENT_DATE)
            AND division_membership.user_id = auth.uid()
            AND division_membership.status = 'active'
            AND appointment.position IN ('vice_director', 'team_leader')
            AND appointment.division_scope IS NOT NULL
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

REVOKE ALL ON FUNCTION public.school_appoint_leader(uuid, text, text, text, text[], date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_appoint_leader(uuid, text, text, text, text[], date, date) TO authenticated;

REVOKE ALL ON FUNCTION public.school_leadership_has_permission(uuid, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_leadership_has_permission(uuid, text, text, uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.school_can_view_leadership_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_leadership_appointment(uuid) TO authenticated;

COMMIT;
