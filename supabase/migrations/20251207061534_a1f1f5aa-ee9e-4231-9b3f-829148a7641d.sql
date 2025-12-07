-- Fix MISSING_RLS_PROTECTION: Add explicit RESTRICTIVE policies to block non-admin users from INSERT, UPDATE, DELETE on user_roles

-- Add RESTRICTIVE policy to deny INSERT for non-admin users
CREATE POLICY "Deny non-admin INSERT"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Add RESTRICTIVE policy to deny UPDATE for non-admin users
CREATE POLICY "Deny non-admin UPDATE"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Add RESTRICTIVE policy to deny DELETE for non-admin users
CREATE POLICY "Deny non-admin DELETE"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Revoke direct modification privileges from client roles as an extra layer
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon;