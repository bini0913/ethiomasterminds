-- Hidden Extreme Admin root control layer
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'extreme_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'extreme_admin';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.extreme_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.extreme_admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Extreme admins can read audit logs" ON public.extreme_admin_audit_logs;
CREATE POLICY "Extreme admins can read audit logs"
ON public.extreme_admin_audit_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'extreme_admin'::public.app_role));

DROP POLICY IF EXISTS "Extreme admins can write audit logs" ON public.extreme_admin_audit_logs;
CREATE POLICY "Extreme admins can write audit logs"
ON public.extreme_admin_audit_logs
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'extreme_admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.extreme_admin_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.extreme_admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Extreme admins can manage extreme admin settings" ON public.extreme_admin_settings;
CREATE POLICY "Extreme admins can manage extreme admin settings"
ON public.extreme_admin_settings
FOR ALL
USING (public.has_role(auth.uid(), 'extreme_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'extreme_admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.extreme_admin_security (
  id boolean PRIMARY KEY DEFAULT true,
  allowed_ips text[] NOT NULL DEFAULT '{}',
  require_2fa boolean NOT NULL DEFAULT false,
  two_factor_code_hash text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = true)
);

ALTER TABLE public.extreme_admin_security ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Extreme admins can manage security" ON public.extreme_admin_security;
CREATE POLICY "Extreme admins can manage security"
ON public.extreme_admin_security
FOR ALL
USING (public.has_role(auth.uid(), 'extreme_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'extreme_admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.user_account_controls (
  user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'purged')),
  reason text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_account_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own account control" ON public.user_account_controls;
CREATE POLICY "Users can view own account control"
ON public.user_account_controls
FOR SELECT
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'extreme_admin'::public.app_role));

