
-- ============================================
-- Step 1: Fix RLS Policies & Add Realtime
-- ============================================

-- Fix chat_group_members: drop broken policies
DROP POLICY IF EXISTS "Members can view group members" ON chat_group_members;
DROP POLICY IF EXISTS "Users can view group members" ON chat_group_members;

-- Create working policy for chat_group_members
CREATE POLICY "Users can view group members" ON chat_group_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR group_id IN (
    SELECT cgm.group_id FROM chat_group_members cgm WHERE cgm.user_id = auth.uid()
  )
);

-- Fix chat_groups: drop broken policy
DROP POLICY IF EXISTS "Users can view groups they belong to" ON chat_groups;

CREATE POLICY "Users can view groups they belong to" ON chat_groups
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR id IN (
    SELECT cgm.group_id FROM chat_group_members cgm WHERE cgm.user_id = auth.uid()
  )
);

-- Allow all authenticated users to read profiles (fixes "Unknown" names)
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;

CREATE POLICY "Authenticated users can view all profiles"
ON profiles FOR SELECT TO authenticated
USING (true);

-- Add missing tables to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'quizzes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quizzes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_achievements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'user_currency') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_currency;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tournaments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tournament_participants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_participants;
  END IF;
END $$;
