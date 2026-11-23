-- Enforce one school portal identity for platform-level authorities.
-- Super Admin is exclusively the school-network portal; Extreme Admin is the
-- highest platform authority. Neither can be given an active school membership
-- or school leadership appointment by a School Manager.
BEGIN;

LOCK TABLE public.user_roles IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.school_memberships IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.school_leadership_appointments IN SHARE ROW EXCLUSIVE MODE;

-- Preserve history while removing active school access from existing platform authorities.
UPDATE public.school_leadership_appointments appointment
SET status = 'ended',
    end_date = GREATEST(CURRENT_DATE, appointment.start_date),
    change_reason = concat_ws(
      E'\n',
      nullif(appointment.change_reason, ''),
      'Ended automatically because this account holds a platform-level authority role and cannot occupy a school portal.'
    )
FROM public.school_memberships membership
JOIN public.user_roles platform_role
  ON platform_role.user_id = membership.user_id
 AND platform_role.role IN ('super_admin'::public.app_role, 'extreme_admin'::public.app_role)
WHERE appointment.membership_id = membership.id
  AND appointment.school_id = membership.school_id
  AND appointment.status = 'active';

UPDATE public.school_memberships membership
SET status = 'suspended',
    end_reason = 'Suspended automatically because this account holds a platform-level authority role and cannot occupy a school portal.'
WHERE membership.status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles platform_role
    WHERE platform_role.user_id = membership.user_id
      AND platform_role.role IN ('super_admin'::public.app_role, 'extreme_admin'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.school_reject_platform_authority_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.status = 'active'
     AND EXISTS (
       SELECT 1
       FROM public.user_roles platform_role
       WHERE platform_role.user_id = NEW.user_id
         AND platform_role.role IN (
           'super_admin'::public.app_role,
           'extreme_admin'::public.app_role
         )
     ) THEN
    RAISE EXCEPTION 'Platform authority accounts cannot receive active school memberships';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS school_reject_platform_authority_membership ON public.school_memberships;
CREATE TRIGGER school_reject_platform_authority_membership
BEFORE INSERT OR UPDATE ON public.school_memberships
FOR EACH ROW
EXECUTE FUNCTION public.school_reject_platform_authority_membership();

CREATE OR REPLACE FUNCTION public.user_roles_reject_platform_authority_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.role IN (
    'super_admin'::public.app_role,
    'extreme_admin'::public.app_role
  ) AND EXISTS (
    SELECT 1
    FROM public.school_memberships membership
    WHERE membership.user_id = NEW.user_id
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'An account with an active school membership cannot become a platform authority; suspend its school access first';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS user_roles_reject_platform_authority_membership ON public.user_roles;
CREATE TRIGGER user_roles_reject_platform_authority_membership
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.user_roles_reject_platform_authority_membership();

CREATE OR REPLACE FUNCTION public.school_reject_platform_authority_appointment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT membership.user_id
    INTO v_user_id
    FROM public.school_memberships membership
    WHERE membership.id = NEW.membership_id
      AND membership.school_id = NEW.school_id
      AND membership.status = 'active';

    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'An active leadership appointment requires an active school membership';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.user_roles platform_role
      WHERE platform_role.user_id = v_user_id
        AND platform_role.role IN (
          'super_admin'::public.app_role,
          'extreme_admin'::public.app_role
        )
    ) THEN
      RAISE EXCEPTION 'Platform authority accounts cannot receive school leadership appointments';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS school_reject_platform_authority_appointment ON public.school_leadership_appointments;
CREATE TRIGGER school_reject_platform_authority_appointment
BEFORE INSERT OR UPDATE ON public.school_leadership_appointments
FOR EACH ROW
EXECUTE FUNCTION public.school_reject_platform_authority_appointment();

-- This helper hides top-level authority identities only from users who would
-- otherwise be entitled to view the target membership. Extreme Admin retains
-- full visibility; the helper cannot be used as a cross-school role oracle.
CREATE OR REPLACE FUNCTION public._school_is_platform_authority_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.user_roles platform_role
    WHERE platform_role.user_id = p_user_id
      AND platform_role.role IN (
        'super_admin'::public.app_role,
        'extreme_admin'::public.app_role
      )
  );
$function$;

