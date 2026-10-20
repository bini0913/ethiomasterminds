-- Admin Portal real settings and audit trail.
-- Reuses the existing platform_settings/admin_audit_logs tables and the existing Supabase project.

INSERT INTO public.platform_settings(setting_key, setting_value)
VALUES
  ('feature_social_enabled', 'true'::jsonb),
  ('feature_ai_enabled', 'true'::jsonb),
  ('feature_xp_enabled', 'true'::jsonb),
  ('leaderboard_enabled', 'true'::jsonb),
  ('grades_enabled', 'true'::jsonb),
  ('strict_moderation', 'true'::jsonb),
  ('max_ai_requests_per_day', '50'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_get_settings()
RETURNS TABLE(setting_key text, setting_value jsonb, updated_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'extreme_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT s.setting_key, s.setting_value, s.updated_at
  FROM public.platform_settings s
  WHERE s.setting_key IN (
    'feature_social_enabled',
    'feature_ai_enabled',
    'feature_xp_enabled',
    'leaderboard_enabled',
    'grades_enabled',
    'strict_moderation',
    'max_ai_requests_per_day'
  )
  ORDER BY s.setting_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_setting(p_key text, p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_boolean boolean;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'extreme_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_key NOT IN (
    'feature_social_enabled',
    'feature_ai_enabled',
    'feature_xp_enabled',
    'leaderboard_enabled',
    'grades_enabled',
    'strict_moderation',
    'max_ai_requests_per_day'
  ) THEN
    RAISE EXCEPTION 'Setting is not allow-listed';
  END IF;

  v_is_boolean := p_key <> 'max_ai_requests_per_day';
  IF v_is_boolean AND (p_value IS NULL OR jsonb_typeof(p_value) <> 'boolean') THEN
    RAISE EXCEPTION 'This setting requires a boolean value';
  END IF;
  IF NOT v_is_boolean AND (
    p_value IS NULL
    OR jsonb_typeof(p_value) <> 'number'
    OR (p_value #>> '{}')::integer < 0
    OR (p_value #>> '{}')::integer > 300
    OR (p_value #>> '{}')::numeric <> (p_value #>> '{}')::integer
  ) THEN
    RAISE EXCEPTION 'AI daily limit must be a whole number between 0 and 300';
  END IF;

  INSERT INTO public.platform_settings(setting_key, setting_value, updated_by, updated_at)
  VALUES (p_key, p_value, auth.uid(), now())
  ON CONFLICT (setting_key) DO UPDATE
    SET setting_value = EXCLUDED.setting_value,
        updated_by = auth.uid(),
        updated_at = now();

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, metadata)
  VALUES (
    auth.uid(),
    'set_platform_setting',
    'setting',
    jsonb_build_object('key', p_key, 'value', p_value)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_write_audit_log(
  p_action text,
  p_target_type text DEFAULT 'platform',
  p_target_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'extreme_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  IF p_action IS NULL OR length(trim(p_action)) = 0 OR length(p_action) > 160 THEN
    RAISE EXCEPTION 'Invalid audit action';
  END IF;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    trim(p_action),
    left(coalesce(p_target_type, 'platform'), 80),
    p_target_id,
    coalesce(p_metadata, '{}'::jsonb)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_audit_logs(p_limit integer DEFAULT 200)
RETURNS TABLE(
  id uuid,
  actor_id uuid,
  actor_name text,
  action text,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'extreme_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  RETURN QUERY
  SELECT l.id, l.actor_id, p.name, l.action, l.target_type, l.target_id, l.metadata, l.created_at
  FROM public.admin_audit_logs l
  LEFT JOIN public.profiles p ON p.id = l.actor_id
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(coalesce(p_limit, 200), 500));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_setting(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_write_audit_log(text, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_audit_logs(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_setting(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_write_audit_log(text, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_audit_logs(integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.extreme_admin_delete_user(p_user_id uuid, p_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role public.app_role;
  v_super_admin_count bigint;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Super Admin access required';
  END IF;
  IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete the active Super Admin account';
  END IF;

  SELECT role INTO v_target_role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
  IF v_target_role = 'extreme_admin'::public.app_role THEN
    SELECT count(*) INTO v_super_admin_count FROM public.user_roles WHERE role = 'extreme_admin'::public.app_role;
    IF v_super_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot delete the last Super Admin';
    END IF;
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User account not found';
  END IF;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'delete_auth_user', 'user', p_user_id, jsonb_build_object('reason', p_reason));

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.extreme_admin_delete_user(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_delete_user(uuid, text) TO authenticated;


-- Server-enforced AI master switch and rolling 24-hour per-user request limit.
-- The client cannot choose the bucket or increase its own limit.
CREATE OR REPLACE FUNCTION public.consume_configured_ai_request()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_enabled boolean := true;
  v_limit integer := 50;
  v_row public.edge_request_rate_limits%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT coalesce((setting_value #>> '{}')::boolean, true)
    INTO v_enabled
  FROM public.platform_settings
  WHERE setting_key = 'feature_ai_enabled';
  IF NOT coalesce(v_enabled, true) THEN
    RETURN false;
  END IF;

  SELECT coalesce((setting_value #>> '{}')::integer, 50)
    INTO v_limit
  FROM public.platform_settings
  WHERE setting_key = 'max_ai_requests_per_day';
  v_limit := least(300, greatest(0, coalesce(v_limit, 50)));
  IF v_limit = 0 THEN
    RETURN false;
  END IF;

  SELECT * INTO v_row
  FROM public.edge_request_rate_limits
  WHERE user_id = v_uid AND bucket = 'ai-daily'
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.edge_request_rate_limits(user_id, bucket, window_started_at, request_count)
    VALUES (v_uid, 'ai-daily', now(), 1)
    ON CONFLICT (user_id, bucket) DO NOTHING;

    SELECT * INTO v_row
    FROM public.edge_request_rate_limits
    WHERE user_id = v_uid AND bucket = 'ai-daily'
    FOR UPDATE;
  END IF;

  IF now() - v_row.window_started_at >= interval '24 hours' THEN
    UPDATE public.edge_request_rate_limits
    SET window_started_at = now(), request_count = 1
    WHERE user_id = v_uid AND bucket = 'ai-daily';
    RETURN true;
  END IF;

  IF v_row.request_count >= v_limit THEN
    RETURN false;
  END IF;

  UPDATE public.edge_request_rate_limits
  SET request_count = request_count + 1
  WHERE user_id = v_uid AND bucket = 'ai-daily';
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_configured_ai_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_configured_ai_request() TO authenticated;
