-- Resolve school portal roles from active school memberships without granting
-- global admin/manager privileges through user_roles.
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT candidate.role
  FROM (
    SELECT ur.role, 0 AS source_priority,
      CASE ur.role
        WHEN 'extreme_admin'::public.app_role THEN 0
        ELSE 10
      END AS role_priority
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'extreme_admin'::public.app_role

    UNION ALL

    SELECT sm.school_role::public.app_role, 1 AS source_priority,
      CASE sm.school_role
        WHEN 'manager' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'finance' THEN 3
        WHEN 'teacher' THEN 4
        WHEN 'parent' THEN 5
        WHEN 'student' THEN 6
        ELSE 99
      END AS role_priority
    FROM public.school_memberships sm
    WHERE sm.user_id = _user_id
      AND sm.status = 'active'

    UNION ALL

    SELECT ur.role, 2 AS source_priority,
      CASE ur.role
        WHEN 'manager'::public.app_role THEN 1
        WHEN 'admin'::public.app_role THEN 2
        WHEN 'finance'::public.app_role THEN 3
        WHEN 'teacher'::public.app_role THEN 4
        WHEN 'parent'::public.app_role THEN 5
        WHEN 'student'::public.app_role THEN 6
        ELSE 99
      END AS role_priority
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role <> 'extreme_admin'::public.app_role
  ) AS candidate
  ORDER BY candidate.source_priority, candidate.role_priority
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

-- School managers/admins may see profiles only for people with a membership
-- in their own school. Teachers see only students assigned to their sections.
DROP POLICY IF EXISTS school_staff_view_same_school_profiles ON public.profiles;
DROP POLICY IF EXISTS school_parents_view_linked_child_profiles ON public.profiles;
DROP POLICY IF EXISTS school_members_can_view_scoped_profiles ON public.profiles;
CREATE POLICY school_members_can_view_scoped_profiles
ON public.profiles
FOR SELECT TO authenticated
USING (public.school_can_view_profile(id));

-- Keep student directory lookup within the caller's actual school scope.
CREATE OR REPLACE FUNCTION public.find_student_by_username(_username text)
RETURNS TABLE(id uuid, name text, username text, avatar text, level integer, xp integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public._is_extreme_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.school_memberships sm
       WHERE sm.user_id = auth.uid()
         AND sm.status = 'active'
         AND sm.school_role IN ('teacher', 'admin', 'manager')
     )
     AND NOT (
       public.has_role(auth.uid(), 'teacher'::public.app_role)
       OR public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'manager'::public.app_role)
     ) THEN
    RAISE EXCEPTION 'Teacher or school staff role required';
  END IF;

  RETURN QUERY
  SELECT DISTINCT p.id, p.name, p.username, p.avatar, p.level, p.xp
  FROM public.profiles p
  JOIN public.school_memberships student
    ON student.user_id = p.id
   AND student.school_role = 'student'
   AND student.status = 'active'
  WHERE (
    public._is_extreme_admin()
    OR EXISTS (
      SELECT 1
      FROM public.school_memberships staff
      WHERE staff.user_id = auth.uid()
        AND staff.school_id = student.school_id
        AND staff.status = 'active'
        AND staff.school_role IN ('manager', 'admin')
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_memberships teacher
      JOIN public.school_teacher_assignments assignment
        ON assignment.teacher_membership_id = teacher.id
       AND assignment.school_id = teacher.school_id
      WHERE teacher.user_id = auth.uid()
        AND teacher.school_id = student.school_id
        AND teacher.school_role = 'teacher'
        AND teacher.status = 'active'
        AND assignment.section_id = student.section_id
    )
  )
  AND (
    lower(coalesce(p.username, '')) LIKE '%' || lower(trim(_username)) || '%'
    OR lower(coalesce(p.name, '')) LIKE '%' || lower(trim(_username)) || '%'
  )
  ORDER BY p.username
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.find_student_by_username(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_student_by_username(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_student_by_username(text) TO authenticated;
