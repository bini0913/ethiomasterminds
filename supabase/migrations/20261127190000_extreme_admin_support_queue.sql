-- Part 1: expose existing student support requests through a guarded executive queue.
-- Status is stored separately so request authors cannot mark their own requests resolved.

CREATE TABLE IF NOT EXISTS public.support_request_statuses (
  post_id uuid PRIMARY KEY REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.support_request_statuses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.support_request_statuses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.support_request_statuses TO authenticated;
DROP POLICY IF EXISTS "support request authors read their own statuses" ON public.support_request_statuses;
CREATE POLICY "support request authors read their own statuses"
  ON public.support_request_statuses
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

INSERT INTO public.support_request_statuses(post_id, user_id, status, updated_at)
SELECT post.id, post.author_id, 'open', post.updated_at
FROM public.social_posts AS post
WHERE post.post_type = 'support_request'
ON CONFLICT (post_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.extreme_admin_list_support_requests(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  author_id uuid,
  author_name text,
  content text,
  created_at timestamp with time zone,
  status text,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('open', 'in_review', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid support request status filter';
  END IF;

  RETURN QUERY
  SELECT
    post.id,
    post.author_id,
    COALESCE(profile.name, 'Unknown'),
    post.content,
    post.created_at,
    COALESCE(status_record.status, 'open'),
    COALESCE(status_record.updated_at, post.updated_at)
  FROM public.social_posts AS post
  LEFT JOIN public.profiles AS profile ON profile.id = post.author_id
  LEFT JOIN public.support_request_statuses AS status_record ON status_record.post_id = post.id
  WHERE post.post_type = 'support_request'
    AND (p_status IS NULL OR COALESCE(status_record.status, 'open') = p_status)
  ORDER BY post.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$function$;

CREATE OR REPLACE FUNCTION public.extreme_admin_set_support_request_status(
  p_post_id uuid,
  p_status text,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;

  IF p_post_id IS NULL OR p_status IS NULL OR p_status NOT IN ('open', 'in_review', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'A valid support request and status are required';
  END IF;

  IF NULLIF(trim(COALESCE(p_reason, '')), '') IS NULL OR length(trim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'A support resolution reason of 1–500 characters is required';
  END IF;

  INSERT INTO public.support_request_statuses(post_id, user_id, status, updated_at, updated_by)
  SELECT post.id, post.author_id, p_status, now(), auth.uid()
  FROM public.social_posts AS post
  WHERE post.id = p_post_id
    AND post.post_type = 'support_request'
  ON CONFLICT (post_id) DO UPDATE
  SET status = EXCLUDED.status,
      updated_at = now(),
      updated_by = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support request not found';
  END IF;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    'root_update_support_request',
    'social_post',
    p_post_id,
    jsonb_build_object('status', p_status, 'reason', trim(p_reason))
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.extreme_admin_list_support_requests(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.extreme_admin_set_support_request_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_list_support_requests(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_support_request_status(uuid, text, text) TO authenticated;
