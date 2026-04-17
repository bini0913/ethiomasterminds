-- Seed a bootstrap Extreme Admin account for the hidden root portal.
-- Credentials:
--   username: bini09
--   password: bini2004
-- Note: Username login is supported by the app; email is internal only.
-- Change this password immediately after first login.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_email CONSTANT text := 'bini09.extreme.admin@ethiomasterminds.com';
  v_username CONSTANT text := 'bini09';
  v_password CONSTANT text := 'bini2004';
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('name', 'Extreme Admin', 'username', v_username),
      false,
      now(),
      now()
    );
  END IF;

  INSERT INTO public.profiles (id, name, username)
  VALUES (v_user_id, 'Extreme Admin', v_username)
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      username = EXCLUDED.username,
      updated_at = now();

  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'extreme_admin'::public.app_role);
END;
$$;
