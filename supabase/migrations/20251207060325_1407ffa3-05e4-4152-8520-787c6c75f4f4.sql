-- Fix PUBLIC_USER_DATA: profiles table public exposure
-- Drop existing permissive policies and replace with restrictive ones

-- First, drop existing policies on profiles table
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create new restrictive policies that require authentication

-- Users can only view their own profile (requires auth)
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admins and managers can view all profiles (requires auth via has_role function)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Users can only insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- Revoke anonymous access to profiles table
REVOKE ALL ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM anon;