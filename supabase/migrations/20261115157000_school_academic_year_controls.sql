CREATE OR REPLACE FUNCTION public.school_set_current_academic_year(p_academic_year_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  SELECT school_id INTO v_school_id
  FROM public.school_academic_years
  WHERE id = p_academic_year_id
  FOR UPDATE;

  IF v_school_id IS NULL OR NOT public.is_school_manager_or_admin(v_school_id) THEN
    RAISE EXCEPTION 'Only the School Manager or Admin can set the current academic year';
  END IF;

  UPDATE public.school_academic_years
  SET is_current = false
  WHERE school_id = v_school_id AND is_current = true;

  UPDATE public.school_academic_years
  SET is_current = true
  WHERE id = p_academic_year_id AND school_id = v_school_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.school_set_current_academic_year(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_set_current_academic_year(uuid) TO authenticated;
