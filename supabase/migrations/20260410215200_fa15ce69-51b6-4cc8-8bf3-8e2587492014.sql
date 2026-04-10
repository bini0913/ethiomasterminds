
-- Create followers table for the social follow system
CREATE TABLE public.followers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL,
  following_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id)
);

-- Enable RLS
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see followers
CREATE POLICY "Anyone can view follows"
ON public.followers FOR SELECT
TO authenticated
USING (true);

-- Users can follow others
CREATE POLICY "Users can follow others"
ON public.followers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow"
ON public.followers FOR DELETE
TO authenticated
USING (auth.uid() = follower_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.followers;
