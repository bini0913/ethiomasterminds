-- Separate platform ownership from school-network administration.
-- The Extreme Admin remains the sole global authority. A separate, singleton
-- Super Admin role is assigned only through the guarded Extreme Admin RPC.

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_extreme_admin_idx
  ON public.user_roles (role)
  WHERE role = 'extreme_admin'::public.app_role;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_super_admin_idx
  ON public.user_roles (role)
  WHERE role = 'super_admin'::public.app_role;

-- The two top-level authorities must be different accounts.
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_platform_role_per_account_idx
  ON public.user_roles (user_id)
  WHERE role IN (
    'extreme_admin'::public.app_role,
    'super_admin'::public.app_role
  );

CREATE OR REPLACE FUNCTION public._is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT public.has_role(auth.uid(), 'super_admin'::public.app_role);
$function$;

REVOKE ALL ON FUNCTION public._is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._is_super_admin() TO authenticated;

-- Keep the platform roles above all school memberships and ordinary user roles.
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
    SELECT ur.role, 0 AS source_priority,
      CASE ur.role
        WHEN 'extreme_admin'::public.app_role THEN 0
        WHEN 'super_admin'::public.app_role THEN 1
        ELSE 10
      END AS role_priority
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN (
        'extreme_admin'::public.app_role,
        'super_admin'::public.app_role
      )

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
      AND ur.role NOT IN (
        'extreme_admin'::public.app_role,
        'super_admin'::public.app_role
      )
  ) AS candidate
  ORDER BY candidate.source_priority, candidate.role_priority
  LIMIT 1;

  RETURN v_role;
END;
$function$;

