-- Complete teacher-to-parent contact lookup and include the student in direct conversations.
-- This migration only extends the existing school messaging workflow; no UI or role model changes.

CREATE OR REPLACE FUNCTION public.school_teacher_parent_contacts(p_student_membership_id uuid)
RETURNS TABLE(parent_membership_id uuid, parent_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.school_memberships%ROWTYPE;
  v_teacher_id uuid;
BEGIN
  SELECT * INTO v_student
  FROM public.school_memberships
  WHERE id = p_student_membership_id
    AND school_role = 'student'
    AND status = 'active';

  IF v_student.id IS NULL OR v_student.section_id IS NULL THEN
    RAISE EXCEPTION 'Active enrolled student not found';
  END IF;

  v_teacher_id := public.school_my_membership_id(v_student.school_id);
  IF v_teacher_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.school_teacher_assignments assignment
    WHERE assignment.teacher_membership_id = v_teacher_id
      AND assignment.school_id = v_student.school_id
      AND assignment.section_id = v_student.section_id
  ) THEN
    RAISE EXCEPTION 'Teacher must be assigned to the selected student section';
  END IF;

  RETURN QUERY
  SELECT parent.id,
         coalesce(
           nullif(trim(profile.name), ''),
           nullif(trim(profile.username), ''),
           nullif(trim(parent.school_username), ''),
           'Parent'
         )::text
  FROM public.school_parent_student_links link
  JOIN public.school_memberships parent
    ON parent.id = link.parent_membership_id
   AND parent.school_id = v_student.school_id
   AND parent.school_role = 'parent'
   AND parent.status = 'active'
  LEFT JOIN public.profiles profile ON profile.id = parent.user_id
  WHERE link.school_id = v_student.school_id
    AND link.student_membership_id = v_student.id
    AND link.status = 'active'
  ORDER BY parent.id;
END;
$$;

REVOKE ALL ON FUNCTION public.school_teacher_parent_contacts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_teacher_parent_contacts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.school_create_conversation(
  p_school_id uuid,
  p_conversation_type text,
  p_student_membership_id uuid DEFAULT NULL,
  p_section_id uuid DEFAULT NULL,
  p_participant_membership_ids uuid[] DEFAULT '{}'::uuid[],
  p_subject_name text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator_id uuid;
  v_creator_role text;
  v_student public.school_memberships%ROWTYPE;
  v_participant uuid;
  v_role text;
  v_conversation_id uuid;
  v_ids uuid[];
BEGIN
  v_creator_id := public.school_my_membership_id(p_school_id);
  IF v_creator_id IS NULL THEN RAISE EXCEPTION 'Active school membership required'; END IF;
  SELECT school_role INTO v_creator_role FROM public.school_memberships WHERE id = v_creator_id;

  IF p_conversation_type = 'class' THEN
    IF p_section_id IS NULL OR v_creator_role NOT IN ('teacher', 'admin') THEN
      RAISE EXCEPTION 'Only an assigned teacher or School Admin can create a class conversation';
    END IF;
    IF v_creator_role = 'teacher' AND NOT EXISTS (
      SELECT 1 FROM public.school_teacher_assignments assignment
      WHERE assignment.teacher_membership_id = v_creator_id
        AND assignment.section_id = p_section_id
    ) THEN
      RAISE EXCEPTION 'Teacher is not assigned to this section';
    END IF;
    INSERT INTO public.school_conversations(
      school_id, conversation_type, section_id, subject_name, created_by_membership_id
    )
    VALUES (p_school_id, 'class', p_section_id, nullif(trim(p_subject_name), ''), v_creator_id)
    RETURNING id INTO v_conversation_id;
    INSERT INTO public.school_conversation_participants(
      school_id, conversation_id, membership_id, added_by_membership_id
    )
    VALUES (p_school_id, v_conversation_id, v_creator_id, v_creator_id);
    RETURN v_conversation_id;
  END IF;

  IF p_conversation_type <> 'direct' OR p_student_membership_id IS NULL THEN
    RAISE EXCEPTION 'A direct conversation must identify a student';
  END IF;
  SELECT * INTO v_student FROM public.school_memberships
  WHERE id = p_student_membership_id
    AND school_id = p_school_id
    AND school_role = 'student'
    AND status IN ('active', 'suspended');
  IF v_student.id IS NULL THEN RAISE EXCEPTION 'Student is not active in this school'; END IF;

  -- The student must be a participant as well as the conversation subject.
  -- Without this, the student's RLS policy cannot read or reply to the direct thread.
  SELECT array_agg(DISTINCT participants.participant_id)
  INTO v_ids
  FROM unnest(
    coalesce(p_participant_membership_ids, '{}'::uuid[])
    || ARRAY[v_creator_id, p_student_membership_id]
  ) AS participants(participant_id);
  IF coalesce(cardinality(v_ids), 0) < 2 OR cardinality(v_ids) > 6 THEN
    RAISE EXCEPTION 'Direct conversations require 2 to 6 participants';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_ids) AS participants(participant_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_memberships membership
      WHERE membership.id = participants.participant_id
        AND membership.school_id = p_school_id
        AND membership.status = 'active'
        AND membership.school_role IN ('admin', 'teacher', 'parent', 'student')
    )
  ) THEN
    RAISE EXCEPTION 'Every participant must be an active student, parent, teacher, or Admin in this school';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM unnest(v_ids) AS participants(participant_id)
    JOIN public.school_memberships membership ON membership.id = participants.participant_id
    WHERE membership.school_role IN ('admin', 'teacher')
  ) THEN
    RAISE EXCEPTION 'A teacher or School Admin must participate in direct conversations';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_ids) AS participants(participant_id)
    JOIN public.school_memberships membership ON membership.id = participants.participant_id
    WHERE membership.school_role = 'parent'
      AND NOT EXISTS (
        SELECT 1 FROM public.school_parent_student_links link
        WHERE link.parent_membership_id = membership.id
          AND link.student_membership_id = p_student_membership_id
          AND link.status = 'active'
      )
  ) THEN
    RAISE EXCEPTION 'Parent participants must be linked to the selected student';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_ids) AS participants(participant_id)
    JOIN public.school_memberships membership ON membership.id = participants.participant_id
    WHERE membership.school_role = 'teacher'
      AND NOT EXISTS (
        SELECT 1 FROM public.school_teacher_assignments assignment
        WHERE assignment.teacher_membership_id = membership.id
          AND assignment.section_id = v_student.section_id
      )
  ) THEN
    RAISE EXCEPTION 'Teacher participants must be assigned to the selected student section';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_ids) AS participants(participant_id)
    JOIN public.school_memberships membership ON membership.id = participants.participant_id
    WHERE membership.school_role = 'student'
      AND membership.id <> p_student_membership_id
  ) THEN
    RAISE EXCEPTION 'A direct conversation can include only the selected student';
  END IF;

  INSERT INTO public.school_conversations(
    school_id, conversation_type, student_membership_id, subject_name, created_by_membership_id
  )
  VALUES (p_school_id, 'direct', p_student_membership_id, nullif(trim(p_subject_name), ''), v_creator_id)
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.school_conversation_participants(
    school_id, conversation_id, membership_id, added_by_membership_id
  )
  SELECT p_school_id, v_conversation_id, participants.participant_id, v_creator_id
  FROM unnest(v_ids) AS participants(participant_id);

  RETURN v_conversation_id;
END;
$$;
