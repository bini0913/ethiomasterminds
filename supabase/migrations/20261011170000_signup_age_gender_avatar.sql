-- Capture signup age, gender and selected avatar in the profile row.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_age_range_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_age_range_check
      CHECK (age IS NULL OR age BETWEEN 3 AND 120) NOT VALID;
  END IF;
END $$;

-- Preserve the existing signup-trigger behavior while copying the new profile
-- fields from auth metadata, including when email confirmation is enabled.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gender text := lower(trim(coalesce(NEW.raw_user_meta_data ->> 'gender', '')));
  v_age_text text := trim(coalesce(NEW.raw_user_meta_data ->> 'age', ''));
  v_age integer;
BEGIN
  IF v_gender NOT IN ('male', 'female') THEN
    v_gender := NULL;
  END IF;

  IF v_age_text ~ '^[0-9]{1,3}$' THEN
    v_age := v_age_text::integer;
    IF v_age < 3 OR v_age > 120 THEN
      v_age := NULL;
    END IF;
  END IF;

  INSERT INTO public.profiles (
    id, name, username, grade, education_level, gender, age, avatar
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'grade'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'education_level'), ''),
    v_gender,
    v_age,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'avatar'), ''), 'avatar-1')
  );

  RETURN NEW;
END;
$$;
