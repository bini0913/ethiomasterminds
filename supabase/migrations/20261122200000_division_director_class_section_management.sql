-- Division Directors own the class-count and section-name decisions for grades in their division.
-- School Managers retain academic-year and grade-to-division configuration, but do not create class sections.
BEGIN;

DROP POLICY IF EXISTS school_sections_manager_insert ON public.school_sections;

CREATE OR REPLACE FUNCTION public.school_division_director_create_sections(
  p_school_id uuid,
  p_academic_year_id uuid,
  p_grade_label text,
  p_section_names text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_division_scope text;
  v_name text;
  v_inserted integer := 0;
  v_total integer := 0;
  v_names text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Authentication required';
  END IF;

  IF p_school_id IS NULL OR p_academic_year_id IS NULL
     OR nullif(btrim(p_grade_label), '') IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'School, current academic year, and grade are required';
  END IF;

  IF p_section_names IS NULL OR cardinality(p_section_names) < 1 OR cardinality(p_section_names) > 30 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Create between 1 and 30 class sections at a time';
  END IF;

  SELECT array_agg(btrim(section_name) ORDER BY ordinality)
    INTO v_names
  FROM unnest(p_section_names) WITH ORDINALITY AS submitted(section_name, ordinality);

  IF EXISTS (
    SELECT 1 FROM unnest(v_names) AS submitted(section_name)
    WHERE section_name IS NULL
       OR char_length(section_name) < 1
       OR char_length(section_name) > 30
  ) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Each section name must contain 1 to 30 characters';
  END IF;

  IF (SELECT count(DISTINCT lower(section_name)) FROM unnest(v_names) AS submitted(section_name))
     <> cardinality(v_names) THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Section names must be unique, ignoring letter case';
  END IF;

  SELECT appointment.division_scope
    INTO v_division_scope
  FROM public.school_leadership_appointments appointment
  JOIN public.school_memberships leader
    ON leader.id = appointment.membership_id
   AND leader.school_id = appointment.school_id
  JOIN public.school_division_grade_mappings mapping
    ON mapping.school_id = appointment.school_id
   AND mapping.division_scope = appointment.division_scope
   AND mapping.grade_label = btrim(p_grade_label)
  WHERE appointment.school_id = p_school_id
    AND appointment.position IN ('kg_director', 'elementary_director', 'middle_school_director', 'high_school_director')
    AND appointment.status = 'active'
    AND appointment.start_date <= CURRENT_DATE
    AND (appointment.end_date IS NULL OR appointment.end_date >= CURRENT_DATE)
    AND leader.user_id = auth.uid()
    AND leader.status = 'active'
  LIMIT 1;

  IF v_division_scope IS NULL THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Only the active Director of the division mapped to this grade can create its class sections';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.school_academic_years academic_year
    WHERE academic_year.id = p_academic_year_id
      AND academic_year.school_id = p_school_id
      AND academic_year.is_current = true
  ) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'Choose the active academic year for this school';
  END IF;

  FOREACH v_name IN ARRAY v_names LOOP
    IF EXISTS (
      SELECT 1
      FROM public.school_sections existing
      WHERE existing.school_id = p_school_id
        AND existing.academic_year_id = p_academic_year_id
        AND existing.grade_label = btrim(p_grade_label)
        AND lower(existing.section_name) = lower(v_name)
        AND existing.section_name <> v_name
    ) THEN
      RAISE EXCEPTION USING errcode = '23505', message = format('A section named "%s" already exists with different letter casing', v_name);
    END IF;

    INSERT INTO public.school_sections (
      school_id, academic_year_id, grade_label, section_name
    ) VALUES (
      p_school_id, p_academic_year_id, btrim(p_grade_label), v_name
    )
    ON CONFLICT (school_id, academic_year_id, grade_label, section_name) DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_total := v_total + v_inserted;
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.school_division_director_create_sections(uuid, uuid, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_division_director_create_sections(uuid, uuid, text, text[]) TO authenticated;

COMMIT;
