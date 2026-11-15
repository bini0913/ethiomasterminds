-- School-managed accounts receive their application role from school_memberships.
-- They must not be silently assigned the global individual-learning student role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type text := coalesce(NEW.raw_user_meta_data ->> 'account_type', 'individual');
BEGIN
  INSERT INTO public.profiles (id, name, username, grade)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data ->> 'grade', '')
  );

  IF v_account_type = 'school' THEN
    -- The trusted school provisioning workflow creates the school_memberships row.
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
