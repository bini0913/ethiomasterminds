-- Add unique constraint on username for login lookup
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_username_unique;
ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Create index for fast username lookups
DROP INDEX IF EXISTS idx_profiles_username;
CREATE INDEX idx_profiles_username ON profiles(username);

-- Function to get email by username for login
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  -- Find the user_id from profiles (case-insensitive)
  SELECT id INTO v_user_id
  FROM profiles
  WHERE LOWER(username) = LOWER(p_username)
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get email from auth.users
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_user_id;
  
  RETURN v_email;
END;
$$;

-- Function to directly assign user role (bypasses RLS, used by edge function)
CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_user_id uuid,
  p_role app_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete existing roles for this user
  DELETE FROM user_roles WHERE user_id = p_user_id;
  
  -- Insert new role
  INSERT INTO user_roles (user_id, role) VALUES (p_user_id, p_role);
  
  RETURN true;
END;
$$;

-- Update handle_new_user to NOT auto-assign student role
-- Role will be assigned via edge function instead
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Create profile with username from metadata
    INSERT INTO public.profiles (id, name, username)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1))
    );
    
    -- Note: Role is now assigned via assign-role edge function, not here
    -- This allows direct role selection during signup
    
    RETURN NEW;
END;
$$;

-- Add RLS policy for teachers to view students in their classes
DROP POLICY IF EXISTS "Teachers can view students in their classes" ON profiles;
CREATE POLICY "Teachers can view students in their classes"
ON profiles FOR SELECT
USING (
  auth.uid() = id
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'manager')
  OR EXISTS (
    SELECT 1 FROM class_students cs
    JOIN classes c ON c.id = cs.class_id
    WHERE cs.student_id = profiles.id
    AND c.teacher_id = auth.uid()
  )
);