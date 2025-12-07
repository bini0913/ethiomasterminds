-- Fix PUBLIC_ROLE_DATA: user_roles table security
-- Drop existing RESTRICTIVE policies and replace with PERMISSIVE ones

-- First, drop existing policies on user_roles table
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Create new PERMISSIVE policies that explicitly allow only authorized access

-- Users can only view their own roles (PERMISSIVE - required for RLS to work properly)
CREATE POLICY "Users can view own roles"
ON public.user_roles
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins and managers can view and manage all roles (PERMISSIVE)
CREATE POLICY "Admins can manage roles"
ON public.user_roles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Revoke all access from anonymous users
REVOKE ALL ON public.user_roles FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;