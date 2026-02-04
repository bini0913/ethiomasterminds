-- =====================================================
-- MASTER MINDS - REMAINING SETUP (excluding already-added items)
-- =====================================================

-- Enable realtime for remaining tables (use DO block to handle already-existing)
DO $$
BEGIN
  -- Social features
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_post_comments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_post_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  -- Messaging
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  -- User presence
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Performance indexes (IF NOT EXISTS handles duplicates)
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON public.profiles(xp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_level ON public.profiles(level DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_quiz_results_student ON public.quiz_results(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz ON public.quiz_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_completed ON public.quiz_results(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_multiplayer_rooms_status ON public.multiplayer_rooms(status);
CREATE INDEX IF NOT EXISTS idx_room_players_room ON public.room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_user ON public.room_players(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_author ON public.social_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_created ON public.social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON public.friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON public.friends(status);
CREATE INDEX IF NOT EXISTS idx_class_students_class ON public.class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_student ON public.class_students(student_id);

-- Add language column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'language'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN language text DEFAULT 'en';
  END IF;
END $$;