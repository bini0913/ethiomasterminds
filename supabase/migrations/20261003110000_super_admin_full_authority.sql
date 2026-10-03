-- Super Admin full-authority controls.
-- Extends the existing extreme_admin role with staff oversight and
-- explicit protection for the last remaining Super Admin.

CREATE OR REPLACE FUNCTION public.extreme_admin_get_staff_overview()
RETURNS TABLE(
  id uuid,
  name text,
  username text,
  role public.app_role,
  account_status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.username,
         COALESCE(ur.role, 'student'::public.app_role),
         p.account_status,
         p.created_at
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT role FROM public.user_roles
    WHERE user_id = p.id
    ORDER BY CASE role
      WHEN 'extreme_admin'::public.app_role THEN 1
      WHEN 'admin'::public.app_role THEN 2
      WHEN 'manager'::public.app_role THEN 3
      WHEN 'teacher'::public.app_role THEN 4
      ELSE 5
    END
    LIMIT 1
  ) ur ON true
  WHERE public._is_extreme_admin()
    AND COALESCE(ur.role, 'student'::public.app_role)
      IN ('extreme_admin','admin','manager','teacher')
  ORDER BY CASE COALESCE(ur.role, 'student'::public.app_role)
      WHEN 'extreme_admin'::public.app_role THEN 1
      WHEN 'admin'::public.app_role THEN 2
      WHEN 'manager'::public.app_role THEN 3
      WHEN 'teacher'::public.app_role THEN 4
      ELSE 5
    END, p.name;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_set_staff_role(
  p_user_id uuid,
  p_role public.app_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role public.app_role;
  v_super_admin_count integer;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Super Admin access required';
  END IF;

  IF p_role NOT IN ('teacher','manager','admin','extreme_admin') THEN
    RAISE EXCEPTION 'Invalid staff role';
  END IF;

  SELECT role INTO v_current_role
  FROM public.user_roles
  WHERE user_id = p_user_id
  ORDER BY CASE role
    WHEN 'extreme_admin'::public.app_role THEN 1
    WHEN 'admin'::public.app_role THEN 2
    WHEN 'manager'::public.app_role THEN 3
    ELSE 4
  END
  LIMIT 1;

  IF v_current_role = 'extreme_admin'::public.app_role
     AND p_role <> 'extreme_admin'::public.app_role THEN
    SELECT count(*) INTO v_super_admin_count
    FROM public.user_roles
    WHERE role = 'extreme_admin'::public.app_role;

    IF v_super_admin_count <= 1 THEN
      RAISE EXCEPTION 'The last Super Admin cannot be demoted';
    END IF;
  END IF;

  IF p_user_id = auth.uid()
     AND p_role <> 'extreme_admin'::public.app_role THEN
    RAISE EXCEPTION 'The active Super Admin cannot demote itself';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles(user_id, role)
  VALUES (p_user_id, p_role);

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    'super_admin_set_staff_role',
    'user',
    p_user_id,
    jsonb_build_object('previous_role', v_current_role, 'new_role', p_role)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_set_staff_status(
  p_user_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_super_admin_count integer;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Super Admin access required';
  END IF;

  IF p_status NOT IN ('active','suspended','banned') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT role INTO v_role
  FROM public.user_roles
  WHERE user_id = p_user_id
  ORDER BY CASE role
    WHEN 'extreme_admin'::public.app_role THEN 1
    WHEN 'admin'::public.app_role THEN 2
    WHEN 'manager'::public.app_role THEN 3
    ELSE 4
  END
  LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN (
    'teacher','manager','admin','extreme_admin'
  ) THEN
    RAISE EXCEPTION 'Target is not a staff account';
  END IF;

  IF p_user_id = auth.uid() AND p_status <> 'active' THEN
    RAISE EXCEPTION 'The active Super Admin cannot disable itself';
  END IF;

  IF v_role = 'extreme_admin'::public.app_role AND p_status <> 'active' THEN
    SELECT count(*) INTO v_super_admin_count
    FROM public.user_roles
    WHERE role = 'extreme_admin'::public.app_role;

    IF v_super_admin_count <= 1 THEN
      RAISE EXCEPTION 'The last Super Admin cannot be disabled';
    END IF;
  END IF;

  UPDATE public.profiles
  SET account_status = p_status, updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    'super_admin_set_staff_status',
    'user',
    p_user_id,
    jsonb_build_object('role', v_role, 'status', p_status, 'reason', p_reason)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.extreme_admin_get_staff_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_staff_role(uuid,public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_staff_status(uuid,text,text) TO authenticated;
