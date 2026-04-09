
-- ============ MULTIPLAYER INVITES ============

CREATE TABLE public.multiplayer_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  room_id uuid REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 seconds'),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.multiplayer_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invites" ON public.multiplayer_invites
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create invites" ON public.multiplayer_invites
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Receivers can update invites" ON public.multiplayer_invites
  FOR UPDATE USING (auth.uid() = receiver_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_invites;

CREATE OR REPLACE FUNCTION public.create_multiplayer_invite(
  p_receiver_id uuid,
  p_room_id uuid DEFAULT NULL,
  p_max_players int DEFAULT 2,
  p_subject text DEFAULT 'Mixed',
  p_difficulty text DEFAULT 'Medium'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_invite_id uuid;
BEGIN
  IF p_room_id IS NULL THEN
    INSERT INTO multiplayer_rooms (name, host_id, max_players, subject, difficulty, status)
    VALUES (
      'Challenge Room',
      auth.uid(),
      p_max_players,
      p_subject,
      p_difficulty,
      'waiting'
    )
    RETURNING id INTO v_room_id;

    INSERT INTO room_players (room_id, user_id, is_ready)
    VALUES (v_room_id, auth.uid(), true);
  ELSE
    v_room_id := p_room_id;
  END IF;

  INSERT INTO multiplayer_invites (sender_id, receiver_id, room_id, status, expires_at)
  VALUES (auth.uid(), p_receiver_id, v_room_id, 'pending', now() + interval '60 seconds')
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object('invite_id', v_invite_id, 'room_id', v_room_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_multiplayer_invite(
  p_invite_id uuid,
  p_response text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite multiplayer_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM multiplayer_invites WHERE id = p_invite_id AND receiver_id = auth.uid();

  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invite not found or not addressed to you';
  END IF;

  IF v_invite.status != 'pending' THEN
    RAISE EXCEPTION 'Invite already responded to';
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE multiplayer_invites SET status = 'expired', responded_at = now() WHERE id = p_invite_id;
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  UPDATE multiplayer_invites SET status = p_response, responded_at = now() WHERE id = p_invite_id;

  IF p_response = 'accepted' THEN
    INSERT INTO room_players (room_id, user_id, is_ready)
    VALUES (v_invite.room_id, auth.uid(), true)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('status', p_response, 'room_id', v_invite.room_id);
END;
$$;

-- ============ LIBRARY TABLES ============

CREATE TABLE public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL DEFAULT '',
  grade_level int,
  type text NOT NULL DEFAULT 'textbook',
  status text NOT NULL DEFAULT 'pending',
  pdf_path text NOT NULL,
  thumbnail_path text,
  uploader_id uuid NOT NULL,
  uploader_role text NOT NULL DEFAULT 'student',
  download_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved books" ON public.library_books
  FOR SELECT USING (status = 'approved' OR uploader_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Authenticated users can upload books" ON public.library_books
  FOR INSERT WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "Owners and admins can update books" ON public.library_books
  FOR UPDATE USING (uploader_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Owners and admins can delete books" ON public.library_books
  FOR DELETE USING (uploader_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE TABLE public.book_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  moderation_note text,
  moderated_by uuid,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(book_id)
);

ALTER TABLE public.book_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own uploads" ON public.book_uploads
  FOR SELECT USING (uploader_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Users can insert uploads" ON public.book_uploads
  FOR INSERT WITH CHECK (auth.uid() = uploader_id);

CREATE POLICY "Admins can update uploads" ON public.book_uploads
  FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'teacher') OR uploader_id = auth.uid());

CREATE TABLE public.book_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  can_read boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(book_id, user_id)
);

ALTER TABLE public.book_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own permissions" ON public.book_permissions
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers/admins can manage permissions" ON public.book_permissions
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'teacher'));

CREATE TABLE public.library_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(book_id, user_id)
);

ALTER TABLE public.library_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookmarks" ON public.library_bookmarks
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE public.highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  page_number int NOT NULL DEFAULT 1,
  selected_text text NOT NULL,
  highlight_color text NOT NULL DEFAULT 'yellow',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own highlights" ON public.highlights
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE public.ai_generated_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  page_number int NOT NULL DEFAULT 1,
  question text NOT NULL,
  answer text NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium',
  source_excerpt text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generated_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own questions" ON public.ai_generated_questions
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE public.reading_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  last_page int NOT NULL DEFAULT 1,
  completion_percent int NOT NULL DEFAULT 0,
  time_spent_seconds int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(book_id, user_id)
);

ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress" ON public.reading_progress
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE public.ai_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  action text NOT NULL,
  source_hash text NOT NULL,
  source_excerpt text NOT NULL DEFAULT '',
  response text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ai content" ON public.ai_content
  FOR ALL USING (auth.uid() = user_id);

-- ============ STORAGE BUCKETS ============

INSERT INTO storage.buckets (id, name, public) VALUES ('library-files', 'library-files', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('library-thumbnails', 'library-thumbnails', true);

CREATE POLICY "Anyone can view library files" ON storage.objects
  FOR SELECT USING (bucket_id = 'library-files');

CREATE POLICY "Authenticated users can upload library files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'library-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view library thumbnails" ON storage.objects
  FOR SELECT USING (bucket_id = 'library-thumbnails');

CREATE POLICY "Authenticated users can upload library thumbnails" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'library-thumbnails' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own library files" ON storage.objects
  FOR UPDATE USING (bucket_id IN ('library-files', 'library-thumbnails') AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own library files" ON storage.objects
  FOR DELETE USING (bucket_id IN ('library-files', 'library-thumbnails') AND auth.uid() IS NOT NULL);
