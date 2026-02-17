
-- Flashcards table
CREATE TABLE public.flashcards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  created_by TEXT NOT NULL DEFAULT 'system',
  grade_level INTEGER NOT NULL DEFAULT 9,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view flashcards" ON public.flashcards
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Teachers/admins can manage flashcards" ON public.flashcards
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- User flashcard progress
CREATE TABLE public.user_flashcard_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new',
  next_review_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  repetition_count INTEGER NOT NULL DEFAULT 0,
  ease_factor NUMERIC NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, flashcard_id)
);

ALTER TABLE public.user_flashcard_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own flashcard progress" ON public.user_flashcard_progress
FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Topic progress
CREATE TABLE public.topic_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  accuracy_percentage NUMERIC NOT NULL DEFAULT 0,
  completion_percentage NUMERIC NOT NULL DEFAULT 0,
  questions_attempted INTEGER NOT NULL DEFAULT 0,
  questions_correct INTEGER NOT NULL DEFAULT 0,
  last_practiced TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, subject, topic)
);

ALTER TABLE public.topic_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own topic progress" ON public.topic_progress
FOR ALL TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Teachers can view student topic progress" ON public.topic_progress
FOR SELECT TO authenticated
USING (is_teacher_of_student(auth.uid(), user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Study plans
CREATE TABLE public.study_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own study plans" ON public.study_plans
FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Add realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.flashcards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_flashcard_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.topic_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_plans;

-- Create indexes
CREATE INDEX idx_flashcards_subject ON public.flashcards(subject);
CREATE INDEX idx_flashcards_grade ON public.flashcards(grade_level);
CREATE INDEX idx_user_flashcard_progress_user ON public.user_flashcard_progress(user_id);
CREATE INDEX idx_user_flashcard_progress_review ON public.user_flashcard_progress(user_id, next_review_date);
CREATE INDEX idx_topic_progress_user ON public.topic_progress(user_id);
CREATE INDEX idx_study_plans_user_date ON public.study_plans(user_id, scheduled_date);
