-- Manager + Super Admin control center tables and server-side operations.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active','suspended','banned','purged'));

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx
  ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_id_idx
  ON public.admin_audit_logs(actor_id);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL DEFAULT 'false'::jsonb,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.platform_settings(setting_key, setting_value)
VALUES
  ('feature_social_enabled', 'true'),
  ('feature_ai_enabled', 'true'),
  ('feature_xp_enabled', 'true'),
  ('leaderboard_enabled', 'true'),
  ('grades_enabled', 'true')
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._is_manager_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
      OR public.has_role(auth.uid(), 'extreme_admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public._is_extreme_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'extreme_admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_bootstrap_self()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only an existing admin can bootstrap Super Admin access';
  END IF;

  SELECT count(*) INTO v_existing
  FROM public.user_roles
  WHERE role = 'extreme_admin'::public.app_role;

  IF v_existing > 0 THEN
    RAISE EXCEPTION 'A Super Admin already exists';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = auth.uid();
  INSERT INTO public.user_roles(user_id, role)
  VALUES (auth.uid(), 'extreme_admin'::public.app_role);

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'bootstrap_super_admin', 'user', auth.uid(), jsonb_build_object('source','existing_admin'));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_get_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public._is_manager_or_admin() THEN
    RAISE EXCEPTION 'Manager access required';
  END IF;

  SELECT jsonb_build_object(
    'total_students', (SELECT count(*) FROM public.user_roles WHERE role='student'),
    'total_teachers', (SELECT count(*) FROM public.user_roles WHERE role='teacher'),
    'total_posts', (SELECT count(*) FROM public.social_posts),
    'total_messages', (SELECT count(*) FROM public.messages),
    'total_groups', (SELECT count(*) FROM public.chat_groups),
    'pending_reports', (SELECT count(*) FROM public.reports WHERE status='pending'),
    'total_quizzes', (SELECT count(*) FROM public.quizzes),
    'total_flashcards', (SELECT count(*) FROM public.flashcards),
    'active_users_10m', (SELECT count(*) FROM public.user_presence WHERE last_seen > now() - interval '10 minutes')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_list_users(
  p_search text DEFAULT NULL,
  p_role public.app_role DEFAULT NULL,
  p_limit integer DEFAULT 100,
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
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.username, p.grade, p.xp, p.level,
         COALESCE(ur.role, 'student'::public.app_role),
         p.account_status, p.created_at
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT role FROM public.user_roles r WHERE r.user_id=p.id LIMIT 1
  ) ur ON true
  WHERE public._is_manager_or_admin()
    AND (p_search IS NULL OR p.name ILIKE '%'||p_search||'%' OR p.username ILIKE '%'||p_search||'%')
    AND (p_role IS NULL OR COALESCE(ur.role, 'student'::public.app_role)=p_role)
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 250))
  OFFSET GREATEST(0, p_offset);
$$;

CREATE OR REPLACE FUNCTION public.manager_set_student_status(
  p_user_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  IF NOT public._is_manager_or_admin() THEN
    RAISE EXCEPTION 'Manager access required';
  END IF;
  IF p_status NOT IN ('active','suspended','banned') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT role INTO v_role FROM public.user_roles WHERE user_id=p_user_id LIMIT 1;
  IF v_role IS NULL OR v_role <> 'student'::public.app_role THEN
    RAISE EXCEPTION 'Managers can only moderate student accounts';
  END IF;

  UPDATE public.profiles SET account_status=p_status, updated_at=now() WHERE id=p_user_id;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'manager_set_student_status', 'user', p_user_id,
          jsonb_build_object('status',p_status,'reason',p_reason));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_get_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Super Admin access required';
  END IF;

  RETURN jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'students', (SELECT count(*) FROM public.user_roles WHERE role='student'),
    'teachers', (SELECT count(*) FROM public.user_roles WHERE role='teacher'),
    'managers', (SELECT count(*) FROM public.user_roles WHERE role='manager'),
    'admins', (SELECT count(*) FROM public.user_roles WHERE role='admin'),
    'super_admins', (SELECT count(*) FROM public.user_roles WHERE role='extreme_admin'),
    'messages', (SELECT count(*) FROM public.messages),
    'group_messages', (SELECT count(*) FROM public.group_messages),
    'room_messages', (SELECT count(*) FROM public.room_chat_messages),
    'lobby_messages', (SELECT count(*) FROM public.lobby_messages),
    'ai_conversations', (SELECT count(*) FROM public.ai_tutor_conversations),
    'reports', (SELECT count(*) FROM public.reports),
    'pending_reports', (SELECT count(*) FROM public.reports WHERE status='pending'),
    'posts', (SELECT count(*) FROM public.social_posts),
    'books', (SELECT count(*) FROM public.library_books),
    'active_users_10m', (SELECT count(*) FROM public.user_presence WHERE last_seen > now() - interval '10 minutes')
  );
