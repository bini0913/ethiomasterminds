-- Restore production dependencies used by the Grades 9-12 student experience.
-- This migration is intentionally additive and safe to re-run.

-- 1) Edge-function rate limiting was present in the repo but missing from production.
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
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_bucket IS NULL OR length(trim(p_bucket)) = 0
     OR p_limit < 1 OR p_limit > 300
     OR p_window_seconds < 10 OR p_window_seconds > 3600 THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters';
  END IF;

  SELECT * INTO v_row
  FROM public.edge_request_rate_limits
  WHERE user_id = uid AND bucket = trim(p_bucket)
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
     WHERE user_id = uid AND bucket = trim(p_bucket);
    RETURN true;
  END IF;

  IF v_row.request_count >= p_limit THEN RETURN false; END IF;

  UPDATE public.edge_request_rate_limits
     SET request_count = request_count + 1
   WHERE user_id = uid AND bucket = trim(p_bucket);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(text, integer, integer) TO authenticated;

-- 2) Restore the room cleanup RPC expected by RoomContext.
CREATE OR REPLACE FUNCTION public.cleanup_expired_multiplayer_rooms()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  v_deleted integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  DELETE FROM public.multiplayer_rooms
  WHERE status IN ('waiting','countdown')
    AND created_at < now() - interval '30 minutes';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$;

REVOKE ALL ON FUNCTION public.cleanup_expired_multiplayer_rooms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_multiplayer_rooms() TO authenticated;

