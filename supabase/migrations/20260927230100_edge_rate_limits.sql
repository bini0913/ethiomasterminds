-- Lightweight per-user rate limiting for paid/expensive Edge Functions.
CREATE TABLE IF NOT EXISTS public.edge_request_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (user_id, bucket)
);

ALTER TABLE public.edge_request_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  p_bucket text,
  p_limit integer DEFAULT 30,
  p_window_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_row public.edge_request_rate_limits%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_bucket IS NULL OR length(trim(p_bucket)) = 0
     OR p_limit < 1 OR p_limit > 300
     OR p_window_seconds < 10 OR p_window_seconds > 3600 THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters';
  END IF;

  SELECT * INTO v_row
  FROM public.edge_request_rate_limits
  WHERE user_id = uid AND bucket = p_bucket
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.edge_request_rate_limits(user_id, bucket, window_started_at, request_count)
    VALUES (uid, trim(p_bucket), now(), 1)
    ON CONFLICT (user_id, bucket) DO NOTHING;
    RETURN true;
  END IF;

  IF now() - v_row.window_started_at >= make_interval(secs => p_window_seconds) THEN
    UPDATE public.edge_request_rate_limits
       SET window_started_at = now(), request_count = 1
     WHERE user_id = uid AND bucket = p_bucket;
    RETURN true;
  END IF;

  IF v_row.request_count >= p_limit THEN
    RETURN false;
  END IF;

  UPDATE public.edge_request_rate_limits
     SET request_count = request_count + 1
   WHERE user_id = uid AND bucket = p_bucket;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(text, integer, integer) TO authenticated;
