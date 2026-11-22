-- Global platform authority must outrank school-scoped memberships.
-- A Super Admin may also be a student or hold a teacher membership in a pilot
-- school; those school roles must never shadow the global Super Admin role.
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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
    SELECT ur.role, 0 AS source_priority, 0 AS role_priority
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'extreme_admin'::public.app_role

    UNION ALL

    SELECT ur.role, 1 AS source_priority, 0 AS role_priority
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'super_admin'::public.app_role

    UNION ALL

    SELECT sm.school_role::public.app_role, 2 AS source_priority,
      CASE sm.school_role
        WHEN 'manager' THEN 1
        WHEN 'finance' THEN 3
        WHEN 'teacher' THEN 4
        WHEN 'parent' THEN 5
        WHEN 'student' THEN 6
        ELSE 99
      END AS role_priority
    FROM public.school_memberships sm
    WHERE sm.user_id = _user_id
      AND sm.status = 'active'
      AND sm.school_role <> 'admin'

    UNION ALL

    SELECT ur.role, 3 AS source_priority,
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
      AND ur.role NOT IN ('extreme_admin'::public.app_role, 'super_admin'::public.app_role)
  ) AS candidate
  ORDER BY candidate.source_priority, candidate.role_priority
  LIMIT 1;

  RETURN v_role;
END;
$function$;
