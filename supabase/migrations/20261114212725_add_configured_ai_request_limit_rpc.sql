-- Enforce the admin AI master switch and a rolling 24-hour per-user request limit.
-- The function is intentionally callable only by authenticated users and derives
-- the user identity from auth.uid(); callers cannot select another user's bucket.

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
