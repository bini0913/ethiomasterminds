-- Break the grade-mapping / class-section bootstrap cycle.
-- School Managers may map configured school grade labels before sections exist;
-- Division Directors can then create the actual class sections for their mapped grades.
BEGIN;

CREATE OR REPLACE FUNCTION public.school_set_division_grade_mapping(
  p_school_id uuid,
  p_grade_label text,
  p_division_scope text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor public.school_memberships%ROWTYPE;
  v_grade text := nullif(trim(p_grade_label), '');
  v_existing_grade text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_grade IS NULL OR char_length(v_grade) > 80 THEN
    RAISE EXCEPTION 'Grade label must contain 1 to 80 characters';
  END IF;

  SELECT *
  INTO v_actor
  FROM public.school_memberships
  WHERE school_id = p_school_id
    AND user_id = auth.uid()
    AND school_role = 'manager'
    AND status = 'active'
  LIMIT 1;

  IF v_actor.id IS NULL THEN
    RAISE EXCEPTION 'An active School Manager membership in this school is required';
  END IF;

  SELECT existing_mapping.grade_label
  INTO v_existing_grade
  FROM public.school_division_grade_mappings existing_mapping
  WHERE existing_mapping.school_id = v_actor.school_id
    AND lower(existing_mapping.grade_label) = lower(v_grade)
  LIMIT 1;

  IF v_existing_grade IS NULL THEN
    SELECT section.grade_label
    INTO v_existing_grade
    FROM public.school_sections section
    WHERE section.school_id = v_actor.school_id
      AND lower(section.grade_label) = lower(v_grade)
    LIMIT 1;
  END IF;

  IF v_existing_grade IS NOT NULL THEN
    v_grade := v_existing_grade;
  END IF;

  IF p_division_scope IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.school_sections section
      WHERE section.school_id = v_actor.school_id
        AND section.grade_label = v_grade
    ) THEN
      RAISE EXCEPTION 'A grade mapping cannot be removed while class sections exist for that grade';
    END IF;

    DELETE FROM public.school_division_grade_mappings
    WHERE school_id = v_actor.school_id
      AND grade_label = v_grade;

    INSERT INTO public.school_leadership_structure_events (
      school_id, actor_user_id, actor_membership_id, event_type, details
    ) VALUES (
      v_actor.school_id, auth.uid(), v_actor.id, 'division_grade_unmapped',
      jsonb_build_object('grade_label', v_grade)
    );
    RETURN true;
  END IF;

  IF p_division_scope NOT IN ('kg', 'elementary', 'middle_school', 'high_school') THEN
    RAISE EXCEPTION 'Invalid school division';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.school_sections section
    JOIN public.school_division_grade_mappings existing_mapping
      ON existing_mapping.school_id = section.school_id
     AND existing_mapping.grade_label = section.grade_label
    WHERE section.school_id = v_actor.school_id
      AND section.grade_label = v_grade
      AND existing_mapping.division_scope <> p_division_scope
  ) THEN
    RAISE EXCEPTION 'A grade with existing class sections cannot be moved to another division';
  END IF;

  INSERT INTO public.school_division_grade_mappings (
    school_id, division_scope, grade_label, created_by_membership_id, updated_by_membership_id
  ) VALUES (
    v_actor.school_id, p_division_scope, v_grade, v_actor.id, v_actor.id
  )
  ON CONFLICT (school_id, grade_label) DO UPDATE
  SET division_scope = EXCLUDED.division_scope,
      updated_by_membership_id = EXCLUDED.updated_by_membership_id,
      updated_at = now();

  INSERT INTO public.school_leadership_structure_events (
    school_id, actor_user_id, actor_membership_id, event_type, details
  ) VALUES (
    v_actor.school_id, auth.uid(), v_actor.id, 'division_grade_mapped',
    jsonb_build_object('grade_label', v_grade, 'division_scope', p_division_scope)
  );
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.school_set_division_grade_mapping(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_set_division_grade_mapping(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.school_initialize_default_ethiopian_grade_mappings(p_school_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor public.school_memberships%ROWTYPE;
  v_inserted integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_actor
  FROM public.school_memberships
  WHERE school_id = p_school_id
    AND user_id = auth.uid()
    AND school_role = 'manager'
    AND status = 'active'
  LIMIT 1;

  IF v_actor.id IS NULL THEN
    RAISE EXCEPTION 'An active School Manager membership in this school is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('Nursery', 'kg'),
      ('KG 1', 'kg'),
      ('KG 2', 'kg'),
      ('Grade 1', 'elementary'),
      ('Grade 2', 'elementary'),
      ('Grade 3', 'elementary'),
      ('Grade 4', 'elementary'),
      ('Grade 5', 'elementary'),
      ('Grade 6', 'elementary'),
      ('Grade 7', 'middle_school'),
      ('Grade 8', 'middle_school'),
      ('Grade 9', 'high_school'),
      ('Grade 10', 'high_school'),
      ('Grade 11', 'high_school'),
      ('Grade 12', 'high_school')
    ) AS default_mapping(grade_label, division_scope)
    JOIN public.school_division_grade_mappings existing_mapping
      ON existing_mapping.school_id = v_actor.school_id
     AND lower(existing_mapping.grade_label) = lower(default_mapping.grade_label)
    WHERE existing_mapping.grade_label <> default_mapping.grade_label
  ) THEN
    RAISE EXCEPTION 'An existing grade label differs only by letter casing; resolve it before applying the standard structure';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('Nursery', 'kg'),
      ('KG 1', 'kg'),
      ('KG 2', 'kg'),
      ('Grade 1', 'elementary'),
      ('Grade 2', 'elementary'),
      ('Grade 3', 'elementary'),
      ('Grade 4', 'elementary'),
      ('Grade 5', 'elementary'),
      ('Grade 6', 'elementary'),
      ('Grade 7', 'middle_school'),
      ('Grade 8', 'middle_school'),
      ('Grade 9', 'high_school'),
      ('Grade 10', 'high_school'),
      ('Grade 11', 'high_school'),
      ('Grade 12', 'high_school')
    ) AS default_mapping(grade_label, division_scope)
    JOIN public.school_division_grade_mappings existing_mapping
      ON existing_mapping.school_id = v_actor.school_id
     AND existing_mapping.grade_label = default_mapping.grade_label
    WHERE existing_mapping.division_scope <> default_mapping.division_scope
  ) THEN
    RAISE EXCEPTION 'Existing grade mappings conflict with the standard Ethiopian grade structure; review those mappings first';
  END IF;

  INSERT INTO public.school_division_grade_mappings (
    school_id, division_scope, grade_label, created_by_membership_id, updated_by_membership_id
  )
  SELECT
    v_actor.school_id,
    default_mapping[2],
    default_mapping[1],
    v_actor.id,
    v_actor.id
  FROM (VALUES
    ('Nursery', 'kg'),
    ('KG 1', 'kg'),
    ('KG 2', 'kg'),
    ('Grade 1', 'elementary'),
    ('Grade 2', 'elementary'),
    ('Grade 3', 'elementary'),
    ('Grade 4', 'elementary'),
    ('Grade 5', 'elementary'),
    ('Grade 6', 'elementary'),
    ('Grade 7', 'middle_school'),
    ('Grade 8', 'middle_school'),
    ('Grade 9', 'high_school'),
    ('Grade 10', 'high_school'),
    ('Grade 11', 'high_school'),
    ('Grade 12', 'high_school')
  ) AS default_mapping(grade_label, division_scope)
  ON CONFLICT (school_id, grade_label) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  INSERT INTO public.school_leadership_structure_events (
    school_id, actor_user_id, actor_membership_id, event_type, details
  ) VALUES (
    v_actor.school_id,
    auth.uid(),
    v_actor.id,
    'division_grade_mapped',
    jsonb_build_object(
      'action', 'default_ethiopian_grade_structure_initialized',
      'added_count', v_inserted,
      'grade_labels', ARRAY[
        'Nursery', 'KG 1', 'KG 2',
        'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
        'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
      ]
    )
  );

  RETURN v_inserted;
END;
$function$;

REVOKE ALL ON FUNCTION public.school_initialize_default_ethiopian_grade_mappings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_initialize_default_ethiopian_grade_mappings(uuid) TO authenticated;

COMMIT;
