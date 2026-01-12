-- =============================================
-- PHASE 1: Announcement Reads (per-user read tracking)
-- =============================================
CREATE TABLE public.announcement_reads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reads"
  ON public.announcement_reads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark as read"
  ON public.announcement_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- PHASE 2: Social Feed Tables
-- =============================================
CREATE TABLE public.social_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'post',
  content TEXT NOT NULL,
  metadata JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view posts"
  ON public.social_posts FOR SELECT
  USING (true);

CREATE POLICY "Users can create own posts"
  ON public.social_posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own posts"
  ON public.social_posts FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own posts"
  ON public.social_posts FOR DELETE
  USING (auth.uid() = author_id);

-- Social Post Likes
CREATE TABLE public.social_post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.social_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes"
  ON public.social_post_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like posts"
  ON public.social_post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON public.social_post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Social Post Comments
CREATE TABLE public.social_post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.social_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
  ON public.social_post_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can create comments"
  ON public.social_post_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.social_post_comments FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- PHASE 3: Avatar Config Column
-- =============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_config JSONB DEFAULT NULL;

-- =============================================
-- PHASE 4: Multiplayer Game Tables
-- =============================================

-- Room State (authoritative game state)
CREATE TABLE public.room_state (
  room_id UUID PRIMARY KEY REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting',
  question_index INTEGER NOT NULL DEFAULT 0,
  current_question_id UUID NULL,
  question_started_at TIMESTAMP WITH TIME ZONE NULL,
  question_ends_at TIMESTAMP WITH TIME ZONE NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.room_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view room state"
  ON public.room_state FOR SELECT
  USING (true);

CREATE POLICY "Host can manage room state"
  ON public.room_state FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.multiplayer_rooms 
    WHERE id = room_state.room_id AND host_id = auth.uid()
  ));

-- Room Questions (selected questions for the match)
CREATE TABLE public.room_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.room_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view room questions"
  ON public.room_questions FOR SELECT
  USING (true);

CREATE POLICY "Host can manage room questions"
  ON public.room_questions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.multiplayer_rooms 
    WHERE id = room_questions.room_id AND host_id = auth.uid()
  ));

-- Room Answers
CREATE TABLE public.room_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  time_used INTEGER NOT NULL DEFAULT 0,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id, question_id)
);

ALTER TABLE public.room_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view room answers"
  ON public.room_answers FOR SELECT
  USING (true);

CREATE POLICY "Players can submit answers"
  ON public.room_answers FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.room_players 
      WHERE room_id = room_answers.room_id AND user_id = auth.uid()
    )
  );

-- Room Chat Messages
CREATE TABLE public.room_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.multiplayer_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.room_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view room chat"
  ON public.room_chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Players can send messages"
  ON public.room_chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.room_players 
      WHERE room_id = room_chat_messages.room_id AND user_id = auth.uid()
    )
  );

-- =============================================
-- PHASE 5: Enable Realtime for new tables
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_chat_messages;

-- =============================================
-- PHASE 6: Database Functions for Multiplayer
-- =============================================

