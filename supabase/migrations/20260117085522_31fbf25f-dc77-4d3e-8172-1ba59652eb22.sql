-- Phase 2-4: Social & Chat Tables

-- Add image_url and shared_post_id to social_posts
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS shared_post_id UUID REFERENCES public.social_posts(id);

-- Create social_post_reactions table (replacing simple likes)
CREATE TABLE IF NOT EXISTS public.social_post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id, reaction_type)
);

-- Create saved_posts table
CREATE TABLE IF NOT EXISTS public.saved_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  reported_type TEXT NOT NULL,
  reported_id UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_groups table
CREATE TABLE IF NOT EXISTS public.chat_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  group_type TEXT NOT NULL DEFAULT 'private',
  created_by UUID NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_group_members table
CREATE TABLE IF NOT EXISTS public.chat_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Create group_messages table
CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  attachment_url TEXT,
  reply_to_id UUID REFERENCES public.group_messages(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Phase 5-6: AI Features Tables

-- Create learning_dna table
CREATE TABLE IF NOT EXISTS public.learning_dna (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  strengths JSONB DEFAULT '[]'::jsonb,
  weaknesses JSONB DEFAULT '[]'::jsonb,
  topic_mastery JSONB DEFAULT '{}'::jsonb,
  learning_style TEXT,
  predicted_path JSONB DEFAULT '{}'::jsonb,
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create question_attempts table
CREATE TABLE IF NOT EXISTS public.question_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions(id),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id),
  selected_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  time_taken_seconds INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  confidence_level INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create revision_schedule table
CREATE TABLE IF NOT EXISTS public.revision_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions(id),
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  difficulty_rating INTEGER DEFAULT 3,
  times_reviewed INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_tutor_conversations table
CREATE TABLE IF NOT EXISTS public.ai_tutor_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Phase 7: Parent Portal Tables

-- Create parent_links table
CREATE TABLE IF NOT EXISTS public.parent_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL,
  student_id UUID NOT NULL,
  link_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  linked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(parent_id, student_id)
);

-- Create parent_notifications table
CREATE TABLE IF NOT EXISTS public.parent_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL,
  student_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.social_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tutor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_post_reactions
CREATE POLICY "Users can view all reactions" ON public.social_post_reactions FOR SELECT USING (true);
CREATE POLICY "Users can add reactions" ON public.social_post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reactions" ON public.social_post_reactions FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for saved_posts
CREATE POLICY "Users can view own saved posts" ON public.saved_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save posts" ON public.saved_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave posts" ON public.saved_posts FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for reports
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT USING (auth.uid() = reporter_id OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
CREATE POLICY "Admins can update reports" ON public.reports FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS Policies for chat_groups
CREATE POLICY "Users can view groups they belong to" ON public.chat_groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chat_group_members WHERE group_id = id AND user_id = auth.uid())
  OR created_by = auth.uid()
);
CREATE POLICY "Users can create groups" ON public.chat_groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update groups" ON public.chat_groups FOR UPDATE USING (auth.uid() = created_by);

-- RLS Policies for chat_group_members
CREATE POLICY "Members can view group members" ON public.chat_group_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chat_group_members cgm WHERE cgm.group_id = group_id AND cgm.user_id = auth.uid())
);
CREATE POLICY "Group admins can add members" ON public.chat_group_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.chat_group_members WHERE group_id = chat_group_members.group_id AND user_id = auth.uid() AND role IN ('admin', 'owner'))
  OR EXISTS (SELECT 1 FROM public.chat_groups WHERE id = group_id AND created_by = auth.uid())
);
CREATE POLICY "Users can leave groups" ON public.chat_group_members FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for group_messages
CREATE POLICY "Members can view group messages" ON public.group_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chat_group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
);
CREATE POLICY "Members can send messages" ON public.group_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (SELECT 1 FROM public.chat_group_members WHERE group_id = group_messages.group_id AND user_id = auth.uid())
);

-- RLS Policies for learning_dna
CREATE POLICY "Users can view own learning DNA" ON public.learning_dna FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own learning DNA" ON public.learning_dna FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert learning DNA" ON public.learning_dna FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Teachers can view student DNA" ON public.learning_dna FOR SELECT USING (
  is_teacher_of_student(auth.uid(), user_id) OR has_role(auth.uid(), 'admin')
);

-- RLS Policies for question_attempts
CREATE POLICY "Users can view own attempts" ON public.question_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create attempts" ON public.question_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Teachers can view student attempts" ON public.question_attempts FOR SELECT USING (
  is_teacher_of_student(auth.uid(), user_id) OR has_role(auth.uid(), 'admin')
);

-- RLS Policies for revision_schedule
CREATE POLICY "Users can view own schedule" ON public.revision_schedule FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own schedule" ON public.revision_schedule FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for ai_tutor_conversations
CREATE POLICY "Users can view own conversations" ON public.ai_tutor_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create conversations" ON public.ai_tutor_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.ai_tutor_conversations FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for parent_links
CREATE POLICY "Parents can view own links" ON public.parent_links FOR SELECT USING (auth.uid() = parent_id OR auth.uid() = student_id);
CREATE POLICY "Students can create links" ON public.parent_links FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Parents can accept links" ON public.parent_links FOR UPDATE USING (auth.uid() = parent_id);

-- RLS Policies for parent_notifications
CREATE POLICY "Parents can view own notifications" ON public.parent_notifications FOR SELECT USING (auth.uid() = parent_id);
CREATE POLICY "System can create notifications" ON public.parent_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Parents can mark as read" ON public.parent_notifications FOR UPDATE USING (auth.uid() = parent_id);

-- Enable realtime for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_group_members;

-- Create storage bucket for social images
INSERT INTO storage.buckets (id, name, public) VALUES ('social-images', 'social-images', true) ON CONFLICT DO NOTHING;

-- Storage policies for social images
CREATE POLICY "Anyone can view social images" ON storage.objects FOR SELECT USING (bucket_id = 'social-images');
CREATE POLICY "Authenticated users can upload social images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'social-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own social images" ON storage.objects FOR DELETE USING (bucket_id = 'social-images' AND auth.uid()::text = (storage.foldername(name))[1]);