-- Only the Extreme Admin may provision, replace, or revoke the single
-- Super Admin. The transaction lock and unique partial index protect against
-- concurrent attempts to create two Super Admin accounts.
CREATE OR REPLACE FUNCTION public.extreme_admin_set_super_admin(
  p_user_id uuid,
  p_enabled boolean,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_previous_user_id uuid;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A target account is required';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'The Extreme Admin cannot also be the Super Admin';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('master_minds.super_admin.singleton')::bigint);

  IF p_enabled THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
      RAISE EXCEPTION 'Target account does not exist';
    END IF;

    IF public.has_role(p_user_id, 'extreme_admin'::public.app_role) THEN
      RAISE EXCEPTION 'The Extreme Admin account cannot become Super Admin';
    END IF;

    SELECT user_id
    INTO v_previous_user_id
    FROM public.user_roles
    WHERE role = 'super_admin'::public.app_role
    FOR UPDATE;

    IF v_previous_user_id IS NOT NULL AND v_previous_user_id <> p_user_id THEN
      DELETE FROM public.user_roles
      WHERE user_id = v_previous_user_id
        AND role = 'super_admin'::public.app_role;
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = 'super_admin'::public.app_role;
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_id, action, target_type, target_id, metadata
  )
  VALUES (
    auth.uid(),
    CASE WHEN p_enabled THEN 'set_super_admin' ELSE 'revoke_super_admin' END,
    'user',
    p_user_id,
    jsonb_build_object(
      'enabled', p_enabled,
      'reason', nullif(trim(coalesce(p_reason, '')), ''),
      'replaced_user_id', v_previous_user_id
    )
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.extreme_admin_set_super_admin(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_super_admin(uuid, boolean, text) TO authenticated;

-- Top-level roles must never be granted through ordinary role-assignment paths.
CREATE OR REPLACE FUNCTION public.assign_user_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _role IN (
    'extreme_admin'::public.app_role,
    'super_admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Top-level roles require the dedicated platform provisioning workflow';
  END IF;

  IF _user_id = auth.uid() THEN
    IF _role <> 'student'::public.app_role THEN
      RAISE EXCEPTION 'Users may only self-assign the student role';
    END IF;
  ELSIF public._is_extreme_admin() THEN
    NULL;
  ELSIF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF _role NOT IN (
      'student'::public.app_role,
      'teacher'::public.app_role,
      'admin'::public.app_role,
      'manager'::public.app_role
    ) THEN
      RAISE EXCEPTION 'Admins cannot grant this role';
    END IF;
  ELSIF public.has_role(auth.uid(), 'manager'::public.app_role) THEN
    IF _role NOT IN ('student'::public.app_role, 'teacher'::public.app_role) THEN
      RAISE EXCEPTION 'Managers can only grant student or teacher roles';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.extreme_admin_update_user_role(
  p_user_id uuid,
  p_role public.app_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;

  IF p_role IN (
    'extreme_admin'::public.app_role,
    'super_admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Use the dedicated top-level account controls';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND role IN ('extreme_admin'::public.app_role, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Top-level account roles cannot be changed here';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, p_role);

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'update_user_role', 'user', p_user_id, jsonb_build_object('role', p_role));

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.extreme_admin_set_role(
  p_user_id uuid,
  p_role public.app_role,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;

  IF p_role IN (
    'extreme_admin'::public.app_role,
    'super_admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Use the dedicated top-level account controls';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND role IN ('extreme_admin'::public.app_role, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Top-level account roles cannot be changed here';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (p_user_id, p_role);

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(), 'root_set_role', 'user', p_user_id,
    jsonb_build_object('role', p_role, 'reason', p_reason)
  );

  RETURN true;
END;
$function$;

-- The legacy bootstrap allowed an ordinary admin to claim platform ownership
-- if the owner role was absent. Disable client execution; recovery is a
-- controlled operator procedure, not an in-app self-promotion route.
REVOKE ALL ON FUNCTION public.extreme_admin_bootstrap_self() FROM PUBLIC, anon, authenticated;


-- Report the distinct global and school-network populations accurately. The
-- old dashboard mislabeled the Extreme Admin count as "super_admins".
CREATE OR REPLACE FUNCTION public.extreme_admin_get_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'students', (
      SELECT count(*) FROM (
        SELECT user_id FROM public.user_roles WHERE role = 'student'::public.app_role
        UNION
        SELECT user_id FROM public.school_memberships WHERE school_role = 'student' AND status = 'active'
      ) AS student_accounts
    ),
    'teachers', (
      SELECT count(*) FROM (
        SELECT user_id FROM public.user_roles WHERE role = 'teacher'::public.app_role
        UNION
        SELECT user_id FROM public.school_memberships WHERE school_role = 'teacher' AND status = 'active'
      ) AS teacher_accounts
    ),
    'managers', (
      SELECT count(*) FROM (
        SELECT user_id FROM public.user_roles WHERE role = 'manager'::public.app_role
        UNION
        SELECT user_id FROM public.school_memberships WHERE school_role = 'manager' AND status = 'active'
      ) AS manager_accounts
    ),
    'admins', (
      SELECT count(*) FROM (
        SELECT user_id FROM public.user_roles WHERE role = 'admin'::public.app_role
        UNION
        SELECT user_id FROM public.school_memberships WHERE school_role = 'admin' AND status = 'active'
      ) AS admin_accounts
    ),
    'finance', (
      SELECT count(*) FROM (
        SELECT user_id FROM public.user_roles WHERE role = 'finance'::public.app_role
        UNION
        SELECT user_id FROM public.school_memberships WHERE school_role = 'finance' AND status = 'active'
      ) AS finance_accounts
    ),
    'parents', (
      SELECT count(*) FROM (
        SELECT user_id FROM public.user_roles WHERE role = 'parent'::public.app_role
        UNION
        SELECT user_id FROM public.school_memberships WHERE school_role = 'parent' AND status = 'active'
      ) AS parent_accounts
    ),
    'super_admins', (SELECT count(*) FROM public.user_roles WHERE role = 'super_admin'::public.app_role),
    'extreme_admins', (SELECT count(*) FROM public.user_roles WHERE role = 'extreme_admin'::public.app_role),
    'schools', (SELECT count(*) FROM public.schools),
    'active_schools', (SELECT count(*) FROM public.schools WHERE status = 'active'),
    'suspended_schools', (SELECT count(*) FROM public.schools WHERE status = 'suspended'),
    'active_school_memberships', (SELECT count(*) FROM public.school_memberships WHERE status = 'active'),
    'individual_users', (
      SELECT count(*) FROM public.profiles p
      WHERE NOT EXISTS (
        SELECT 1 FROM public.school_memberships sm
        WHERE sm.user_id = p.id AND sm.status = 'active'
      )
    ),
    'messages', (SELECT count(*) FROM public.messages),
    'group_messages', (SELECT count(*) FROM public.group_messages),
    'room_messages', (SELECT count(*) FROM public.room_chat_messages),
    'lobby_messages', (SELECT count(*) FROM public.lobby_messages),
    'ai_conversations', (SELECT count(*) FROM public.ai_tutor_conversations),
    'reports', (SELECT count(*) FROM public.reports),
    'pending_reports', (SELECT count(*) FROM public.reports WHERE status = 'pending'),
    'posts', (SELECT count(*) FROM public.social_posts),
    'books', (SELECT count(*) FROM public.library_books),
    'active_users_10m', (
      SELECT count(*) FROM public.user_presence
      WHERE last_seen > now() - interval '10 minutes'
    )
  );
END;
$function$;

-- Use the authoritative role resolver so school memberships and platform
-- roles are not lost through an unordered first-role lookup.
CREATE OR REPLACE FUNCTION public.extreme_admin_list_users(
  p_search text DEFAULT NULL,
  p_role public.app_role DEFAULT NULL,
  p_limit integer DEFAULT 300,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  name text,
  username text,
  grade text,
  xp integer,
  level integer,
  role public.app_role,
  account_status text,
  coins integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.name,
    p.username,
    p.grade,
    p.xp,
    p.level,
    COALESCE(public.get_user_role(p.id), 'student'::public.app_role),
    p.account_status,
    COALESCE(uc.coins, 0),
    p.created_at
  FROM public.profiles p
  LEFT JOIN LATERAL (SELECT coins FROM public.user_currency WHERE user_id = p.id LIMIT 1) uc ON true
  WHERE public._is_extreme_admin()
    AND (
      p_search IS NULL
      OR p.name ILIKE '%' || p_search || '%'
      OR p.username ILIKE '%' || p_search || '%'
    )
    AND (
      p_role IS NULL
      OR COALESCE(public.get_user_role(p.id), 'student'::public.app_role) = p_role
    )
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500))
  OFFSET GREATEST(0, p_offset);
$function$;


-- Global school inventory for the Extreme Admin. Counts are derived from
-- active school memberships; no student or staff personal data is exposed.
CREATE OR REPLACE FUNCTION public.extreme_admin_list_schools()
RETURNS TABLE(
  id uuid,
  name text,
  school_code text,
  status text,
  created_at timestamptz,
  created_by uuid,
  managers bigint,
  admins bigint,
  teachers bigint,
  students bigint,
  parents bigint,
  finance_staff bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    s.id,
    s.name,
    s.school_code,
    s.status,
    s.created_at,
    s.created_by,
    count(sm.id) FILTER (WHERE sm.school_role = 'manager') AS managers,
    count(sm.id) FILTER (WHERE sm.school_role = 'admin') AS admins,
    count(sm.id) FILTER (WHERE sm.school_role = 'teacher') AS teachers,
    count(sm.id) FILTER (WHERE sm.school_role = 'student') AS students,
    count(sm.id) FILTER (WHERE sm.school_role = 'parent') AS parents,
    count(sm.id) FILTER (WHERE sm.school_role = 'finance') AS finance_staff
  FROM public.schools s
  LEFT JOIN public.school_memberships sm
    ON sm.school_id = s.id AND sm.status = 'active'
  WHERE public._is_extreme_admin()
  GROUP BY s.id
  ORDER BY s.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.extreme_admin_list_schools() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_list_schools() TO authenticated;

CREATE OR REPLACE FUNCTION public.extreme_admin_set_school_status(
  p_school_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;

  IF p_school_id IS NULL OR p_status NOT IN ('active', 'suspended', 'closed') THEN
    RAISE EXCEPTION 'A valid school and status are required';
  END IF;

  UPDATE public.schools
  SET status = p_status, updated_at = now()
  WHERE id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    'root_set_school_status',
    'school',
    p_school_id,
    jsonb_build_object('status', p_status, 'reason', nullif(trim(coalesce(p_reason, '')), ''))
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.extreme_admin_set_school_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_school_status(uuid, text, text) TO authenticated;


-- Give the single Super Admin network-wide visibility without treating it as
-- the platform owner or silently granting every school Manager capability.
DO $$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  v_definition := pg_get_functiondef('public.school_can_view_school(uuid)'::regprocedure);
  v_old := 'SELECT public._is_extreme_admin() OR public.is_active_school_member(p_school_id, NULL);';
  v_new := 'SELECT public._is_extreme_admin() OR public._is_super_admin() OR public.is_active_school_member(p_school_id, NULL);';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely update school_can_view_school';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);

  v_definition := pg_get_functiondef('public.school_can_view_membership(uuid)'::regprocedure);
  v_old := 'OR public._is_extreme_admin()';
  v_new := 'OR public._is_extreme_admin() OR public._is_super_admin()';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely update school_can_view_membership';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);

  v_definition := pg_get_functiondef('public.school_can_view_invoice(uuid)'::regprocedure);
  v_old := 'public._is_extreme_admin()';
  v_new := 'public._is_extreme_admin() OR public._is_super_admin()';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely update school_can_view_invoice';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);

  -- The trusted account-provisioning RPC must recognize the distinct
  -- Super Admin only for its explicit platform-level Manager workflow.
  v_definition := pg_get_functiondef(
    'public.school_attach_account(uuid,uuid,uuid,text,text,text,integer,uuid,bigint,uuid[],uuid[],jsonb)'::regprocedure
  );
  v_old := 'WHERE user_id = p_actor_id AND role = ''extreme_admin''::public.app_role';
  v_new := 'WHERE user_id = p_actor_id AND role IN (''extreme_admin''::public.app_role, ''super_admin''::public.app_role)';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely update school_attach_account';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);

  v_definition := pg_get_functiondef(
    'public.school_link_parent_students(uuid,uuid,uuid[])'::regprocedure
  );
  v_old := 'WHERE user_id = p_actor_id AND role = ''extreme_admin''::public.app_role';
  v_new := 'WHERE user_id = p_actor_id AND role IN (''extreme_admin''::public.app_role, ''super_admin''::public.app_role)';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely update school_link_parent_students';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);
END;
$$;

DROP POLICY IF EXISTS schools_super_admin_insert ON public.schools;
CREATE POLICY schools_super_admin_insert
ON public.schools
FOR INSERT
TO authenticated
WITH CHECK (
  (public._is_extreme_admin() OR public._is_super_admin())
  AND created_by = auth.uid()
);

DROP POLICY IF EXISTS schools_super_admin_update ON public.schools;
CREATE POLICY schools_super_admin_update
ON public.schools
FOR UPDATE
TO authenticated
USING (public._is_extreme_admin() OR public._is_super_admin())
WITH CHECK (public._is_extreme_admin() OR public._is_super_admin());


-- Super Admin may inspect profiles only when they belong to an active school
-- membership. Individual-only accounts remain outside the school network.
DO $$
DECLARE
  v_definition text;
  v_old text := 'public._is_extreme_admin()';
  v_new text := 'public._is_extreme_admin() OR (public._is_super_admin() AND EXISTS (SELECT 1 FROM public.school_memberships target_profile_membership WHERE target_profile_membership.user_id = p_profile_id AND target_profile_membership.status IN (''active'', ''suspended'')))';
BEGIN
  v_definition := pg_get_functiondef('public.school_can_view_profile(uuid)'::regprocedure);
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely update school_can_view_profile';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);
END;
$$;


CREATE OR REPLACE FUNCTION public.super_admin_set_school_status(
  p_school_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
BEGIN
  IF NOT public._is_super_admin() THEN
    RAISE EXCEPTION 'Super Admin access required';
  END IF;

  IF p_school_id IS NULL OR p_status NOT IN ('active', 'suspended', 'closed') THEN
    RAISE EXCEPTION 'A valid school and status are required';
  END IF;

  UPDATE public.schools
  SET status = p_status, updated_at = now()
  WHERE id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    'super_admin_set_school_status',
    'school',
    p_school_id,
    jsonb_build_object('status', p_status, 'reason', nullif(trim(coalesce(p_reason, '')), ''))
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.super_admin_set_school_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_set_school_status(uuid, text, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.extreme_admin_get_security()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_audit_events bigint;
  v_active_admins bigint;
  v_active_managers bigint;
  v_suspended_users bigint;
  v_banned_users bigint;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;

  SELECT count(*) INTO v_audit_events FROM public.admin_audit_logs;

  SELECT count(DISTINCT ur.user_id) INTO v_active_admins
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role IN (
    'admin'::public.app_role,
    'super_admin'::public.app_role,
    'extreme_admin'::public.app_role
  )
    AND coalesce(p.account_status, 'active') = 'active';

  SELECT count(*) INTO v_active_managers
  FROM (
    SELECT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'manager'::public.app_role
      AND coalesce(p.account_status, 'active') = 'active'
    UNION
    SELECT sm.user_id
    FROM public.school_memberships sm
    JOIN public.profiles p ON p.id = sm.user_id
    WHERE sm.school_role = 'manager'
      AND sm.status = 'active'
      AND coalesce(p.account_status, 'active') = 'active'
  ) AS manager_accounts;

  SELECT count(*) INTO v_suspended_users
  FROM public.profiles WHERE account_status = 'suspended';

  SELECT count(*) INTO v_banned_users
  FROM public.profiles WHERE account_status = 'banned';

  RETURN jsonb_build_object(
    'audit_events', v_audit_events,
    'active_admins', v_active_admins,
    'active_managers', v_active_managers,
    'suspended_users', v_suspended_users,
    'banned_users', v_banned_users,
    'security_audit_events', v_audit_events
  );
END;
$function$;


-- Tighten the trusted account-attachment RPC: Extreme Admin retains global
-- provisioning authority; Super Admin may provision school Managers only;
-- school Managers/Admins remain limited to their own school's staff/students.
DO $$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
BEGIN
  v_definition := pg_get_functiondef(
    'public.school_attach_account(uuid,uuid,uuid,text,text,text,integer,uuid,bigint,uuid[],uuid[],jsonb)'::regprocedure
  );

  v_old := $old$  v_actor_role text;
  v_is_super_admin boolean;$old$;
  v_new := $new$  v_actor_role text;
  v_is_extreme_admin boolean;
  v_is_super_admin boolean;$new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely add Extreme Admin provisioning distinction';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_actor_id AND role IN ('extreme_admin'::public.app_role, 'super_admin'::public.app_role)
  ) INTO v_is_super_admin;$old$;
  v_new := $new$  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_actor_id AND role = 'extreme_admin'::public.app_role
  ) INTO v_is_extreme_admin;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_actor_id AND role = 'super_admin'::public.app_role
  ) INTO v_is_super_admin;$new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely separate platform provisioning roles';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$  IF NOT v_is_super_admin AND v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Only the school Manager or Admin can provision accounts';
  END IF;
  IF NOT v_is_super_admin AND v_actor_role = 'admin'
     AND p_school_role NOT IN ('student', 'parent', 'teacher') THEN
    RAISE EXCEPTION 'School Admin can create student, parent, and teacher accounts only';
  END IF;
  IF NOT v_is_super_admin AND v_actor_role = 'manager'
     AND p_school_role NOT IN ('student', 'parent', 'teacher', 'finance', 'admin') THEN
    RAISE EXCEPTION 'School Manager cannot create another Manager account';
  END IF;
  IF p_school_role = 'manager' AND NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Only the Super Admin can create a school Manager';
  END IF;$old$;
  v_new := $new$  IF v_is_extreme_admin THEN
    NULL;
  ELSIF v_is_super_admin THEN
    IF p_school_role <> 'manager' THEN
      RAISE EXCEPTION 'Super Admin can only provision school Managers';
    END IF;
  ELSIF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Only the school Manager or Admin can provision accounts';
  ELSIF v_actor_role = 'admin'
     AND p_school_role NOT IN ('student', 'parent', 'teacher') THEN
    RAISE EXCEPTION 'School Admin can create student, parent, and teacher accounts only';
  ELSIF v_actor_role = 'manager'
     AND p_school_role NOT IN ('student', 'parent', 'teacher', 'finance', 'admin') THEN
    RAISE EXCEPTION 'School Manager cannot create another Manager account';
  ELSIF p_school_role = 'manager' THEN
    RAISE EXCEPTION 'Only the Super Admin can create a school Manager';
  END IF;$new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely replace school provisioning authorization';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END;
$$;
