-- Account deletion and minor-consent reconciliation for the already-deployed project.

-- Persist guardian metadata from the auth signup payload and reject new minor
-- profiles that do not have verifiable consent details.
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
  v_guardian_consent boolean := coalesce((NEW.raw_user_meta_data ->> 'guardian_consent')::boolean, false);
  v_guardian_email text := nullif(lower(trim(NEW.raw_user_meta_data ->> 'guardian_email')), '');
BEGIN
  IF v_gender NOT IN ('male', 'female') THEN v_gender := NULL; END IF;
  IF v_age_text ~ '^[0-9]{1,3}$' THEN
    v_age := v_age_text::integer;
    IF v_age < 3 OR v_age > 120 THEN v_age := NULL; END IF;
  END IF;
  IF v_avatar = '' OR length(v_avatar) > 80 THEN v_avatar := 'avatar-1'; END IF;
  IF v_grade_input IN ('K', 'KG', 'KINDERGARTEN') THEN
    v_grade := 'KG'; v_education_level := 'early';
  ELSIF v_grade_input ~ '^(GRADE[[:space:]]*)?(1[0-2]|[1-9])$' THEN
    v_grade := coalesce(substring(v_grade_input from '(1[0-2]|[1-9])'), '');
    v_education_level := CASE WHEN v_grade::integer <= 4 THEN 'early' WHEN v_grade::integer <= 8 THEN 'middle' ELSE 'upper' END;
  END IF;
  IF v_age IS NOT NULL AND v_age < 18 THEN
    IF NOT v_guardian_consent OR v_guardian_email IS NULL OR v_guardian_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'Guardian consent and a valid guardian email are required for learners under 18';
    END IF;
  ELSE
    v_guardian_consent := false;
    v_guardian_email := NULL;
  END IF;

  INSERT INTO public.profiles (
    id, name, username, gender, age, avatar, grade, education_level,
    guardian_consent, guardian_email, consent_at
  ) VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data ->> 'name', NEW.email),
    coalesce(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    v_gender, v_age, v_avatar, v_grade, v_education_level,
    v_guardian_consent, v_guardian_email, CASE WHEN v_guardian_consent THEN now() ELSE NULL END
  );

  IF v_account_type = 'individual_parent' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'parent'::public.app_role) ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF v_account_type <> 'school' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student'::public.app_role) ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_guardian_consent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.age IS NOT NULL AND NEW.age < 18 THEN
    IF NOT coalesce(NEW.guardian_consent, false)
       OR nullif(trim(NEW.guardian_email), '') IS NULL
       OR lower(trim(NEW.guardian_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'Guardian consent and a valid guardian email are required for learners under 18';
    END IF;
    NEW.guardian_email := lower(trim(NEW.guardian_email));
    IF NEW.consent_at IS NULL THEN NEW.consent_at := now(); END IF;
  ELSE
    NEW.guardian_consent := false;
    NEW.guardian_email := NULL;
    NEW.consent_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_guardian_consent_guard ON public.profiles;
CREATE TRIGGER profiles_guardian_consent_guard
  BEFORE INSERT OR UPDATE OF age, guardian_consent, guardian_email ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_guardian_consent();
REVOKE ALL ON FUNCTION public.validate_guardian_consent() FROM PUBLIC, anon, authenticated;

-- Delete user-owned files before deleting the auth row. All current uploaders
-- place the authenticated user id in the first path segment.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  DELETE FROM storage.objects WHERE name LIKE v_user_id::text || '/%';

  -- Remove user-authored social data, including comments on their posts.
  DELETE FROM public.social_post_comments WHERE user_id = v_user_id;
  DELETE FROM public.social_post_comments WHERE post_id IN (SELECT id FROM public.social_posts WHERE author_id = v_user_id);
  DELETE FROM public.social_posts WHERE author_id = v_user_id;

  -- Financial invoices are user-owned records and cannot retain a deleted
  -- profile because student_id is non-null and RESTRICTed.
  DELETE FROM public.finance_invoices WHERE student_id = v_user_id;
  DELETE FROM public.finance_invoices WHERE created_by = v_user_id;

  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
COMMENT ON FUNCTION public.delete_my_account() IS 'Permanently removes the authenticated account, owned storage objects, user-authored social content, and user-owned invoice records.';