DROP POLICY IF EXISTS "Extreme admins can manage account control" ON public.user_account_controls;
CREATE POLICY "Extreme admins can manage account control"
ON public.user_account_controls
FOR ALL
USING (public.has_role(auth.uid(), 'extreme_admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'extreme_admin'::public.app_role));

INSERT INTO public.extreme_admin_settings (setting_key, setting_value)
VALUES
  ('feature_social_enabled', 'true'::jsonb),
  ('feature_ai_enabled', 'true'::jsonb),
  ('feature_xp_enabled', 'true'::jsonb),
  ('leaderboard_enabled', 'true'::jsonb),
  ('grades_enabled', 'true'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.extreme_admin_security (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.require_extreme_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'extreme_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Extreme admin access required';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_log(
  p_action text,
  p_target_type text,
  p_target_id text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_extreme_admin();

  INSERT INTO public.extreme_admin_audit_logs (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, COALESCE(p_details, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_check_access(
  p_request_ip text DEFAULT NULL,
  p_two_factor_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_security public.extreme_admin_security%ROWTYPE;
BEGIN
  PERFORM public.require_extreme_admin();

  SELECT * INTO v_security
  FROM public.extreme_admin_security
  WHERE id = true;

  IF COALESCE(array_length(v_security.allowed_ips, 1), 0) > 0 THEN
    IF p_request_ip IS NULL OR NOT (p_request_ip = ANY(v_security.allowed_ips)) THEN
      RAISE EXCEPTION 'Access denied: IP is not allowlisted';
    END IF;
  END IF;

  IF v_security.require_2fa THEN
    IF p_two_factor_code IS NULL
       OR v_security.two_factor_code_hash IS NULL
       OR crypt(p_two_factor_code, v_security.two_factor_code_hash) <> v_security.two_factor_code_hash THEN
      RAISE EXCEPTION 'Access denied: invalid 2FA code';
    END IF;
  END IF;

  PERFORM public.extreme_admin_log(
    'extreme_admin_access_verified',
    'security',
    auth.uid()::text,
    jsonb_build_object('request_ip', p_request_ip, '2fa_required', v_security.require_2fa)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_configure_security(
  p_allowed_ips text[] DEFAULT '{}',
  p_require_2fa boolean DEFAULT false,
  p_two_factor_code text DEFAULT NULL
)
RETURNS public.extreme_admin_security
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_hash text;
  v_row public.extreme_admin_security%ROWTYPE;
BEGIN
  PERFORM public.require_extreme_admin();

  v_code_hash := CASE
    WHEN p_two_factor_code IS NULL OR length(trim(p_two_factor_code)) = 0 THEN NULL
    ELSE crypt(p_two_factor_code, gen_salt('bf'))
  END;

  INSERT INTO public.extreme_admin_security (id, allowed_ips, require_2fa, two_factor_code_hash, updated_by, updated_at)
  VALUES (true, COALESCE(p_allowed_ips, '{}'), p_require_2fa, v_code_hash, auth.uid(), now())
  ON CONFLICT (id) DO UPDATE
  SET allowed_ips = EXCLUDED.allowed_ips,
      require_2fa = EXCLUDED.require_2fa,
      two_factor_code_hash = COALESCE(EXCLUDED.two_factor_code_hash, public.extreme_admin_security.two_factor_code_hash),
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_row;

  PERFORM public.extreme_admin_log(
    'configure_security',
    'security',
    auth.uid()::text,
    jsonb_build_object('allowed_ips', p_allowed_ips, 'require_2fa', p_require_2fa, 'two_factor_code_updated', p_two_factor_code IS NOT NULL)
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_list_users(p_limit integer DEFAULT 250)
RETURNS TABLE (
  id uuid,
  name text,
  username text,
  grade text,
  xp integer,
  level integer,
  role public.app_role,
  coins integer,
  account_status text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.name,
    p.username,
    p.grade,
    p.xp,
    p.level,
    COALESCE(ur.role, 'student'::public.app_role) AS role,
    COALESCE(uc.coins, 0) AS coins,
    COALESCE(uac.status, 'active') AS account_status,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN public.user_currency uc ON uc.user_id = p.id
  LEFT JOIN public.user_account_controls uac ON uac.user_id = p.id
  WHERE public.has_role(auth.uid(), 'extreme_admin'::public.app_role)
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 250), 1000));
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_get_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.require_extreme_admin();

  SELECT jsonb_build_object(
    'users', (SELECT COUNT(*) FROM public.profiles),
    'students', (SELECT COUNT(*) FROM public.user_roles WHERE role = 'student'),
    'teachers', (SELECT COUNT(*) FROM public.user_roles WHERE role = 'teacher'),
    'admins', (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin'),
    'extreme_admins', (SELECT COUNT(*) FROM public.user_roles WHERE role = 'extreme_admin'),
    'messages', (SELECT COUNT(*) FROM public.messages),
    'posts', (SELECT COUNT(*) FROM public.social_posts),
    'books', (SELECT COUNT(*) FROM public.library_books),
    'settings', (SELECT COUNT(*) FROM public.extreme_admin_settings),
    'audit_events', (SELECT COUNT(*) FROM public.extreme_admin_audit_logs)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_get_settings()
RETURNS TABLE(setting_key text, setting_value jsonb, updated_at timestamptz, updated_by uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT setting_key, setting_value, updated_at, updated_by
  FROM public.extreme_admin_settings
  WHERE public.has_role(auth.uid(), 'extreme_admin'::public.app_role)
  ORDER BY setting_key;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_set_setting(p_key text, p_value jsonb)
RETURNS public.extreme_admin_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.extreme_admin_settings%ROWTYPE;
BEGIN
  PERFORM public.require_extreme_admin();

  INSERT INTO public.extreme_admin_settings (setting_key, setting_value, updated_by, updated_at)
  VALUES (p_key, COALESCE(p_value, 'null'::jsonb), auth.uid(), now())
  ON CONFLICT (setting_key) DO UPDATE
  SET setting_value = EXCLUDED.setting_value,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_row;

  PERFORM public.extreme_admin_log('set_setting', 'setting', p_key, jsonb_build_object('value', p_value));

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_update_user_role(p_user_id uuid, p_role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_extreme_admin();

  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role);

  PERFORM public.extreme_admin_log('update_user_role', 'user', p_user_id::text, jsonb_build_object('role', p_role));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_set_user_status(
  p_user_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_extreme_admin();

  IF p_status NOT IN ('active', 'suspended', 'banned', 'purged') THEN
    RAISE EXCEPTION 'Invalid account status';
  END IF;

  INSERT INTO public.user_account_controls (user_id, status, reason, updated_by, updated_at)
  VALUES (p_user_id, p_status, p_reason, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE
  SET status = EXCLUDED.status,
      reason = EXCLUDED.reason,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at;

  PERFORM public.extreme_admin_log('set_user_status', 'user', p_user_id::text, jsonb_build_object('status', p_status, 'reason', p_reason));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_adjust_economy(
  p_user_id uuid,
  p_xp_delta integer DEFAULT 0,
  p_coin_delta integer DEFAULT 0,
  p_reset_progress boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before_xp integer;
  v_before_level integer;
  v_before_coins integer;
  v_after_xp integer;
  v_after_level integer;
  v_after_coins integer;
BEGIN
  PERFORM public.require_extreme_admin();

  SELECT xp, level INTO v_before_xp, v_before_level FROM public.profiles WHERE id = p_user_id;
  SELECT coins INTO v_before_coins FROM public.user_currency WHERE user_id = p_user_id;

  IF p_reset_progress THEN
    UPDATE public.profiles
    SET xp = 0,
        level = 1,
        rank = public.calculate_rank(0),
        updated_at = now()
    WHERE id = p_user_id;

    UPDATE public.user_currency
    SET coins = 0,
        updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    UPDATE public.profiles
    SET xp = GREATEST(0, xp + COALESCE(p_xp_delta, 0)),
        level = FLOOR(GREATEST(0, xp + COALESCE(p_xp_delta, 0)) / 100) + 1,
        rank = public.calculate_rank(GREATEST(0, xp + COALESCE(p_xp_delta, 0))),
        updated_at = now()
    WHERE id = p_user_id;

    UPDATE public.user_currency
    SET coins = GREATEST(0, coins + COALESCE(p_coin_delta, 0)),
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  SELECT xp, level INTO v_after_xp, v_after_level FROM public.profiles WHERE id = p_user_id;
  SELECT coins INTO v_after_coins FROM public.user_currency WHERE user_id = p_user_id;

  PERFORM public.extreme_admin_log(
    'adjust_economy',
    'user',
    p_user_id::text,
    jsonb_build_object(
      'xp_delta', p_xp_delta,
      'coin_delta', p_coin_delta,
      'reset_progress', p_reset_progress,
      'before', jsonb_build_object('xp', v_before_xp, 'level', v_before_level, 'coins', v_before_coins),
      'after', jsonb_build_object('xp', v_after_xp, 'level', v_after_level, 'coins', v_after_coins)
    )
  );

  RETURN jsonb_build_object(
    'xp', v_after_xp,
    'level', v_after_level,
    'coins', v_after_coins
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_delete_message(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_extreme_admin();
  DELETE FROM public.messages WHERE id = p_message_id;
  PERFORM public.extreme_admin_log('delete_message', 'message', p_message_id::text);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_delete_social_post(p_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_extreme_admin();
  DELETE FROM public.social_posts WHERE id = p_post_id;
  PERFORM public.extreme_admin_log('delete_social_post', 'social_post', p_post_id::text);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_delete_library_book(p_book_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_extreme_admin();
  DELETE FROM public.library_books WHERE id = p_book_id;
  PERFORM public.extreme_admin_log('delete_library_book', 'library_book', p_book_id::text);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_purge_user_data(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_extreme_admin();

  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.user_currency WHERE user_id = p_user_id;
  DELETE FROM public.user_account_controls WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;

  PERFORM public.extreme_admin_log('purge_user_data', 'user', p_user_id::text);

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_get_audit_logs(p_limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  actor_id uuid,
  actor_name text,
  action text,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.actor_id,
    p.name AS actor_name,
    l.action,
    l.target_type,
    l.target_id,
    l.details,
    l.created_at
  FROM public.extreme_admin_audit_logs l
  LEFT JOIN public.profiles p ON p.id = l.actor_id
  WHERE public.has_role(auth.uid(), 'extreme_admin'::public.app_role)
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
$$;

GRANT EXECUTE ON FUNCTION public.require_extreme_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_log(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_check_access(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_configure_security(text[], boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_list_users(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_setting(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_update_user_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_user_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_adjust_economy(uuid, integer, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_delete_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_delete_social_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_delete_library_book(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_purge_user_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_audit_logs(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.extreme_admin_get_security()
RETURNS TABLE(allowed_ips text[], require_2fa boolean, updated_at timestamptz, updated_by uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT allowed_ips, require_2fa, updated_at, updated_by
  FROM public.extreme_admin_security
  WHERE id = true
    AND public.has_role(auth.uid(), 'extreme_admin'::public.app_role);
$$;

GRANT EXECUTE ON FUNCTION public.extreme_admin_get_security() TO authenticated;
