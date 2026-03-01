-- Harden data integrity and RLS for real-data only flows

-- Social constraints
CREATE UNIQUE INDEX IF NOT EXISTS social_post_likes_post_user_unique
  ON public.social_post_likes(post_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS saved_posts_post_user_unique
  ON public.saved_posts(post_id, user_id);

-- Messaging support for soft delete/read state
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_status text NOT NULL DEFAULT 'sent';

-- Flashcard ownership/public visibility
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

UPDATE public.flashcards
SET user_id = created_by
WHERE user_id IS NULL;

-- Ensure RLS on key tables
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_flashcard_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_status ENABLE ROW LEVEL SECURITY;

-- Flashcard privacy policy
DROP POLICY IF EXISTS "Anyone can view flashcards" ON public.flashcards;
CREATE POLICY "Users can view public or own flashcards"
ON public.flashcards
FOR SELECT
USING (
  is_public = true
  OR user_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'teacher')
  )
);

-- Study plans scoped to owner
DROP POLICY IF EXISTS "Users can view own study plans" ON public.study_plans;
CREATE POLICY "Users can view own study plans"
ON public.study_plans FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own study plans" ON public.study_plans;
CREATE POLICY "Users can insert own study plans"
ON public.study_plans FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own study plans" ON public.study_plans;
CREATE POLICY "Users can update own study plans"
ON public.study_plans FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own study plans" ON public.study_plans;
CREATE POLICY "Users can delete own study plans"
ON public.study_plans FOR DELETE
USING (user_id = auth.uid());

-- Message read/delete and access control
DROP POLICY IF EXISTS "Users can view own conversation messages" ON public.messages;
CREATE POLICY "Users can view own conversation messages"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = messages.conversation_id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can send conversation messages" ON public.messages;
CREATE POLICY "Users can send conversation messages"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    WHERE cm.conversation_id = messages.conversation_id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages"
ON public.messages FOR UPDATE
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Storage: ensure user-owned paths for avatars and posts
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-uploads', 'user-uploads', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'user-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-uploads'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
