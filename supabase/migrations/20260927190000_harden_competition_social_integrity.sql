CREATE UNIQUE INDEX IF NOT EXISTS friends_user_pair_unique ON public.friends (LEAST(user_id, friend_id), GREATEST(user_id, friend_id));

-- Harden multiplayer room mutations and tournament completion.
CREATE OR REPLACE FUNCTION public.send_friend_request(p_target_user_id uuid)
RETURNS public.friends LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_friend public.friends%rowtype; v_existing public.friends%rowtype;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_target_user_id IS NULL OR p_target_user_id=v_uid THEN RAISE EXCEPTION 'Invalid friend target'; END IF;
 SELECT * INTO v_existing FROM public.friends WHERE (user_id=v_uid AND friend_id=p_target_user_id) OR (user_id=p_target_user_id AND friend_id=v_uid) LIMIT 1 FOR UPDATE;
 IF FOUND THEN
   IF v_existing.status='accepted' THEN RAISE EXCEPTION 'Already friends'; END IF;
   RAISE EXCEPTION 'Friend request already exists';
 END IF;
 INSERT INTO public.friends(user_id,friend_id,status) VALUES(v_uid,p_target_user_id,'pending') RETURNING * INTO v_friend;
 RETURN v_friend;
END; $$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(p_request_id uuid,p_accept boolean)
RETURNS public.friends LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_friend public.friends%rowtype;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO v_friend FROM public.friends WHERE id=p_request_id AND friend_id=v_uid AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Friend request not found'; END IF;
 IF p_accept THEN
   UPDATE public.friends SET status='accepted',updated_at=now() WHERE id=p_request_id RETURNING * INTO v_friend;
 ELSE
   DELETE FROM public.friends WHERE id=p_request_id RETURNING * INTO v_friend;
 END IF;
 RETURN v_friend;
END; $$;

