-- Allow signed-in students to discover public profile fields for
-- leaderboards, friend lists, and profile pages. The profiles table does not
-- contain email addresses; private account data remains in auth.users.
-- Existing self-update/insert policies remain unchanged.
DROP POLICY IF EXISTS "Authenticated users can view public profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view public profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