-- 3) Restore the room lifecycle RPCs expected by RoomContext.
CREATE OR REPLACE FUNCTION public.multiplayer_create_room(
  p_name text,
  p_subject text,
  p_difficulty text,
  p_question_count integer,
  p_max_players integer,
  p_password text DEFAULT NULL
)
RETURNS public.multiplayer_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_room public.multiplayer_rooms%ROWTYPE;
  v_max_players integer := greatest(2, least(coalesce(p_max_players, 8), 8));
  v_question_count integer := greatest(1, least(coalesce(p_question_count, 10), 50));
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF nullif(trim(p_name), '') IS NULL THEN RAISE EXCEPTION 'Room name is required'; END IF;
  IF p_difficulty IS NULL OR p_difficulty NOT IN ('Easy','Medium','Hard') THEN
    RAISE EXCEPTION 'Invalid difficulty';
  END IF;

  INSERT INTO public.multiplayer_rooms (
    name, host_id, max_players, subject, difficulty, question_count, password, status, game_mode
  )
  VALUES (
    left(trim(p_name), 100),
    v_user_id,
    v_max_players,
    nullif(trim(p_subject), ''),
    p_difficulty,
    v_question_count,
    nullif(p_password, ''),
    'waiting',
    'classic'
  )
  RETURNING * INTO v_room;

  INSERT INTO public.room_players(room_id, user_id, is_ready)
  VALUES (v_room.id, v_user_id, true)
  ON CONFLICT (room_id, user_id) DO UPDATE SET is_ready = true;

  RETURN v_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.multiplayer_join_room(
  p_room_id uuid,
  p_password text DEFAULT NULL
)
RETURNS public.multiplayer_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_room public.multiplayer_rooms%ROWTYPE;
  v_player_count integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_room
  FROM public.multiplayer_rooms
  WHERE id = p_room_id
    AND status IN ('waiting','countdown','playing')
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Room is no longer available'; END IF;
  IF v_room.password IS DISTINCT FROM nullif(p_password, '') THEN
    RAISE EXCEPTION 'Incorrect room password';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.room_players
    WHERE room_id = p_room_id AND user_id = v_user_id
  ) THEN
    RETURN v_room;
  END IF;

  SELECT count(*) INTO v_player_count
  FROM public.room_players
  WHERE room_id = p_room_id;

  IF v_player_count >= v_room.max_players THEN
    RAISE EXCEPTION 'Room is full';
  END IF;

  INSERT INTO public.room_players(room_id, user_id, is_ready)
  VALUES (p_room_id, v_user_id, false);

  RETURN v_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.multiplayer_leave_room(
  p_room_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_host_id uuid;
  v_next_host uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT host_id INTO v_host_id
  FROM public.multiplayer_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF v_host_id IS NULL THEN RETURN false; END IF;

  DELETE FROM public.room_players
  WHERE room_id = p_room_id AND user_id = v_user_id;

  IF v_host_id = v_user_id THEN
    SELECT user_id INTO v_next_host
    FROM public.room_players
    WHERE room_id = p_room_id
    ORDER BY joined_at ASC
    LIMIT 1;

    IF v_next_host IS NULL THEN
      DELETE FROM public.multiplayer_rooms WHERE id = p_room_id;
    ELSE
      UPDATE public.multiplayer_rooms
      SET host_id = v_next_host
      WHERE id = p_room_id;
    END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.multiplayer_create_room(text,text,text,integer,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.multiplayer_join_room(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.multiplayer_leave_room(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.multiplayer_create_room(text,text,text,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_join_room(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_leave_room(uuid) TO authenticated;

-- 3) Restore the newer invite signatures used by Lobby.tsx.
CREATE OR REPLACE FUNCTION public.create_multiplayer_invite(
  p_receiver_id uuid,
  p_room_id uuid DEFAULT NULL,
  p_max_players integer DEFAULT 2,
  p_subject text DEFAULT 'Mixed',
  p_difficulty text DEFAULT 'Medium'
)
RETURNS public.multiplayer_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_room public.multiplayer_rooms%ROWTYPE;
  v_invite public.multiplayer_invites%ROWTYPE;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_receiver_id = v_sender THEN RAISE EXCEPTION 'You cannot invite yourself'; END IF;

  IF p_room_id IS NULL THEN
    INSERT INTO public.multiplayer_rooms(
      name, host_id, max_players, subject, difficulty, question_count, status, game_mode
    )
    VALUES (
      'Squad Lobby', v_sender, greatest(2, least(coalesce(p_max_players,2),8)),
      coalesce(nullif(trim(p_subject),''),'Mixed'),
      coalesce(p_difficulty,'Medium'), 10, 'waiting', 'classic'
    )
    RETURNING * INTO v_room;

    INSERT INTO public.room_players(room_id,user_id,is_ready)
    VALUES (v_room.id,v_sender,true)
    ON CONFLICT (room_id,user_id) DO UPDATE SET is_ready=true;
  ELSE
    SELECT * INTO v_room FROM public.multiplayer_rooms WHERE id=p_room_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
    IF v_room.host_id <> v_sender THEN RAISE EXCEPTION 'Only the host can invite from this room'; END IF;
  END IF;

  INSERT INTO public.multiplayer_invites(sender_id,receiver_id,room_id,status,expires_at)
  VALUES (v_sender,p_receiver_id,v_room.id,'pending',now()+interval '25 seconds')
  RETURNING * INTO v_invite;

  RETURN v_invite;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_multiplayer_invite(
  p_invite_id uuid,
  p_response text
)
RETURNS public.multiplayer_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invite public.multiplayer_invites%ROWTYPE;
  v_room public.multiplayer_rooms%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_response NOT IN ('accepted','rejected') THEN RAISE EXCEPTION 'Invalid response'; END IF;

  SELECT * INTO v_invite
  FROM public.multiplayer_invites
  WHERE id=p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF v_invite.receiver_id <> v_user_id THEN RAISE EXCEPTION 'Only receiver can respond'; END IF;
  IF v_invite.status <> 'pending' THEN RETURN v_invite; END IF;

  IF v_invite.expires_at <= now() THEN
    UPDATE public.multiplayer_invites
    SET status='expired',responded_at=now()
    WHERE id=p_invite_id
    RETURNING * INTO v_invite;
    RETURN v_invite;
  END IF;

  UPDATE public.multiplayer_invites
  SET status=p_response,responded_at=now()
  WHERE id=p_invite_id
  RETURNING * INTO v_invite;

  IF p_response='accepted' THEN
    SELECT * INTO v_room FROM public.multiplayer_rooms
    WHERE id=v_invite.room_id AND status IN ('waiting','countdown','playing')
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room unavailable'; END IF;

    INSERT INTO public.room_players(room_id,user_id,is_ready)
    VALUES (v_invite.room_id,v_invite.sender_id,false)
    ON CONFLICT (room_id,user_id) DO NOTHING;

    INSERT INTO public.room_players(room_id,user_id,is_ready)
    VALUES (v_invite.room_id,v_user_id,false)
    ON CONFLICT (room_id,user_id) DO NOTHING;
  END IF;

  RETURN v_invite;
END;
$$;

REVOKE ALL ON FUNCTION public.create_multiplayer_invite(uuid,uuid,integer,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_multiplayer_invite(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_multiplayer_invite(uuid,uuid,integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_multiplayer_invite(uuid,text) TO authenticated;

-- 4) Remove anonymous execution from the Study Mode RPCs.
REVOKE EXECUTE ON FUNCTION public.start_study_session(uuid,text,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_study_session(uuid,integer,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_study_session(uuid,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_study_session(uuid,integer,uuid,boolean) TO authenticated;

-- 5) Make Library storage uploads and cleanup work reliably for authenticated students.
DROP POLICY IF EXISTS "Authenticated users can upload library files" ON storage.objects;
CREATE POLICY "Authenticated users can upload library files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'library-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Authenticated users can upload library thumbnails" ON storage.objects;
CREATE POLICY "Authenticated users can upload library thumbnails"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'library-thumbnails'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Authenticated users can delete own library files" ON storage.objects;
CREATE POLICY "Authenticated users can delete own library files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('library-files','library-thumbnails')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Authenticated users can update own library files" ON storage.objects;
CREATE POLICY "Authenticated users can update own library files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('library-files','library-thumbnails')
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id IN ('library-files','library-thumbnails')
  AND (storage.foldername(name))[1] = auth.uid()::text
);
