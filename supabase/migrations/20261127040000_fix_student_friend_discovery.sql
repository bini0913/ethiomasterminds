-- Allow eligible student accounts to discover other eligible students for friend requests.
-- Keep guardian controls, community consent, account status, and block rules authoritative.
CREATE OR REPLACE FUNCTION public.search_students_for_friend_requests(_username text)
RETURNS TABLE(id uuid, name text, username text, avatar text, level integer, xp integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_query text := lower(btrim(coalesce(_username, '')));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF length(v_query) < 2 OR length(v_query) > 64 THEN
    RETURN;
  END IF;

  IF NOT public.has_accepted_policy('community_terms', '2026-11-24')
     OR NOT public.is_user_feature_enabled(v_uid, 'social')
     OR NOT public.is_user_feature_enabled(v_uid, 'friend_requests')
     OR NOT private.has_role_for_user(v_uid, 'student'::public.app_role) THEN
    RAISE EXCEPTION 'Student discovery is disabled by parent or guardian settings';
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.username, p.avatar, p.level, p.xp
  FROM public.profiles p
  WHERE p.id <> v_uid
    AND coalesce(p.account_status, 'active') = 'active'
    AND private.has_role_for_user(p.id, 'student'::public.app_role)
    AND public.is_user_feature_enabled(p.id, 'social')
    AND public.is_user_feature_enabled(p.id, 'friend_requests')
    AND NOT public.are_users_blocked(v_uid, p.id)
    AND (
      lower(coalesce(p.username, '')) LIKE '%' || v_query || '%'
      OR lower(coalesce(p.name, '')) LIKE '%' || v_query || '%'
    )
  ORDER BY
    CASE WHEN lower(coalesce(p.username, '')) = v_query THEN 0 ELSE 1 END,
    lower(coalesce(p.username, '')),
    p.id
  LIMIT 20;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_students_for_friend_requests(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_students_for_friend_requests(text) TO authenticated;

