-- Allow eligible student accounts to discover other eligible students for friend requests.
-- Keep guardian controls, community consent, account status, and block rules authoritative.
CREATE OR REPLACE FUNCTION public.find_student_by_username(_username text)
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

-- Prevent bypassing the student-only discovery flow by calling the request RPC with
-- arbitrary account IDs. Friend requests are a student-to-student feature.
CREATE OR REPLACE FUNCTION public.send_friend_request(p_target_user_id uuid)
RETURNS public.friends
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_friend public.friends%rowtype;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_target_user_id IS NULL OR p_target_user_id = v_uid THEN
    RAISE EXCEPTION 'Invalid friend target';
  END IF;
  IF NOT private.has_role_for_user(v_uid, 'student'::public.app_role)
     OR NOT private.has_role_for_user(p_target_user_id, 'student'::public.app_role) THEN
    RAISE EXCEPTION 'Friend requests are only available between student accounts';
  END IF;
  IF NOT public.has_accepted_policy('community_terms', '2026-11-24') THEN
    RAISE EXCEPTION 'Please accept the current Terms of Use';
  END IF;
  IF NOT public.is_user_feature_enabled(v_uid, 'friend_requests')
     OR NOT public.is_user_feature_enabled(p_target_user_id, 'friend_requests') THEN
    RAISE EXCEPTION 'Friend requests are disabled by the parent or guardian settings';
  END IF;
  IF public.are_users_blocked(v_uid, p_target_user_id) THEN
    RAISE EXCEPTION 'This user cannot be contacted';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.friends f
    WHERE (f.user_id = v_uid AND f.friend_id = p_target_user_id)
       OR (f.user_id = p_target_user_id AND f.friend_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'A friend request or friendship already exists';
  END IF;

  INSERT INTO public.friends(user_id, friend_id, status)
  VALUES (v_uid, p_target_user_id, 'pending')
  RETURNING * INTO v_friend;
  RETURN v_friend;
END;
$function$;
