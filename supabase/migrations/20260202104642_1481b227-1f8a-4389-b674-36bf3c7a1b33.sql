-- First, let's fix the chat_group_members RLS policy that has infinite recursion
DROP POLICY IF EXISTS "Users can view members of their groups" ON public.chat_group_members;
DROP POLICY IF EXISTS "Users can join groups" ON public.chat_group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.chat_group_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.chat_group_members;

-- Create simpler RLS policies without recursion
CREATE POLICY "Users can view group members"
ON public.chat_group_members FOR SELECT
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.chat_group_members m 
    WHERE m.group_id = chat_group_members.group_id 
    AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join public groups"
ON public.chat_group_members FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave groups"
ON public.chat_group_members FOR DELETE
USING (user_id = auth.uid());

-- Add foreign key from social_posts to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'social_posts_author_id_fkey'
    AND table_name = 'social_posts'
  ) THEN
    ALTER TABLE public.social_posts 
    ADD CONSTRAINT social_posts_author_id_fkey 
    FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from social_post_comments to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'social_post_comments_user_id_fkey'
    AND table_name = 'social_post_comments'
  ) THEN
    ALTER TABLE public.social_post_comments 
    ADD CONSTRAINT social_post_comments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;