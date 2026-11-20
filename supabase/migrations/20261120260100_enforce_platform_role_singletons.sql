-- Separate platform ownership from school-network administration.
-- The Extreme Admin remains the sole global authority. A separate, singleton
-- Super Admin role is assigned only through the guarded Extreme Admin RPC.

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_extreme_admin_idx
  ON public.user_roles (role)
  WHERE role = 'extreme_admin'::public.app_role;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_super_admin_idx
  ON public.user_roles (role)
  WHERE role = 'super_admin'::public.app_role;

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
  LEFT JOIN public.user_currency uc ON uc.user_id = p.id
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