CREATE OR REPLACE FUNCTION public.remove_friend(p_friendship_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 DELETE FROM public.friends WHERE id=p_friendship_id AND (user_id=v_uid OR friend_id=v_uid);
 RETURN FOUND;
END; $$;

CREATE OR REPLACE FUNCTION public.send_direct_message(p_receiver_id uuid,p_content text)
RETURNS public.messages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_message public.messages%rowtype; v_content text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_receiver_id IS NULL OR p_receiver_id=v_uid THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
 v_content:=left(trim(coalesce(p_content,'')),2000);
 IF v_content='' THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
 INSERT INTO public.messages(sender_id,receiver_id,content) VALUES(v_uid,p_receiver_id,v_content) RETURNING * INTO v_message;
 RETURN v_message;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_direct_message_read(p_message_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid();
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 UPDATE public.messages SET read=true WHERE id=p_message_id AND receiver_id=v_uid;
 RETURN FOUND;
END; $$;

CREATE OR REPLACE FUNCTION public.multiplayer_create_room(
 p_name text,p_subject text,p_difficulty text,p_question_count integer,p_max_players integer,p_password text default null
)
RETURNS public.multiplayer_rooms LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_room public.multiplayer_rooms%rowtype;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_max_players<2 OR p_max_players>32 THEN RAISE EXCEPTION 'Invalid player limit'; END IF;
 IF p_question_count<1 OR p_question_count>50 THEN RAISE EXCEPTION 'Invalid question count'; END IF;
 INSERT INTO public.multiplayer_rooms(name,host_id,max_players,subject,difficulty,question_count,password,status)
 VALUES(left(trim(coalesce(p_name,'Room')),80),v_uid,p_max_players,coalesce(nullif(trim(p_subject),''),'Mixed'),coalesce(nullif(trim(p_difficulty),''),'Medium'),p_question_count,nullif(p_password,''),'waiting')
 RETURNING * INTO v_room;
 INSERT INTO public.room_players(room_id,user_id,is_ready) VALUES(v_room.id,v_uid,true);
 RETURN v_room;
END; $$;

CREATE OR REPLACE FUNCTION public.multiplayer_join_room(p_room_id uuid,p_password text default null)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_room public.multiplayer_rooms%rowtype; v_count integer;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO v_room FROM public.multiplayer_rooms WHERE id=p_room_id FOR UPDATE;
 IF NOT FOUND OR v_room.status NOT IN ('waiting','countdown','playing') THEN RAISE EXCEPTION 'Room is no longer available'; END IF;
 IF v_room.password IS NOT NULL AND v_room.password<>coalesce(p_password,'') THEN RAISE EXCEPTION 'Incorrect password'; END IF;
 IF EXISTS (SELECT 1 FROM public.room_players WHERE room_id=p_room_id AND user_id=v_uid) THEN RETURN true; END IF;
 SELECT count(*) INTO v_count FROM public.room_players WHERE room_id=p_room_id;
 IF v_count>=v_room.max_players THEN RAISE EXCEPTION 'Room is full'; END IF;
 INSERT INTO public.room_players(room_id,user_id,is_ready) VALUES(p_room_id,v_uid,false);
 RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.multiplayer_leave_room(p_room_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_host uuid; v_next uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT host_id INTO v_host FROM public.multiplayer_rooms WHERE id=p_room_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.room_players WHERE room_id=p_room_id AND user_id=v_uid) THEN RETURN false; END IF;
 DELETE FROM public.room_players WHERE room_id=p_room_id AND user_id=v_uid;
 IF v_host=v_uid THEN
   SELECT user_id INTO v_next FROM public.room_players WHERE room_id=p_room_id ORDER BY created_at LIMIT 1;
   IF v_next IS NULL THEN
     DELETE FROM public.multiplayer_rooms WHERE id=p_room_id;
   ELSE
     UPDATE public.multiplayer_rooms SET host_id=v_next WHERE id=p_room_id;
   END IF;
 END IF;
 RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.multiplayer_ensure_membership(p_room_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_status text; v_max integer; v_count integer;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT status,max_players INTO v_status,v_max FROM public.multiplayer_rooms WHERE id=p_room_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
 IF v_status NOT IN ('waiting','countdown','playing') THEN RAISE EXCEPTION 'Room is no longer active'; END IF;
 IF EXISTS (SELECT 1 FROM public.room_players WHERE room_id=p_room_id AND user_id=v_uid) THEN RETURN true; END IF;
 SELECT count(*) INTO v_count FROM public.room_players WHERE room_id=p_room_id;
 IF v_count>=v_max THEN RAISE EXCEPTION 'Room is full'; END IF;
 INSERT INTO public.room_players(room_id,user_id,is_ready) VALUES(p_room_id,v_uid,false);
 RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.multiplayer_toggle_ready(p_room_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_ready boolean;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT is_ready INTO v_ready FROM public.room_players WHERE room_id=p_room_id AND user_id=v_uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'You are not in this room'; END IF;
 IF EXISTS (SELECT 1 FROM public.multiplayer_rooms WHERE id=p_room_id AND status NOT IN ('waiting','countdown')) THEN RAISE EXCEPTION 'Ready state cannot be changed after the game starts'; END IF;
 UPDATE public.room_players SET is_ready=NOT COALESCE(v_ready,false) WHERE room_id=p_room_id AND user_id=v_uid;
 RETURN NOT COALESCE(v_ready,false);
END; $$;

CREATE OR REPLACE FUNCTION public.multiplayer_update_room(p_room_id uuid,p_subject text,p_difficulty text,p_game_mode text,p_question_count integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_host uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT host_id INTO v_host FROM public.multiplayer_rooms WHERE id=p_room_id AND status='waiting' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room not found or already started'; END IF;
 IF v_host<>v_uid THEN RAISE EXCEPTION 'Only the host can update room settings'; END IF;
 IF p_question_count IS NULL OR p_question_count<1 OR p_question_count>50 THEN RAISE EXCEPTION 'Question count must be between 1 and 50'; END IF;
 UPDATE public.multiplayer_rooms SET subject=coalesce(nullif(trim(p_subject),''),'Mixed'),difficulty=coalesce(nullif(trim(p_difficulty),''),'Medium'),game_mode=coalesce(nullif(trim(p_game_mode),''),game_mode),question_count=p_question_count WHERE id=p_room_id;
 RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.multiplayer_kick_player(p_room_id uuid,p_player_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_host uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT host_id INTO v_host FROM public.multiplayer_rooms WHERE id=p_room_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
 IF v_host<>v_uid THEN RAISE EXCEPTION 'Only the host can remove players'; END IF;
 IF p_player_id=v_uid THEN RAISE EXCEPTION 'Host cannot kick themselves'; END IF;
 DELETE FROM public.room_players WHERE room_id=p_room_id AND user_id=p_player_id;
 RETURN FOUND;
END; $$;

CREATE OR REPLACE FUNCTION public.multiplayer_send_room_message(p_room_id uuid,p_content text)
RETURNS public.room_chat_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_message public.room_chat_messages%rowtype; v_content text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.room_players WHERE room_id=p_room_id AND user_id=v_uid) THEN RAISE EXCEPTION 'You are not in this room'; END IF;
 v_content:=left(trim(coalesce(p_content,'')),80);
 IF v_content='' THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
 INSERT INTO public.room_chat_messages(room_id,user_id,content) VALUES(p_room_id,v_uid,v_content) RETURNING * INTO v_message;
 RETURN v_message;
END; $$;

CREATE OR REPLACE FUNCTION public.multiplayer_start_game(p_room_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_host_id uuid; v_subject text; v_difficulty text; v_question_count integer; v_players integer;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT host_id,subject,difficulty,question_count INTO v_host_id,v_subject,v_difficulty,v_question_count FROM public.multiplayer_rooms WHERE id=p_room_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
 IF v_host_id<>v_uid THEN RAISE EXCEPTION 'Only the host can start the game'; END IF;
 SELECT count(*) INTO v_players FROM public.room_players WHERE room_id=p_room_id;
 IF v_players<2 THEN RAISE EXCEPTION 'At least 2 players are required'; END IF;
 DELETE FROM public.room_answers WHERE room_id=p_room_id;
 DELETE FROM public.room_questions WHERE room_id=p_room_id;
 UPDATE public.room_players SET score=0 WHERE room_id=p_room_id;
 INSERT INTO public.room_questions(room_id,question_id,order_index)
 SELECT p_room_id,q.id,row_number() OVER (ORDER BY random())-1 FROM public.questions q JOIN public.quizzes qz ON q.quiz_id=qz.id
 WHERE qz.is_approved=true AND (v_subject IS NULL OR qz.subject=v_subject) AND (v_difficulty IS NULL OR qz.difficulty=v_difficulty)
 ORDER BY random() LIMIT greatest(1,least(coalesce(v_question_count,10),50));
 IF NOT EXISTS (SELECT 1 FROM public.room_questions WHERE room_id=p_room_id) THEN RAISE EXCEPTION 'No approved questions are available for this room'; END IF;
 INSERT INTO public.room_state(room_id,status,question_index,current_question_id,question_started_at,question_ends_at)
 VALUES(p_room_id,'countdown',0,NULL,NULL,NULL) ON CONFLICT(room_id) DO UPDATE SET status='countdown',question_index=0,current_question_id=NULL,question_started_at=NULL,question_ends_at=NULL,updated_at=now();
 UPDATE public.multiplayer_rooms SET status='playing',started_at=now(),finished_at=NULL WHERE id=p_room_id;
 RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.multiplayer_next_question(p_room_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_host uuid; v_state public.room_state%rowtype; v_next uuid; v_data jsonb; v_total integer;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT host_id INTO v_host FROM public.multiplayer_rooms WHERE id=p_room_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
 IF v_host<>v_uid THEN RAISE EXCEPTION 'Only the host can advance the question'; END IF;
 SELECT * INTO v_state FROM public.room_state WHERE room_id=p_room_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Room state not found'; END IF;
 SELECT count(*) INTO v_total FROM public.room_questions WHERE room_id=p_room_id;
 IF v_total=0 THEN RAISE EXCEPTION 'No questions configured for this room'; END IF;
 IF v_state.status='finished' THEN RETURN jsonb_build_object('status','finished'); END IF;
 IF v_state.question_index>=v_total THEN
  UPDATE public.room_state SET status='finished',updated_at=now() WHERE room_id=p_room_id;
  UPDATE public.multiplayer_rooms SET status='finished',finished_at=now() WHERE id=p_room_id;
  RETURN jsonb_build_object('status','finished');
 END IF;
 SELECT question_id INTO v_next FROM public.room_questions WHERE room_id=p_room_id AND order_index=v_state.question_index;
 IF v_next IS NULL THEN RAISE EXCEPTION 'Question sequence is invalid'; END IF;
 SELECT jsonb_build_object('id',q.id,'question_text',q.question_text,'options',q.options,'points',q.points) INTO v_data FROM public.questions q WHERE q.id=v_next;
 UPDATE public.room_state SET status='playing',current_question_id=v_next,question_started_at=now(),question_ends_at=now()+interval '30 seconds',question_index=v_state.question_index+1,updated_at=now() WHERE room_id=p_room_id;
 RETURN jsonb_build_object('status','playing','question',v_data,'question_index',v_state.question_index+1,'total_questions',v_total);
END; $$;

REVOKE ALL ON FUNCTION public.complete_match_and_progress(uuid,uuid,integer,integer,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_match_and_progress(uuid,uuid,integer,integer,boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_direct_message_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_create_room(text,text,text,integer,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_join_room(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_leave_room(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_ensure_membership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_toggle_ready(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_update_room(uuid,text,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_kick_player(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_send_room_message(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_start_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.multiplayer_next_question(uuid) TO authenticated;