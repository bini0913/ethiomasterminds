-- Create analytics table for tracking user learning patterns
CREATE TABLE IF NOT EXISTS public.analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  accuracy DECIMAL(5,2) DEFAULT 0,
  speed DECIMAL(5,2) DEFAULT 0,
  weak_topics JSONB DEFAULT '[]'::jsonb,
  strong_topics JSONB DEFAULT '[]'::jsonb,
  total_questions_attempted INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  average_time_per_question DECIMAL(5,2) DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT analytics_user_subject_unique UNIQUE (user_id, subject)
);

-- Enable RLS on analytics
ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for analytics
CREATE POLICY "Users can view own analytics"
  ON public.analytics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analytics"
  ON public.analytics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analytics"
  ON public.analytics FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Teachers can view student analytics"
  ON public.analytics FOR SELECT
  USING (
    is_teacher_of_student(auth.uid(), user_id) OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'manager')
  );

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('quiz-assets', 'quiz-assets', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/wav'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket (public)
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for quiz-assets bucket (private)
CREATE POLICY "Teachers and admins can view quiz assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'quiz-assets' AND (
      has_role(auth.uid(), 'teacher') OR
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'manager')
    )
  );

CREATE POLICY "Teachers can upload quiz assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'quiz-assets' AND (
      has_role(auth.uid(), 'teacher') OR
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'manager')
    )
  );

CREATE POLICY "Teachers can update own quiz assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'quiz-assets' AND (
      has_role(auth.uid(), 'teacher') OR
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'manager')
    )
  );

CREATE POLICY "Teachers can delete own quiz assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'quiz-assets' AND (
      has_role(auth.uid(), 'teacher') OR
      has_role(auth.uid(), 'admin') OR
      has_role(auth.uid(), 'manager')
    )
  );

-- Function to calculate rank based on XP
CREATE OR REPLACE FUNCTION public.calculate_rank(p_xp INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN CASE
    WHEN p_xp >= 50000 THEN 'Grandmaster'
    WHEN p_xp >= 25000 THEN 'Master'
    WHEN p_xp >= 10000 THEN 'Diamond'
    WHEN p_xp >= 5000 THEN 'Platinum'
    WHEN p_xp >= 2500 THEN 'Gold'
    WHEN p_xp >= 1000 THEN 'Silver'
    WHEN p_xp >= 500 THEN 'Bronze'
    ELSE 'Beginner'
  END;
END;
$$;

-- Function to add XP and update level/rank
CREATE OR REPLACE FUNCTION public.add_xp(p_user_id UUID, p_amount INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_xp INTEGER;
  v_new_xp INTEGER;
  v_current_level INTEGER;
  v_new_level INTEGER;
  v_new_rank TEXT;
  v_leveled_up BOOLEAN := false;
BEGIN
  -- Get current XP and level
  SELECT xp, level INTO v_current_xp, v_current_level
  FROM profiles WHERE id = p_user_id;
  
  -- Calculate new values
  v_new_xp := v_current_xp + p_amount;
  v_new_level := FLOOR(v_new_xp / 100) + 1;
  v_new_rank := calculate_rank(v_new_xp);
  v_leveled_up := v_new_level > v_current_level;
  
  -- Update profile
  UPDATE profiles
  SET xp = v_new_xp, level = v_new_level, rank = v_new_rank
  WHERE id = p_user_id;
  
  RETURN jsonb_build_object(
    'previous_xp', v_current_xp,
    'new_xp', v_new_xp,
    'xp_gained', p_amount,
    'previous_level', v_current_level,
    'new_level', v_new_level,
    'leveled_up', v_leveled_up,
    'rank', v_new_rank
  );
END;
$$;

-- Function to finalize a match and award XP
CREATE OR REPLACE FUNCTION public.finalize_match(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_player RECORD;
  v_results JSONB := '[]'::jsonb;
  v_xp_reward INTEGER;
  v_rank INTEGER := 1;
BEGIN
  -- Update room status
  UPDATE multiplayer_rooms
  SET status = 'finished', finished_at = now()
  WHERE id = p_room_id;
  
  -- Process each player and award XP
  FOR v_player IN
    SELECT user_id, score
    FROM room_players
    WHERE room_id = p_room_id
    ORDER BY score DESC
  LOOP
    -- Calculate XP reward based on position
    v_xp_reward := CASE
      WHEN v_rank = 1 THEN 100
      WHEN v_rank = 2 THEN 75
      WHEN v_rank = 3 THEN 50
      ELSE 25
    END + (v_player.score / 10);
    
    -- Award XP
    PERFORM add_xp(v_player.user_id, v_xp_reward);
    
    -- Build results
    v_results := v_results || jsonb_build_object(
      'user_id', v_player.user_id,
      'score', v_player.score,
      'rank', v_rank,
      'xp_earned', v_xp_reward
    );
    
    v_rank := v_rank + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'room_id', p_room_id,
    'results', v_results
  );
END;
$$;

-- Function to get user stats for dashboard
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_total_quizzes INTEGER;
  v_total_correct INTEGER;
  v_total_questions INTEGER;
  v_accuracy DECIMAL;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_achievements_count INTEGER;
BEGIN
  -- Get profile
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  
  -- Get quiz stats
  SELECT 
    COUNT(DISTINCT quiz_id),
    SUM(correct_answers),
    SUM(total_questions)
  INTO v_total_quizzes, v_total_correct, v_total_questions
  FROM quiz_results WHERE student_id = p_user_id;
  
  -- Calculate accuracy
  v_accuracy := CASE 
    WHEN COALESCE(v_total_questions, 0) > 0 
    THEN (COALESCE(v_total_correct, 0)::DECIMAL / v_total_questions * 100)
    ELSE 0 
  END;
  
  -- Get streak
  SELECT current_streak, longest_streak
  INTO v_current_streak, v_longest_streak
  FROM user_streaks WHERE user_id = p_user_id;
  
  -- Get achievements count
  SELECT COUNT(*) INTO v_achievements_count
  FROM user_achievements WHERE user_id = p_user_id AND completed = true;
  
  RETURN jsonb_build_object(
    'xp', v_profile.xp,
    'level', v_profile.level,
    'rank', v_profile.rank,
    'total_quizzes', COALESCE(v_total_quizzes, 0),
    'accuracy', ROUND(v_accuracy, 1),
    'current_streak', COALESCE(v_current_streak, 0),
    'longest_streak', COALESCE(v_longest_streak, 0),
    'achievements_earned', COALESCE(v_achievements_count, 0)
  );
END;
$$;

-- Function to update analytics after quiz completion
CREATE OR REPLACE FUNCTION public.update_analytics(
  p_user_id UUID,
  p_subject TEXT,
  p_correct INTEGER,
  p_total INTEGER,
  p_avg_time DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO analytics (user_id, subject, total_correct, total_questions_attempted, accuracy, average_time_per_question)
  VALUES (
    p_user_id,
    p_subject,
    p_correct,
    p_total,
    (p_correct::DECIMAL / NULLIF(p_total, 0) * 100),
    p_avg_time
  )
  ON CONFLICT ON CONSTRAINT analytics_user_subject_unique DO UPDATE SET
    total_correct = analytics.total_correct + p_correct,
    total_questions_attempted = analytics.total_questions_attempted + p_total,
    accuracy = ((analytics.total_correct + p_correct)::DECIMAL / NULLIF(analytics.total_questions_attempted + p_total, 0) * 100),
    average_time_per_question = (analytics.average_time_per_question + p_avg_time) / 2,
    last_updated = now();
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON public.analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_subject ON public.analytics(subject);