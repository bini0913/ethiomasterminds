-- School Management System: tenant and enrollment foundation.
-- Existing individual-learning data remains separate. School data is always scoped
-- through an explicit school membership; no existing global student data is copied.
CREATE TABLE IF NOT EXISTS public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  school_code text NOT NULL UNIQUE
    CHECK (school_code = upper(school_code) AND school_code ~ '^[A-Z0-9]{2,8}$'),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'closed')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.school_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  school_role text NOT NULL
    CHECK (school_role IN ('manager', 'admin', 'teacher', 'finance', 'parent', 'student')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deactivated', 'transferred', 'graduated')),
  grade_label text,
  section_id uuid,
  student_number bigint,
  school_username text UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, school_role),
  UNIQUE (id, school_id),
  CHECK (
    (school_role = 'student' AND (student_number IS NOT NULL OR status <> 'active'))
    OR school_role <> 'student'
  ),
  CHECK ((status IN ('active', 'suspended') AND ended_at IS NULL)
      OR (status IN ('deactivated', 'transferred', 'graduated') AND ended_at IS NOT NULL))
);

-- A student may be actively enrolled in only one school at a time.
CREATE UNIQUE INDEX IF NOT EXISTS school_one_active_student_enrollment
  ON public.school_memberships(user_id)
  WHERE school_role = 'student' AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS school_student_number_unique
  ON public.school_memberships(school_id, grade_label, student_number)
  WHERE school_role = 'student' AND student_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS school_memberships_school_role_status_idx
  ON public.school_memberships(school_id, school_role, status);

CREATE INDEX IF NOT EXISTS school_memberships_user_status_idx
  ON public.school_memberships(user_id, status);

CREATE TABLE IF NOT EXISTS public.school_academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on),
  UNIQUE (school_id, name),
  UNIQUE (id, school_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS school_single_current_academic_year
  ON public.school_academic_years(school_id)
  WHERE is_current = true;

CREATE TABLE IF NOT EXISTS public.school_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  academic_year_id uuid NOT NULL REFERENCES public.school_academic_years(id) ON DELETE RESTRICT,
  grade_label text NOT NULL,
  section_name text NOT NULL,
  homeroom_teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year_id, grade_label, section_name),
  UNIQUE (id, school_id),
  FOREIGN KEY (academic_year_id, school_id)
    REFERENCES public.school_academic_years(id, school_id) ON DELETE RESTRICT
);