-- Internal detector is only called from security-definer visibility functions.
-- Do not expose a direct platform-role lookup to authenticated school users.
REVOKE ALL ON FUNCTION public._school_is_platform_authority_user(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.school_can_view_membership(p_membership_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_memberships target
    WHERE target.id = p_membership_id
      AND (public._is_extreme_admin() OR NOT public._school_is_platform_authority_user(target.user_id))
      AND (
        target.user_id = auth.uid()
        OR public._is_extreme_admin()
        OR public._is_super_admin()
        OR public.is_school_manager_or_admin(target.school_id)
        OR (
          target.school_role = 'student'
          AND EXISTS (
            SELECT 1
            FROM public.school_memberships teacher
            JOIN public.school_teacher_assignments assignment
              ON assignment.teacher_membership_id = teacher.id
             AND assignment.school_id = teacher.school_id
            WHERE teacher.user_id = auth.uid()
              AND teacher.school_id = target.school_id
              AND teacher.school_role = 'teacher'
              AND teacher.status = 'active'
              AND assignment.section_id = target.section_id
              AND target.status IN ('active', 'suspended')
          )
        )
        OR (
          target.school_role = 'student'
          AND EXISTS (
            SELECT 1
            FROM public.school_parent_student_links link
            JOIN public.school_memberships parent
              ON parent.id = link.parent_membership_id
            WHERE link.student_membership_id = target.id
              AND link.status = 'active'
              AND parent.user_id = auth.uid()
              AND parent.school_role = 'parent'
              AND parent.status = 'active'
          )
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.school_can_view_leadership_appointment(p_appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_leadership_appointments appointment
    WHERE appointment.id = p_appointment_id
      AND (
        public._is_extreme_admin()
        OR NOT EXISTS (
          SELECT 1
          FROM public.school_memberships authority_membership
          WHERE authority_membership.id = appointment.membership_id
            AND public._school_is_platform_authority_user(authority_membership.user_id)
        )
      )
      AND (
        public.is_school_manager(appointment.school_id)
        OR EXISTS (
          SELECT 1
          FROM public.school_memberships own_membership
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
          FROM public.school_leadership_appointments academic_appointment
          JOIN public.school_memberships academic_membership
            ON academic_membership.id = academic_appointment.membership_id
           AND academic_membership.school_id = academic_appointment.school_id
          WHERE academic_appointment.school_id = appointment.school_id
            AND academic_appointment.position = 'academic_director'
            AND academic_appointment.status = 'active'
            AND academic_appointment.start_date <= CURRENT_DATE
            AND (academic_appointment.end_date IS NULL OR academic_appointment.end_date >= CURRENT_DATE)
            AND academic_membership.user_id = auth.uid()
            AND academic_membership.status = 'active'
            AND appointment.position IN (
              'kg_director', 'elementary_director', 'middle_school_director',
              'high_school_director', 'vice_director', 'team_leader'
            )
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.school_can_view_scoped_leadership_membership(p_membership_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    public._is_extreme_admin()
    OR EXISTS (
      SELECT 1
      FROM public.school_memberships target
      WHERE target.id = p_membership_id
        AND NOT public._school_is_platform_authority_user(target.user_id)
        AND (
        (
          target.school_role = 'student'
          AND (
            public.school_leadership_has_permission(target.school_id, 'view_students', target.grade_label, target.id, target.section_id)
            OR public.school_leadership_has_permission(target.school_id, 'view_discipline', target.grade_label, target.id, target.section_id)
            OR public.school_leadership_has_permission(target.school_id, 'review_discipline', target.grade_label, target.id, target.section_id)
            OR public.school_leadership_has_permission(target.school_id, 'view_attendance', target.grade_label, target.id, target.section_id)
            OR public.school_leadership_has_permission(target.school_id, 'review_attendance', target.grade_label, target.id, target.section_id)
            OR public.school_leadership_has_permission(target.school_id, 'view_academics', target.grade_label, target.id, target.section_id)
            OR public.school_leadership_has_permission(target.school_id, 'review_results', target.grade_label, target.id, target.section_id)
          )
        )
        OR (
          target.school_role = ANY (ARRAY['admin', 'teacher', 'finance']::text[])
          AND (
            public.school_leadership_has_permission(target.school_id, 'view_staff', target.grade_label, target.id, target.section_id)
            OR public.school_leadership_has_permission(target.school_id, 'manage_team_tasks', target.grade_label, target.id, target.section_id)
            OR public.school_leadership_has_permission(target.school_id, 'assign_team_tasks', target.grade_label, target.id, target.section_id)
          )
        )
      )
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.school_can_view_scoped_leadership_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_scoped_leadership_membership(uuid) TO authenticated;

DROP POLICY IF EXISTS school_memberships_manager_update ON public.school_memberships;
CREATE POLICY school_memberships_manager_update
ON public.school_memberships
FOR UPDATE
USING (
  public._is_extreme_admin()
  OR (
    public.is_school_manager_or_admin(school_id)
    AND public.school_can_view_membership(id)
  )
)
WITH CHECK (
  public._is_extreme_admin()
  OR (
    public.is_school_manager_or_admin(school_id)
    AND public.school_can_view_membership(id)
  )
);

DROP POLICY IF EXISTS school_leadership_view_scoped_memberships ON public.school_memberships;
CREATE POLICY school_leadership_view_scoped_memberships
ON public.school_memberships
FOR SELECT
USING (public.school_can_view_scoped_leadership_membership(id));

COMMIT;
