-- Create public leaderboard function that anyone can access
CREATE OR REPLACE FUNCTION public.get_public_leaderboard(
  limit_count integer DEFAULT 50,
  timeframe text DEFAULT 'all'
)
RETURNS TABLE (
  id uuid,
  name text,
  username text,
  avatar text,
  xp integer,
  level integer,
  rank text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.username,
    p.avatar,
    p.xp,
    p.level,
    p.rank
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'student'
  ORDER BY p.xp DESC, p.level DESC
  LIMIT limit_count;
END;
$$;

-- Create find student by username function for teachers
CREATE OR REPLACE FUNCTION public.find_student_by_username(search_username text)
RETURNS TABLE (
  id uuid,
  name text,
  username text,
  avatar text,
  xp integer,
  level integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.username,
    p.avatar,
    p.xp,
    p.level
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'student'
    AND (
      p.username ILIKE '%' || search_username || '%'
      OR p.name ILIKE '%' || search_username || '%'
    )
  LIMIT 20;
END;
$$;

-- Create function to get class students with profiles (for teachers)
CREATE OR REPLACE FUNCTION public.get_class_students(class_uuid uuid)
RETURNS TABLE (
  id uuid,
  name text,
  username text,
  avatar text,
  xp integer,
  level integer,
  joined_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is the teacher of this class or admin/manager
  IF NOT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = class_uuid
    AND (
      c.teacher_id = auth.uid()
      OR has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'manager')
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to view this class';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.username,
    p.avatar,
    p.xp,
    p.level,
    cs.joined_at
  FROM public.class_students cs
  INNER JOIN public.profiles p ON p.id = cs.student_id
  WHERE cs.class_id = class_uuid
  ORDER BY p.name;
END;
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_xp ON public.profiles(xp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_level ON public.profiles(level DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id_role ON public.user_roles(user_id, role);