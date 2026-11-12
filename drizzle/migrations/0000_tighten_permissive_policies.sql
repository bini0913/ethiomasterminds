CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM room_players WHERE room_id = p_room_id AND user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM multiplayer_rooms WHERE id = p_room_id AND host_id = p_user_id)
$$;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) TO authenticated;

-- Signed-in only (shared community/game data)
DROP POLICY IF EXISTS "Anyone can view comments" ON public.social_post_comments;
CREATE POLICY "Signed-in users can view comments" ON public.social_post_comments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone can view lobby messages" ON public.lobby_messages;
CREATE POLICY "Signed-in users can view lobby messages" ON public.lobby_messages FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone authed views season history" ON public.season_history;
CREATE POLICY "Signed-in users view season history" ON public.season_history FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone authed views participants" ON public.study_participants;
CREATE POLICY "Signed-in users view study participants" ON public.study_participants FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone authed views live status" ON public.study_live_status;
CREATE POLICY "Signed-in users view live status" ON public.study_live_status FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone can view presence" ON public.user_presence;
CREATE POLICY "Signed-in users view presence" ON public.user_presence FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone authed views competitions" ON public.study_competitions;
CREATE POLICY "Signed-in users view competitions" ON public.study_competitions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone can view posts" ON public.social_posts;
CREATE POLICY "Signed-in users view posts" ON public.social_posts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Signed-in users can view profiles" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone can view participants" ON public.tournament_participants;
CREATE POLICY "Signed-in users view tournament participants" ON public.tournament_participants FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone authed views season state" ON public.season_runtime_state;
CREATE POLICY "Signed-in users view season state" ON public.season_runtime_state FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone can view likes" ON public.social_post_likes;
CREATE POLICY "Signed-in users view likes" ON public.social_post_likes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Users can view all reactions" ON public.social_post_reactions;
CREATE POLICY "Signed-in users view reactions" ON public.social_post_reactions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone can view follows" ON public.followers;
CREATE POLICY "Signed-in users view follows" ON public.followers FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone can view room players" ON public.room_players;
CREATE POLICY "Signed-in users view room players" ON public.room_players FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- Room-scoped data: only members of the room
DROP POLICY IF EXISTS "Anyone can view room questions" ON public.room_questions;
CREATE POLICY "Room members view room questions" ON public.room_questions FOR SELECT TO authenticated USING (public.is_room_member(room_id, auth.uid()));
DROP POLICY IF EXISTS "Anyone can view room answers" ON public.room_answers;
CREATE POLICY "Room members view room answers" ON public.room_answers FOR SELECT TO authenticated USING (public.is_room_member(room_id, auth.uid()));
DROP POLICY IF EXISTS "Anyone can view room chat" ON public.room_chat_messages;
CREATE POLICY "Room members view room chat" ON public.room_chat_messages FOR SELECT TO authenticated USING (public.is_room_member(room_id, auth.uid()));
DROP POLICY IF EXISTS "Anyone can view room state" ON public.room_state;
CREATE POLICY "Room members view room state" ON public.room_state FOR SELECT TO authenticated USING (public.is_room_member(room_id, auth.uid()));

-- Storage: bind writes to the uploader's own folder
DROP POLICY IF EXISTS "Authenticated users can upload library files" ON storage.objects;
CREATE POLICY "Authenticated users can upload library files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'library-files' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Authenticated users can upload library thumbnails" ON storage.objects;
CREATE POLICY "Authenticated users can upload library thumbnails" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'library-thumbnails' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users can update own library files" ON storage.objects;
CREATE POLICY "Users can update own library files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('library-files','library-thumbnails') AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')))
  WITH CHECK (bucket_id IN ('library-files','library-thumbnails') AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));
DROP POLICY IF EXISTS "Users can delete own library files" ON storage.objects;
CREATE POLICY "Users can delete own library files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('library-files','library-thumbnails') AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')));
DROP POLICY IF EXISTS "Authenticated users can upload social images" ON storage.objects;
CREATE POLICY "Authenticated users can upload social images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'social-images' AND (storage.foldername(name))[1] = auth.uid()::text);