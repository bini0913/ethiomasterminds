-- Distinct platform Super Admin authority and one school network boundary.
CREATE TABLE IF NOT EXISTS public.school_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_key boolean NOT NULL DEFAULT true UNIQUE CHECK (network_key = true),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.school_networks (network_key, name, created_by)
SELECT true, 'Master Minds School Network',
       (SELECT user_id FROM public.user_roles WHERE role = 'extreme_admin'::public.app_role ORDER BY created_at LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.school_networks WHERE network_key = true);

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS network_id uuid;
UPDATE public.schools
SET network_id = (SELECT id FROM public.school_networks WHERE network_key = true)
WHERE network_id IS NULL;
ALTER TABLE public.schools ALTER COLUMN network_id SET NOT NULL;
ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_network_id_fkey;
ALTER TABLE public.schools
  ADD CONSTRAINT schools_network_id_fkey FOREIGN KEY (network_id)
  REFERENCES public.school_networks(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS schools_network_status_idx ON public.schools(network_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS exactly_one_extreme_admin
  ON public.user_roles(role) WHERE role = 'extreme_admin'::public.app_role;
CREATE UNIQUE INDEX IF NOT EXISTS exactly_one_super_admin
  ON public.user_roles(role) WHERE role = 'super_admin'::public.app_role;

CREATE OR REPLACE FUNCTION public._is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'super_admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public._is_network_authority()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public._is_extreme_admin() OR public._is_super_admin();
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_update_user_role(p_user_id uuid, p_role public.app_role)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_extreme_admin();
  IF public.has_role(p_user_id, 'extreme_admin'::public.app_role)
     AND p_role <> 'extreme_admin'::public.app_role THEN
    RAISE EXCEPTION 'The sole Extreme Admin cannot be demoted';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (p_user_id, p_role);
  PERFORM public.extreme_admin_log('update_user_role', 'user', p_user_id::text, jsonb_build_object('role', p_role));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role public.app_role;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  IF _user_id IS DISTINCT FROM auth.uid()
     AND coalesce(auth.role(), '') <> 'service_role'
     AND NOT public._is_extreme_admin() THEN RETURN NULL; END IF;
  SELECT role INTO v_role FROM (
    SELECT ur.role, 0 AS source_priority, CASE ur.role
      WHEN 'extreme_admin'::public.app_role THEN 0
      WHEN 'super_admin'::public.app_role THEN 1 ELSE 10 END AS role_priority
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role IN ('extreme_admin'::public.app_role, 'super_admin'::public.app_role)
    UNION ALL
    SELECT sm.school_role::public.app_role, 1, CASE sm.school_role
      WHEN 'manager' THEN 1 WHEN 'admin' THEN 2 WHEN 'finance' THEN 3
      WHEN 'teacher' THEN 4 WHEN 'parent' THEN 5 WHEN 'student' THEN 6 ELSE 99 END
    FROM public.school_memberships sm WHERE sm.user_id = _user_id AND sm.status = 'active'
    UNION ALL
    SELECT ur.role, 2, CASE ur.role
      WHEN 'manager'::public.app_role THEN 1 WHEN 'admin'::public.app_role THEN 2
      WHEN 'finance'::public.app_role THEN 3 WHEN 'teacher'::public.app_role THEN 4
      WHEN 'parent'::public.app_role THEN 5 WHEN 'student'::public.app_role THEN 6 ELSE 99 END
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role NOT IN ('extreme_admin'::public.app_role, 'super_admin'::public.app_role)
  ) candidate ORDER BY source_priority, role_priority LIMIT 1;
  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_network_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.school_networks WHERE network_key = true;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_get_network_dashboard()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_network uuid; v_result jsonb;
BEGIN
  IF NOT public._is_network_authority() THEN RAISE EXCEPTION 'Network authority required'; END IF;
  v_network := public.school_network_id();
  SELECT jsonb_build_object(
    'network_id', v_network,
    'network_name', (SELECT name FROM public.school_networks WHERE id = v_network),
    'schools', (SELECT count(*) FROM public.schools WHERE network_id = v_network),
    'active_schools', (SELECT count(*) FROM public.schools WHERE network_id = v_network AND status = 'active'),
    'suspended_schools', (SELECT count(*) FROM public.schools WHERE network_id = v_network AND status = 'suspended'),
    'closed_schools', (SELECT count(*) FROM public.schools WHERE network_id = v_network AND status = 'closed'),
    'managers', (SELECT count(*) FROM public.school_memberships sm JOIN public.schools s ON s.id = sm.school_id WHERE s.network_id = v_network AND sm.school_role = 'manager' AND sm.status = 'active'),
    'enrolled_students', (SELECT count(*) FROM public.school_memberships sm JOIN public.schools s ON s.id = sm.school_id WHERE s.network_id = v_network AND sm.school_role = 'student' AND sm.status IN ('active','suspended'))
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_list_network_schools(p_search text DEFAULT NULL, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, name text, school_code text, status text, created_at timestamptz, manager_count bigint, student_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.school_code, s.status, s.created_at,
    (SELECT count(*) FROM public.school_memberships sm WHERE sm.school_id = s.id AND sm.school_role = 'manager' AND sm.status = 'active'),
    (SELECT count(*) FROM public.school_memberships sm WHERE sm.school_id = s.id AND sm.school_role = 'student' AND sm.status IN ('active','suspended'))
  FROM public.schools s
  WHERE public._is_network_authority() AND s.network_id = public.school_network_id()
    AND (nullif(trim(p_search), '') IS NULL OR s.name ILIKE '%' || trim(p_search) || '%' OR s.school_code ILIKE '%' || upper(trim(p_search)) || '%')
  ORDER BY s.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 500)) OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.super_admin_register_school(p_name text, p_school_code text)
RETURNS public.schools LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school public.schools%ROWTYPE; v_name text := trim(coalesce(p_name, '')); v_code text := upper(trim(coalesce(p_school_code, '')));
BEGIN
  IF NOT public._is_network_authority() THEN RAISE EXCEPTION 'Network authority required'; END IF;
  IF v_name !~ '^.{2,160}$' OR v_code !~ '^[A-Z0-9]{2,8}$' THEN RAISE EXCEPTION 'Valid school name and code are required'; END IF;
  INSERT INTO public.schools(name, school_code, network_id, created_by)
  VALUES (v_name, v_code, public.school_network_id(), auth.uid()) RETURNING * INTO v_school;
  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'school_registered', 'school', v_school.id, jsonb_build_object('school_code', v_code, 'network_id', public.school_network_id()));
  RETURN v_school;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'School code is already registered';
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_set_school_status(p_school_id uuid, p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._is_network_authority() THEN RAISE EXCEPTION 'Network authority required'; END IF;
  IF p_status NOT IN ('active', 'suspended', 'closed') THEN RAISE EXCEPTION 'Invalid school status'; END IF;
  UPDATE public.schools SET status = p_status, updated_at = now()
  WHERE id = p_school_id AND network_id = public.school_network_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'School is outside the current network'; END IF;
  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'school_status_changed', 'school', p_school_id, jsonb_build_object('status', p_status));
  RETURN true;
END;
$$;

DROP POLICY IF EXISTS schools_super_admin_insert ON public.schools;
CREATE POLICY schools_network_authority_insert ON public.schools FOR INSERT TO authenticated
WITH CHECK (public._is_network_authority() AND created_by = auth.uid() AND network_id = public.school_network_id());
DROP POLICY IF EXISTS schools_super_admin_update ON public.schools;
CREATE POLICY schools_network_authority_update ON public.schools FOR UPDATE TO authenticated
USING (public._is_network_authority() AND network_id = public.school_network_id())
WITH CHECK (public._is_network_authority() AND network_id = public.school_network_id());

GRANT EXECUTE ON FUNCTION public._is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_network_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_get_network_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_list_network_schools(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_register_school(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_set_school_status(uuid, text) TO authenticated;

-- Regression contract for account limits, authorization, isolation and audit persistence.
