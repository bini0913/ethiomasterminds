-- Allow admins/managers to delete any social posts
CREATE POLICY "Admins can delete any posts"
ON public.social_posts
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Allow admins/managers to delete any comments
CREATE POLICY "Admins can delete any comments"
ON public.social_post_comments
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Allow admins/managers to delete any likes (for cascade cleanup)
CREATE POLICY "Admins can delete any likes"
ON public.social_post_likes
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Allow admins/managers to delete any reactions (for cascade cleanup)
CREATE POLICY "Admins can delete any reactions"
ON public.social_post_reactions
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Allow admins/managers to delete any saved posts (for cascade cleanup)
CREATE POLICY "Admins can delete any saved posts"
ON public.saved_posts
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));