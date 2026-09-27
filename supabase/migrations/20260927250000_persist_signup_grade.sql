-- Persist onboarding grade/education metadata when a student account is created.
-- This keeps the selected grade available even when Supabase email confirmation
-- is enabled and the client cannot immediately update the profile row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    username,
    grade,
    education_level
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'grade'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'education_level'), '')
  );

  RETURN NEW;
END;
$$;
