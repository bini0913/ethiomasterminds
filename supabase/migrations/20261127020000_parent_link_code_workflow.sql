-- Complete the legacy parent-link flow used by ParentDashboard.
-- A student creates a short-lived-looking (but single-use) pending code and a
-- separately authenticated parent claims it. The code itself is the capability;
-- no student lookup is exposed to the caller before a successful claim.

ALTER TABLE public.parent_links
  ALTER COLUMN parent_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.create_parent_link_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_code text;
  v_code text;
BEGIN
  IF v_user_id IS NULL OR NOT public.has_role(v_user_id, 'student'::public.app_role) THEN
    RAISE EXCEPTION 'Only an authenticated student can create a parent link code'
      USING ERRCODE = '42501';
  END IF;

  SELECT link_code
    INTO v_existing_code
    FROM public.parent_links
   WHERE student_id = v_user_id
     AND status = 'pending'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing_code IS NOT NULL THEN
    RETURN v_existing_code;
  END IF;

  LOOP
    v_code := 'MM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    BEGIN
      INSERT INTO public.parent_links (parent_id, student_id, link_code, status)
      VALUES (NULL, v_user_id, v_code, 'pending');
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- Extremely unlikely code collision; generate another code.
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_parent_link_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_parent_id uuid := auth.uid();
  v_link public.parent_links%ROWTYPE;
  v_name text;
BEGIN
  IF v_parent_id IS NULL OR NOT public.has_role(v_parent_id, 'parent'::public.app_role) THEN
    RAISE EXCEPTION 'Only an authenticated parent can claim a parent link code'
      USING ERRCODE = '42501';
  END IF;

  IF nullif(trim(p_code), '') IS NULL OR length(trim(p_code)) > 64 THEN
    RAISE EXCEPTION 'Invalid or expired parent link code'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
    INTO v_link
    FROM public.parent_links
   WHERE upper(link_code) = upper(trim(p_code))
     AND status = 'pending'
     AND student_id <> v_parent_id
     AND (parent_id IS NULL OR parent_id = v_parent_id)
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired parent link code'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.parent_links
     WHERE parent_id = v_parent_id
       AND student_id = v_link.student_id
       AND status = 'linked'
  ) THEN
    RAISE EXCEPTION 'This child is already connected to your account'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.parent_links
     SET parent_id = v_parent_id,
         status = 'linked',
         linked_at = now()
   WHERE id = v_link.id
     AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The parent link code was already claimed'
      USING ERRCODE = '40001';
  END IF;

  SELECT coalesce(name, 'Your child')
    INTO v_name
    FROM public.profiles
   WHERE id = v_link.student_id;

  RETURN jsonb_build_object(
    'student_id', v_link.student_id,
    'name', coalesce(v_name, 'Your child')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_parent_link_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_parent_link_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_parent_link_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_parent_link_code(text) TO authenticated;