ALTER TABLE public.school_memberships
  ADD CONSTRAINT school_membership_section_same_school_fk
  FOREIGN KEY (section_id, school_id)
  REFERENCES public.school_sections(id, school_id)
  ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.school_teacher_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  teacher_membership_id uuid NOT NULL,
  section_id uuid NOT NULL,
  subject_name text NOT NULL,
  assignment_kind text NOT NULL DEFAULT 'subject'
    CHECK (assignment_kind IN ('subject', 'homeroom')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (teacher_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  UNIQUE (teacher_membership_id, section_id, subject_name, assignment_kind)
);

CREATE TABLE IF NOT EXISTS public.school_parent_student_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  parent_membership_id uuid NOT NULL,
  student_membership_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deactivated')),
  linked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE (parent_membership_id, student_membership_id),
  FOREIGN KEY (parent_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (student_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  CHECK ((status = 'active' AND ended_at IS NULL) OR (status = 'deactivated' AND ended_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS school_parent_links_parent_idx
  ON public.school_parent_student_links(parent_membership_id, status);
CREATE INDEX IF NOT EXISTS school_parent_links_student_idx
  ON public.school_parent_student_links(student_membership_id, status);

CREATE TABLE IF NOT EXISTS public.school_student_id_sequences (
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  grade_label text NOT NULL,
  next_number bigint NOT NULL DEFAULT 1 CHECK (next_number > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, grade_label)
);

CREATE TABLE IF NOT EXISTS public.school_record_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('enrolled', 'grade_changed', 'transferred', 'graduated', 'deactivated', 'reactivated')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS school_record_events_membership_idx
  ON public.school_record_events(membership_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_active_school_member(
  p_school_id uuid,
  p_roles text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_memberships sm
    WHERE sm.school_id = p_school_id
      AND sm.user_id = auth.uid()
      AND sm.status = 'active'
      AND (p_roles IS NULL OR sm.school_role = ANY(p_roles))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_school_manager(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._is_extreme_admin()
    OR public.is_active_school_member(p_school_id, ARRAY['manager']::text[]);
$$;

CREATE OR REPLACE FUNCTION public.is_school_manager_or_admin(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._is_extreme_admin()
    OR public.is_active_school_member(p_school_id, ARRAY['manager', 'admin']::text[]);
$$;

CREATE OR REPLACE FUNCTION public.school_next_student_number(
  p_school_id uuid,
  p_grade_label text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number bigint;
  v_grade text := lower(trim(coalesce(p_grade_label, '')));
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_school_manager_or_admin(p_school_id) THEN
    RAISE EXCEPTION 'Only the school Manager or Admin can allocate student IDs';
  END IF;
  IF v_grade = '' THEN
    RAISE EXCEPTION 'Grade is required for student ID allocation';
  END IF;

  INSERT INTO public.school_student_id_sequences(school_id, grade_label, next_number)
  VALUES (p_school_id, v_grade, 2)
  ON CONFLICT (school_id, grade_label)
  DO UPDATE SET next_number = public.school_student_id_sequences.next_number + 1,
                updated_at = now()
  RETURNING next_number - 1 INTO v_number;

  RETURN v_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_deactivate_student_membership(
  p_membership_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership public.school_memberships%ROWTYPE;
BEGIN
  IF p_status NOT IN ('transferred', 'graduated', 'deactivated') THEN
    RAISE EXCEPTION 'Invalid student membership end status';
  END IF;

  SELECT * INTO v_membership
  FROM public.school_memberships
  WHERE id = p_membership_id AND school_role = 'student'
  FOR UPDATE;

  IF NOT FOUND OR NOT public.is_school_manager_or_admin(v_membership.school_id) THEN
    RAISE EXCEPTION 'Student membership not found or not authorized';
  END IF;

  UPDATE public.school_memberships
  SET status = p_status,
      ended_at = now(),
      end_reason = nullif(trim(p_reason), ''),
      updated_at = now()
  WHERE id = p_membership_id;

  INSERT INTO public.school_record_events(school_id, membership_id, event_type, details, actor_id)
  VALUES (
    v_membership.school_id,
    v_membership.id,
    CASE WHEN p_status = 'transferred' THEN 'transferred'
         WHEN p_status = 'graduated' THEN 'graduated'
         ELSE 'deactivated' END,
    jsonb_build_object('reason', nullif(trim(p_reason), '')),
    auth.uid()
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_validate_teacher_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher public.school_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_teacher
  FROM public.school_memberships
  WHERE id = NEW.teacher_membership_id AND school_id = NEW.school_id;
  IF v_teacher.id IS NULL OR v_teacher.school_role <> 'teacher' OR v_teacher.status <> 'active' THEN
    RAISE EXCEPTION 'Assignment must target an active teacher in the same school';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_teacher_assignment_validate ON public.school_teacher_assignments;
CREATE TRIGGER school_teacher_assignment_validate
BEFORE INSERT OR UPDATE ON public.school_teacher_assignments
FOR EACH ROW EXECUTE FUNCTION public.school_validate_teacher_assignment();

CREATE OR REPLACE FUNCTION public.school_protect_membership_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF ROW(NEW.school_id, NEW.user_id, NEW.school_role, NEW.student_number, NEW.school_username, NEW.created_by)
     IS DISTINCT FROM
     ROW(OLD.school_id, OLD.user_id, OLD.school_role, OLD.student_number, OLD.school_username, OLD.created_by) THEN
    RAISE EXCEPTION 'School membership identity and assigned student ID are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_membership_identity_immutable ON public.school_memberships;
CREATE TRIGGER school_membership_identity_immutable
BEFORE UPDATE ON public.school_memberships
FOR EACH ROW EXECUTE FUNCTION public.school_protect_membership_identity();

CREATE OR REPLACE FUNCTION public.school_validate_parent_student_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent public.school_memberships%ROWTYPE;
  v_student public.school_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_parent FROM public.school_memberships WHERE id = NEW.parent_membership_id;
  SELECT * INTO v_student FROM public.school_memberships WHERE id = NEW.student_membership_id;

  IF NEW.status = 'deactivated' THEN
    RETURN NEW;
  END IF;
  IF v_parent.id IS NULL OR v_student.id IS NULL
     OR v_parent.school_id <> NEW.school_id OR v_student.school_id <> NEW.school_id
     OR v_parent.school_role <> 'parent' OR v_student.school_role <> 'student' THEN
    RAISE EXCEPTION 'Parent and student must be memberships in the same school';
  END IF;
  IF v_parent.status <> 'active' OR v_student.status <> 'active' THEN
    RAISE EXCEPTION 'Only active parent and student memberships can be linked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_parent_student_link_validate ON public.school_parent_student_links;
CREATE TRIGGER school_parent_student_link_validate
BEFORE INSERT OR UPDATE ON public.school_parent_student_links
FOR EACH ROW EXECUTE FUNCTION public.school_validate_parent_student_link();

CREATE OR REPLACE FUNCTION public.school_sync_parent_access_after_student_exit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.school_role = 'student' AND OLD.status = 'active'
     AND NEW.status IN ('transferred', 'graduated', 'deactivated') THEN
    UPDATE public.school_parent_student_links
    SET status = 'deactivated', ended_at = now()
    WHERE student_membership_id = NEW.id AND status = 'active';

    UPDATE public.school_memberships parent_membership
    SET status = 'deactivated', ended_at = now(), end_reason = 'No active children remain enrolled in this school',
        updated_at = now()
    WHERE parent_membership.school_role = 'parent'
      AND parent_membership.status = 'active'
      AND parent_membership.id IN (
        SELECT parent_membership_id
        FROM public.school_parent_student_links
        WHERE school_id = NEW.school_id
          AND student_membership_id = NEW.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.school_parent_student_links remaining_link
        JOIN public.school_memberships active_student
          ON active_student.id = remaining_link.student_membership_id
        WHERE remaining_link.parent_membership_id = parent_membership.id
          AND remaining_link.status = 'active'
          AND active_student.status = 'active'
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_sync_parent_access_after_student_exit ON public.school_memberships;
CREATE TRIGGER school_sync_parent_access_after_student_exit
AFTER UPDATE OF status ON public.school_memberships
FOR EACH ROW EXECUTE FUNCTION public.school_sync_parent_access_after_student_exit();

CREATE OR REPLACE FUNCTION public.school_can_view_school(p_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $
  SELECT public._is_extreme_admin() OR public.is_active_school_member(p_school_id, NULL);
$;

CREATE OR REPLACE FUNCTION public.school_can_view_membership(p_membership_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_memberships target
    WHERE target.id = p_membership_id
      AND (
        target.user_id = auth.uid()
        OR public._is_extreme_admin()
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
$;

CREATE OR REPLACE FUNCTION public.school_can_view_section(p_section_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_sections section
    WHERE section.id = p_section_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(section.school_id)
        OR EXISTS (
          SELECT 1 FROM public.school_memberships teacher
          JOIN public.school_teacher_assignments assignment
            ON assignment.teacher_membership_id = teacher.id
           AND assignment.school_id = teacher.school_id
          WHERE teacher.user_id = auth.uid()
            AND teacher.school_id = section.school_id
            AND teacher.school_role = 'teacher'
            AND teacher.status = 'active'
            AND assignment.section_id = section.id
        )
        OR EXISTS (
          SELECT 1 FROM public.school_memberships student
          WHERE student.user_id = auth.uid()
            AND student.school_id = section.school_id
            AND student.section_id = section.id
            AND student.school_role = 'student'
            AND student.status = 'active'
        )
        OR EXISTS (
          SELECT 1
          FROM public.school_parent_student_links link
          JOIN public.school_memberships parent
            ON parent.id = link.parent_membership_id
          JOIN public.school_memberships student
            ON student.id = link.student_membership_id
          WHERE parent.user_id = auth.uid()
            AND parent.school_id = section.school_id
            AND parent.school_role = 'parent'
            AND parent.status = 'active'
            AND link.status = 'active'
            AND student.section_id = section.id
            AND student.status = 'active'
        )
      )
  );
$;

CREATE OR REPLACE FUNCTION public.school_can_view_teacher_assignment(p_assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_teacher_assignments assignment
    WHERE assignment.id = p_assignment_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(assignment.school_id)
        OR EXISTS (
          SELECT 1 FROM public.school_memberships teacher
          WHERE teacher.id = assignment.teacher_membership_id
            AND teacher.user_id = auth.uid()
            AND teacher.school_role = 'teacher'
            AND teacher.status = 'active'
        )
      )
  );
$;

CREATE OR REPLACE FUNCTION public.school_can_view_parent_link(p_link_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_parent_student_links link
    JOIN public.school_memberships parent ON parent.id = link.parent_membership_id
    WHERE link.id = p_link_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(link.school_id)
        OR (parent.user_id = auth.uid() AND parent.school_role = 'parent' AND parent.status = 'active')
      )
  );
$;

CREATE OR REPLACE FUNCTION public.school_can_view_record_event(p_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_record_events event
    JOIN public.school_memberships membership ON membership.id = event.membership_id
    WHERE event.id = p_event_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(event.school_id)
        OR membership.user_id = auth.uid()
      )
  );
$;

CREATE OR REPLACE FUNCTION public.school_can_view_profile(p_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $
  SELECT auth.uid() IS NOT NULL AND (
    public._is_extreme_admin()
    OR EXISTS (
      SELECT 1
      FROM public.school_memberships staff
      JOIN public.school_memberships target ON target.school_id = staff.school_id
      WHERE staff.user_id = auth.uid()
        AND staff.status = 'active'
        AND staff.school_role IN ('manager', 'admin')
        AND target.user_id = p_profile_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_memberships teacher
      JOIN public.school_teacher_assignments assignment
        ON assignment.teacher_membership_id = teacher.id
       AND assignment.school_id = teacher.school_id
      JOIN public.school_memberships student
        ON student.school_id = teacher.school_id
       AND student.section_id = assignment.section_id
       AND student.school_role = 'student'
      WHERE teacher.user_id = auth.uid()
        AND teacher.school_role = 'teacher'
        AND teacher.status = 'active'
        AND student.user_id = p_profile_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_parent_student_links link
      JOIN public.school_memberships parent ON parent.id = link.parent_membership_id
      JOIN public.school_memberships student ON student.id = link.student_membership_id
      WHERE parent.user_id = auth.uid()
        AND parent.school_role = 'parent'
        AND parent.status = 'active'
        AND link.status = 'active'
        AND student.user_id = p_profile_id
        AND student.status = 'active'
    )
  );
$;

-- All school data tables are protected by row-level policies. A school member
-- cannot read another school's records by changing a client-side school ID.
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_student_id_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_record_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schools_member_read ON public.schools;
CREATE POLICY schools_member_read ON public.schools
FOR SELECT TO authenticated
USING (public.school_can_view_school(id));

DROP POLICY IF EXISTS schools_super_admin_insert ON public.schools;
CREATE POLICY schools_super_admin_insert ON public.schools
FOR INSERT TO authenticated
WITH CHECK (public._is_extreme_admin() AND created_by = auth.uid());

DROP POLICY IF EXISTS schools_manager_update ON public.schools;
CREATE POLICY schools_manager_update ON public.schools
FOR UPDATE TO authenticated
USING (public.is_school_manager(id))
WITH CHECK (public.is_school_manager(id));

DROP POLICY IF EXISTS school_memberships_read ON public.school_memberships;
CREATE POLICY school_memberships_read ON public.school_memberships
FOR SELECT TO authenticated
USING (public.school_can_view_membership(id));

-- Membership creation is reserved for trusted account-provisioning workflows
-- using the service role; client-side inserts cannot assign arbitrary roles.
DROP POLICY IF EXISTS school_memberships_manager_insert ON public.school_memberships;

DROP POLICY IF EXISTS school_memberships_manager_update ON public.school_memberships;
CREATE POLICY school_memberships_manager_update ON public.school_memberships
FOR UPDATE TO authenticated
USING (public._is_extreme_admin() OR public.is_school_manager_or_admin(school_id))
WITH CHECK (public._is_extreme_admin() OR public.is_school_manager_or_admin(school_id));

DROP POLICY IF EXISTS school_years_read ON public.school_academic_years;
CREATE POLICY school_years_read ON public.school_academic_years
FOR SELECT TO authenticated
USING (public.is_active_school_member(school_id, NULL) OR public._is_extreme_admin());

DROP POLICY IF EXISTS school_years_manager_write ON public.school_academic_years;
CREATE POLICY school_years_manager_insert ON public.school_academic_years
FOR INSERT TO authenticated WITH CHECK (public.is_school_manager_or_admin(school_id));
CREATE POLICY school_years_manager_update ON public.school_academic_years
FOR UPDATE TO authenticated USING (public.is_school_manager_or_admin(school_id))
WITH CHECK (public.is_school_manager_or_admin(school_id));

DROP POLICY IF EXISTS school_sections_read ON public.school_sections;
CREATE POLICY school_sections_read ON public.school_sections
FOR SELECT TO authenticated
USING (public.school_can_view_section(id));

DROP POLICY IF EXISTS school_sections_manager_write ON public.school_sections;
CREATE POLICY school_sections_manager_insert ON public.school_sections
FOR INSERT TO authenticated WITH CHECK (public.is_school_manager_or_admin(school_id));
CREATE POLICY school_sections_manager_update ON public.school_sections
FOR UPDATE TO authenticated USING (public.is_school_manager_or_admin(school_id))
WITH CHECK (public.is_school_manager_or_admin(school_id));

DROP POLICY IF EXISTS school_teacher_assignments_read ON public.school_teacher_assignments;
CREATE POLICY school_teacher_assignments_read ON public.school_teacher_assignments
FOR SELECT TO authenticated
USING (public.school_can_view_teacher_assignment(id));

DROP POLICY IF EXISTS school_teacher_assignments_manager_write ON public.school_teacher_assignments;
CREATE POLICY school_teacher_assignments_manager_write ON public.school_teacher_assignments
FOR ALL TO authenticated
USING (public.is_school_manager_or_admin(school_id))
WITH CHECK (public.is_school_manager_or_admin(school_id));

DROP POLICY IF EXISTS school_parent_links_read ON public.school_parent_student_links;
CREATE POLICY school_parent_links_read ON public.school_parent_student_links
FOR SELECT TO authenticated
USING (public.school_can_view_parent_link(id));

DROP POLICY IF EXISTS school_parent_links_manager_write ON public.school_parent_student_links;
CREATE POLICY school_parent_links_manager_insert ON public.school_parent_student_links
FOR INSERT TO authenticated WITH CHECK (public.is_school_manager_or_admin(school_id));
CREATE POLICY school_parent_links_manager_update ON public.school_parent_student_links
FOR UPDATE TO authenticated USING (public.is_school_manager_or_admin(school_id))
WITH CHECK (public.is_school_manager_or_admin(school_id));

DROP POLICY IF EXISTS school_record_events_read ON public.school_record_events;
CREATE POLICY school_record_events_read ON public.school_record_events
FOR SELECT TO authenticated
USING (public.school_can_view_record_event(id));

-- ID sequences are accessed only through the guarded allocator function.
REVOKE ALL ON public.school_student_id_sequences FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_next_student_number(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.school_deactivate_student_membership(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_next_student_number(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_deactivate_student_membership(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_school_member(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_manager_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_manager(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.school_can_view_school(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_school(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.school_can_view_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_membership(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.school_can_view_section(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_section(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.school_can_view_teacher_assignment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_teacher_assignment(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.school_can_view_parent_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_parent_link(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.school_can_view_record_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_record_event(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.school_can_view_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_can_view_profile(uuid) TO authenticated;

