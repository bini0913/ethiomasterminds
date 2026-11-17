-- Prevent authenticated users from probing another account's role.
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role public.app_role;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF _user_id IS DISTINCT FROM auth.uid()
     AND coalesce(auth.role(), '') <> 'service_role'
     AND NOT public._is_extreme_admin() THEN
    RETURN NULL;
  END IF;

  SELECT candidate.role
  INTO v_role
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

  RETURN v_role;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

-- This helper is only needed inside the SECURITY DEFINER assessment-access
-- function. Do not expose it as an authenticated membership-history oracle.
REVOKE ALL ON FUNCTION public.school_student_was_in_section_for_term(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
