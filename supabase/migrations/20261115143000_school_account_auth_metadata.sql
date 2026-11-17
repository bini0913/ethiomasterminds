-- Preserve the existing individual-account profile contract while adding
-- dedicated school-account role resolution.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type text := lower(trim(coalesce(NEW.raw_user_meta_data ->> 'account_type', 'individual')));
  v_gender text := lower(trim(coalesce(NEW.raw_user_meta_data ->> 'gender', '')));
  v_age_text text := trim(coalesce(NEW.raw_user_meta_data ->> 'age', ''));
  v_age integer;
  v_avatar text := trim(coalesce(NEW.raw_user_meta_data ->> 'avatar', ''));
  v_grade_input text := upper(trim(coalesce(NEW.raw_user_meta_data ->> 'grade', '')));
  v_grade text;
  v_education_level text;
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

  IF v_avatar = '' OR length(v_avatar) > 80 THEN
    v_avatar := 'avatar-1';
  END IF;

  IF v_grade_input IN ('K', 'KG', 'KINDERGARTEN') THEN
    v_grade := 'KG';
    v_education_level := 'early';
  ELSIF v_grade_input ~ '^(GRADE[[:space:]]*)?(1[0-2]|[1-9])$' THEN
    v_grade := coalesce(substring(v_grade_input from '(1[0-2]|[1-9])'), '');
    v_education_level := CASE
      WHEN v_grade::integer <= 4 THEN 'early'
      WHEN v_grade::integer <= 8 THEN 'middle'
      ELSE 'upper'
    END;
  ELSE
    v_grade := NULL;
    v_education_level := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, name, username, gender, age, avatar, grade, education_level
  )
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data ->> 'name', NEW.email),
    coalesce(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    v_gender,
    v_age,
    v_avatar,
    v_grade,
    v_education_level
  );

  IF v_account_type = 'school' THEN
    -- The trusted school provisioning workflow creates school_memberships.
    NULL;
  ELSIF v_account_type = 'individual_parent' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'parent'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'student'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
