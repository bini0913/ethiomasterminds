-- Part 1: expose the existing student support board as a guarded executive queue.
-- Support requests remain in social_posts; no duplicate ticket store is introduced.

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
    CASE
      WHEN post.metadata ->> 'support_status' IN ('open', 'in_review', 'resolved', 'dismissed')
        THEN post.metadata ->> 'support_status'
      ELSE 'open'
    END,
    post.updated_at
  FROM public.social_posts AS post
  LEFT JOIN public.profiles AS profile ON profile.id = post.author_id
  WHERE post.post_type = 'support_request'
    AND (
      p_status IS NULL
      OR CASE
        WHEN post.metadata ->> 'support_status' IN ('open', 'in_review', 'resolved', 'dismissed')
          THEN post.metadata ->> 'support_status'
        ELSE 'open'
      END = p_status
    )
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

  UPDATE public.social_posts
  SET
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'support_status', p_status,
      'support_updated_at', now()
    ),
    updated_at = now()
  WHERE id = p_post_id
    AND post_type = 'support_request';

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