END;
$$;

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
SET search_path = public
AS $$
  SELECT p.id, p.name, p.username, p.grade, p.xp, p.level,
         COALESCE(ur.role, 'student'::public.app_role),
         p.account_status,
         COALESCE(uc.coins,0),
         p.created_at
  FROM public.profiles p
  LEFT JOIN LATERAL (SELECT role FROM public.user_roles r WHERE r.user_id=p.id LIMIT 1) ur ON true
  LEFT JOIN LATERAL (SELECT coins FROM public.user_currency c WHERE c.user_id=p.id LIMIT 1) uc ON true
  WHERE public._is_extreme_admin()
    AND (p_search IS NULL OR p.name ILIKE '%'||p_search||'%' OR p.username ILIKE '%'||p_search||'%')
    AND (p_role IS NULL OR COALESCE(ur.role, 'student'::public.app_role)=p_role)
  ORDER BY p.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500))
  OFFSET GREATEST(0, p_offset);
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_get_chat_archive(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 200,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  channel text,
  sender_id uuid,
  sender_name text,
  receiver_id uuid,
  receiver_name text,
  content text,
  created_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Super Admin access required';
  END IF;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, metadata)
  VALUES (auth.uid(), 'view_chat_archive', 'chat', jsonb_build_object('search',p_search,'limit',p_limit,'offset',p_offset));

  RETURN QUERY
  WITH all_messages AS (
    SELECT m.id, 'direct'::text AS channel, m.sender_id,
           ps.name AS sender_name, m.receiver_id, pr.name AS receiver_name,
           m.content, m.created_at,
           jsonb_build_object('read',m.read) AS metadata
    FROM public.messages m
    LEFT JOIN public.profiles ps ON ps.id=m.sender_id
    LEFT JOIN public.profiles pr ON pr.id=m.receiver_id

    UNION ALL

    SELECT gm.id, 'group'::text, gm.sender_id,
           p.name, NULL::uuid, NULL::text, gm.content, gm.created_at,
           jsonb_build_object('group_id',gm.group_id,'message_type',gm.message_type,'attachment_url',gm.attachment_url,'reply_to_id',gm.reply_to_id)
    FROM public.group_messages gm
    LEFT JOIN public.profiles p ON p.id=gm.sender_id

    UNION ALL

    SELECT pm.id, 'parent'::text, pm.student_id,
           p.name, NULL::uuid, NULL::text, pm.message, pm.created_at,
           jsonb_build_object('emoji',pm.emoji,'read',pm.read)
    FROM public.parent_messages pm
    LEFT JOIN public.profiles p ON p.id=pm.student_id

    UNION ALL

    SELECT rm.id, 'multiplayer'::text, rm.user_id,
           p.name, NULL::uuid, NULL::text, rm.content, rm.created_at,
           jsonb_build_object('room_id',rm.room_id)
    FROM public.room_chat_messages rm
    LEFT JOIN public.profiles p ON p.id=rm.user_id

    UNION ALL

    SELECT lm.id, 'lobby'::text, lm.user_id,
           p.name, NULL::uuid, NULL::text, lm.content, lm.created_at,
           '{}'::jsonb
    FROM public.lobby_messages lm
    LEFT JOIN public.profiles p ON p.id=lm.user_id

    UNION ALL

    SELECT c.id, 'ai_tutor'::text, c.user_id,
           p.name, NULL::uuid, NULL::text, c.messages::text, c.created_at,
           jsonb_build_object('subject',c.subject,'updated_at',c.updated_at)
    FROM public.ai_tutor_conversations c
    LEFT JOIN public.profiles p ON p.id=c.user_id
  )
  SELECT am.*
  FROM all_messages am
  WHERE p_search IS NULL
     OR am.content ILIKE '%'||p_search||'%'
     OR COALESCE(am.sender_name,'') ILIKE '%'||p_search||'%'
     OR COALESCE(am.receiver_name,'') ILIKE '%'||p_search||'%'
  ORDER BY am.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500))
  OFFSET GREATEST(0, p_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_get_audit_logs(p_limit integer DEFAULT 100)
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.actor_id, p.name, l.action, l.target_type, l.target_id, l.metadata, l.created_at
  FROM public.admin_audit_logs l
  LEFT JOIN public.profiles p ON p.id=l.actor_id
  WHERE public._is_extreme_admin()
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500));
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_update_user_role(
  p_user_id uuid,
  p_role public.app_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Super Admin access required';
  END IF;
  IF p_user_id = auth.uid() AND p_role <> 'extreme_admin'::public.app_role THEN
    RAISE EXCEPTION 'The active Super Admin cannot demote itself';
  END IF;

  DELETE FROM public.user_roles WHERE user_id=p_user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (p_user_id,p_role);

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'update_user_role', 'user', p_user_id, jsonb_build_object('role',p_role));

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
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Super Admin access required';
  END IF;
  IF p_status NOT IN ('active','suspended','banned') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  IF p_user_id=auth.uid() AND p_status<>'active' THEN
    RAISE EXCEPTION 'The active Super Admin cannot suspend or ban itself';
  END IF;

  UPDATE public.profiles SET account_status=p_status, updated_at=now() WHERE id=p_user_id;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'set_user_status', 'user', p_user_id, jsonb_build_object('status',p_status,'reason',p_reason));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_adjust_economy(
  p_user_id uuid,
  p_xp_delta integer DEFAULT 0,
  p_coin_delta integer DEFAULT 0,
  p_reset_progress boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Super Admin access required';
  END IF;

  IF p_reset_progress THEN
    UPDATE public.profiles SET xp=0, level=1, season_xp=0, updated_at=now() WHERE id=p_user_id;
    UPDATE public.user_currency SET coins=0, gems=0, updated_at=now() WHERE user_id=p_user_id;
  ELSE
    UPDATE public.profiles SET xp=GREATEST(0,xp+p_xp_delta), season_xp=GREATEST(0,season_xp+p_xp_delta), updated_at=now() WHERE id=p_user_id;
    INSERT INTO public.user_currency(user_id,coins,gems)
      VALUES (p_user_id,GREATEST(0,p_coin_delta),0)
      ON CONFLICT (user_id) DO UPDATE
      SET coins=GREATEST(0,user_currency.coins+p_coin_delta), updated_at=now();
  END IF;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), CASE WHEN p_reset_progress THEN 'reset_user_progress' ELSE 'adjust_user_economy' END,
          'user', p_user_id, jsonb_build_object('xp_delta',p_xp_delta,'coin_delta',p_coin_delta,'reset',p_reset_progress));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_delete_message(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._is_extreme_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  DELETE FROM public.messages WHERE id=p_message_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message not found'; END IF;
  INSERT INTO public.admin_audit_logs(actor_id,action,target_type,target_id)
  VALUES(auth.uid(),'delete_direct_message','message',p_message_id);
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
  IF NOT public._is_extreme_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  DELETE FROM public.social_posts WHERE id=p_post_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post not found'; END IF;
  INSERT INTO public.admin_audit_logs(actor_id,action,target_type,target_id)
  VALUES(auth.uid(),'delete_social_post','social_post',p_post_id);
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
  IF NOT public._is_extreme_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  DELETE FROM public.library_books WHERE id=p_book_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Book not found'; END IF;
  INSERT INTO public.admin_audit_logs(actor_id,action,target_type,target_id)
  VALUES(auth.uid(),'delete_library_book','library_book',p_book_id);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_get_settings()
RETURNS TABLE(setting_key text, setting_value jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT setting_key, setting_value
  FROM public.platform_settings
  WHERE public._is_extreme_admin()
  ORDER BY setting_key;
$$;

CREATE OR REPLACE FUNCTION public.extreme_admin_set_setting(p_key text,p_value boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._is_extreme_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  INSERT INTO public.platform_settings(setting_key,setting_value,updated_by,updated_at)
  VALUES(p_key,to_jsonb(p_value),auth.uid(),now())
  ON CONFLICT(setting_key) DO UPDATE
    SET setting_value=EXCLUDED.setting_value,updated_by=auth.uid(),updated_at=now();
  INSERT INTO public.admin_audit_logs(actor_id,action,target_type,metadata)
  VALUES(auth.uid(),'set_platform_setting','setting',jsonb_build_object('key',p_key,'value',p_value));
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.manager_get_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_list_users(text,public.app_role,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_set_student_status(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_bootstrap_self() TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_list_users(text,public.app_role,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_chat_archive(text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_audit_logs(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_update_user_role(uuid,public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_user_status(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_adjust_economy(uuid,integer,integer,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_delete_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_delete_social_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_delete_library_book(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_setting(text,boolean) TO authenticated;