-- Function to start a multiplayer game
CREATE OR REPLACE FUNCTION public.multiplayer_start_game(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_host_id UUID;
  v_subject TEXT;
  v_difficulty TEXT;
  v_question_count INTEGER;
BEGIN
  -- Verify caller is host
  SELECT host_id, subject, difficulty, question_count 
  INTO v_host_id, v_subject, v_difficulty, v_question_count
  FROM multiplayer_rooms WHERE id = p_room_id;
  
  IF v_host_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the host can start the game';
  END IF;
  
  -- Select random questions for the room
  INSERT INTO room_questions (room_id, question_id, order_index)
  SELECT p_room_id, q.id, row_number() OVER (ORDER BY random()) - 1
  FROM questions q
  JOIN quizzes qz ON q.quiz_id = qz.id
  WHERE qz.is_approved = true
    AND (v_subject IS NULL OR qz.subject = v_subject)
    AND (v_difficulty IS NULL OR qz.difficulty = v_difficulty)
  ORDER BY random()
  LIMIT COALESCE(v_question_count, 10);
  
  -- Create room state
  INSERT INTO room_state (room_id, status, question_index)
  VALUES (p_room_id, 'countdown', 0)
  ON CONFLICT (room_id) DO UPDATE SET status = 'countdown', question_index = 0, updated_at = now();
  
  -- Update room status
  UPDATE multiplayer_rooms SET status = 'playing', started_at = now() WHERE id = p_room_id;
  
  RETURN true;
END;
$$;

-- Function to advance to next question
CREATE OR REPLACE FUNCTION public.multiplayer_next_question(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state room_state%ROWTYPE;
  v_next_question_id UUID;
  v_question_data JSONB;
  v_total_questions INTEGER;
BEGIN
  -- Get current state
  SELECT * INTO v_state FROM room_state WHERE room_id = p_room_id;
  
  -- Get total questions
  SELECT COUNT(*) INTO v_total_questions FROM room_questions WHERE room_id = p_room_id;
  
  -- Check if game is over
  IF v_state.question_index >= v_total_questions THEN
    UPDATE room_state SET status = 'finished', updated_at = now() WHERE room_id = p_room_id;
    UPDATE multiplayer_rooms SET status = 'finished', finished_at = now() WHERE id = p_room_id;
    RETURN jsonb_build_object('status', 'finished');
  END IF;
  
  -- Get next question
  SELECT rq.question_id INTO v_next_question_id
  FROM room_questions rq
  WHERE rq.room_id = p_room_id AND rq.order_index = v_state.question_index;
  
  -- Get question data
  SELECT jsonb_build_object(
    'id', q.id,
    'question_text', q.question_text,
    'options', q.options,
    'points', q.points
  ) INTO v_question_data
  FROM questions q WHERE q.id = v_next_question_id;
  
  -- Update room state
  UPDATE room_state SET 
    status = 'playing',
    current_question_id = v_next_question_id,
    question_started_at = now(),
    question_ends_at = now() + interval '30 seconds',
    updated_at = now()
  WHERE room_id = p_room_id;
  
  RETURN jsonb_build_object(
    'status', 'playing',
    'question', v_question_data,
    'question_index', v_state.question_index,
    'total_questions', v_total_questions
  );
END;
$$;

-- Function to submit answer
CREATE OR REPLACE FUNCTION public.multiplayer_submit_answer(
  p_room_id UUID,
  p_question_id UUID,
  p_answer TEXT,
  p_time_used INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct_answer TEXT;
  v_is_correct BOOLEAN;
  v_points INTEGER;
  v_base_points INTEGER;
BEGIN
  -- Verify player is in room
  IF NOT EXISTS (SELECT 1 FROM room_players WHERE room_id = p_room_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are not in this room';
  END IF;
  
  -- Get correct answer
  SELECT correct_answer, COALESCE(points, 10) INTO v_correct_answer, v_base_points
  FROM questions WHERE id = p_question_id;
  
  v_is_correct := (p_answer = v_correct_answer);
  
  -- Calculate points (faster = more points)
  IF v_is_correct THEN
    v_points := v_base_points + GREATEST(0, (30 - p_time_used) * 2);
  ELSE
    v_points := 0;
  END IF;
  
  -- Insert answer
  INSERT INTO room_answers (room_id, user_id, question_id, answer, time_used, is_correct, points)
  VALUES (p_room_id, auth.uid(), p_question_id, p_answer, p_time_used, v_is_correct, v_points)
  ON CONFLICT (room_id, user_id, question_id) DO NOTHING;
  
  -- Update player score
  UPDATE room_players SET score = score + v_points WHERE room_id = p_room_id AND user_id = auth.uid();
  
  RETURN jsonb_build_object(
    'is_correct', v_is_correct,
    'points', v_points,
    'correct_answer', v_correct_answer
  );
END;
$$;