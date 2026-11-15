-- School-scoped announcements and messaging. These are separate from global
-- Individual Learning announcements/messages so school records never leak across tenants.

CREATE TABLE IF NOT EXISTS public.school_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 180),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 12000),
  audience_type text NOT NULL CHECK (audience_type IN ('school', 'grade', 'section', 'parents', 'students', 'staff')),
  grade_label text,
  section_id uuid,
  created_by_membership_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'rejected')),
  reviewed_by_membership_id uuid,
  reviewed_at timestamptz,
  review_feedback text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (created_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  UNIQUE (id, school_id),
  CHECK (
    (audience_type = 'grade' AND grade_label IS NOT NULL AND section_id IS NULL)
    OR (audience_type = 'section' AND grade_label IS NOT NULL AND section_id IS NOT NULL)
    OR (audience_type IN ('school', 'parents', 'students', 'staff') AND section_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS school_announcements_audience_idx
  ON public.school_announcements(school_id, status, audience_type, grade_label, section_id, published_at DESC);

CREATE TABLE IF NOT EXISTS public.school_announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  announcement_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (announcement_id, school_id)
    REFERENCES public.school_announcements(id, school_id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE CASCADE,
  UNIQUE (announcement_id, membership_id)
);

CREATE OR REPLACE FUNCTION public.school_my_membership_id(p_school_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT membership.id
  FROM public.school_memberships membership
  WHERE membership.school_id = p_school_id
    AND membership.user_id = auth.uid()
    AND membership.status = 'active'
  ORDER BY CASE membership.school_role
    WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'teacher' THEN 3
    WHEN 'parent' THEN 4 WHEN 'student' THEN 5 WHEN 'finance' THEN 6 ELSE 7 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.school_is_assigned_to_section(
  p_school_id uuid, p_section_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_memberships teacher
    JOIN public.school_teacher_assignments assignment
      ON assignment.teacher_membership_id = teacher.id
     AND assignment.school_id = teacher.school_id
    WHERE teacher.user_id = auth.uid()
      AND teacher.school_id = p_school_id
      AND teacher.school_role = 'teacher'
      AND teacher.status = 'active'
      AND assignment.section_id = p_section_id
  );
$;

CREATE OR REPLACE FUNCTION public.school_can_view_announcement(p_announcement_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_announcements announcement
    WHERE announcement.id = p_announcement_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(announcement.school_id)
        OR (
          announcement.created_by_membership_id = public.school_my_membership_id(announcement.school_id)
          AND announcement.status IN ('draft', 'pending', 'rejected')
        )
        OR (
          announcement.status = 'published'
          AND (
            EXISTS (
              SELECT 1 FROM public.school_memberships staff
              WHERE staff.user_id = auth.uid()
                AND staff.school_id = announcement.school_id
                AND staff.status = 'active'
                AND staff.school_role IN ('teacher', 'finance')
                AND announcement.audience_type IN ('school', 'grade', 'section', 'staff')
                AND (
                  announcement.audience_type IN ('school', 'staff')
                  OR (announcement.audience_type = 'grade' AND EXISTS (
                    SELECT 1 FROM public.school_teacher_assignments assignment
                    JOIN public.school_sections section ON section.id = assignment.section_id
                    WHERE assignment.teacher_membership_id = staff.id
                      AND section.grade_label = announcement.grade_label
                  ))
                  OR (announcement.audience_type = 'section' AND public.school_is_assigned_to_section(announcement.school_id, announcement.section_id))
                )
            )
            OR EXISTS (
              SELECT 1 FROM public.school_memberships student
              WHERE student.user_id = auth.uid()
                AND student.school_id = announcement.school_id
                AND student.school_role = 'student'
                AND student.status IN ('active', 'suspended')
                AND announcement.audience_type IN ('school', 'grade', 'section', 'students')
                AND (
                  announcement.audience_type IN ('school', 'students')
                  OR (announcement.audience_type = 'grade' AND student.grade_label = announcement.grade_label)
                  OR (announcement.audience_type = 'section' AND student.section_id = announcement.section_id)
                )
            )
            OR EXISTS (
              SELECT 1
              FROM public.school_parent_student_links link
              JOIN public.school_memberships parent ON parent.id = link.parent_membership_id
              JOIN public.school_memberships student ON student.id = link.student_membership_id
              WHERE parent.user_id = auth.uid()
                AND parent.school_id = announcement.school_id
                AND parent.school_role = 'parent'
                AND parent.status = 'active'
                AND link.status = 'active'
                AND student.status IN ('active', 'suspended')
                AND announcement.audience_type IN ('school', 'grade', 'section', 'parents')
                AND (
                  announcement.audience_type IN ('school', 'parents')
                  OR (announcement.audience_type = 'grade' AND student.grade_label = announcement.grade_label)
                  OR (announcement.audience_type = 'section' AND student.section_id = announcement.section_id)
                )
            )
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_manage_announcement(p_announcement_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_announcements announcement
    WHERE announcement.id = p_announcement_id
      AND (
        public.school_is_admin(announcement.school_id)
        OR (
          announcement.created_by_membership_id = public.school_my_membership_id(announcement.school_id)
          AND announcement.status IN ('draft', 'rejected')
          AND announcement.audience_type = 'section'
          AND public.school_is_assigned_to_section(announcement.school_id, announcement.section_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_validate_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_creator public.school_memberships%ROWTYPE;
  v_transition text := coalesce(current_setting('app.school_announcement_transition', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_creator FROM public.school_memberships
    WHERE id = NEW.created_by_membership_id AND school_id = NEW.school_id;
    IF v_creator.id IS NULL OR v_creator.user_id <> auth.uid() OR v_creator.status <> 'active' THEN
      RAISE EXCEPTION 'Announcement creator must be an active school member';
    END IF;
    IF v_creator.school_role = 'teacher' THEN
      IF NEW.audience_type <> 'section' OR NEW.status <> 'draft'
         OR NOT public.school_is_assigned_to_section(NEW.school_id, NEW.section_id) THEN
        RAISE EXCEPTION 'Teachers can create draft announcements only for assigned sections';
      END IF;
    ELSIF v_creator.school_role = 'admin' OR public._is_extreme_admin() THEN
      IF NEW.status NOT IN ('draft', 'published') THEN
        RAISE EXCEPTION 'School Admin announcements must start as draft or published';
      END IF;
      IF NEW.status = 'published' THEN
        NEW.reviewed_by_membership_id := v_creator.id;
        NEW.reviewed_at := now();
        NEW.published_at := now();
      END IF;
    ELSE
      RAISE EXCEPTION 'Only School Admins and assigned teachers can create announcements';
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(NEW.school_id, NEW.created_by_membership_id, NEW.audience_type, NEW.grade_label,
         NEW.section_id, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.school_id, OLD.created_by_membership_id, OLD.audience_type, OLD.grade_label,
         OLD.section_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Announcement ownership and audience scope are immutable';
  END IF;
  IF (NEW.status IS DISTINCT FROM OLD.status
      OR NEW.reviewed_by_membership_id IS DISTINCT FROM OLD.reviewed_by_membership_id
      OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
      OR NEW.review_feedback IS DISTINCT FROM OLD.review_feedback
      OR NEW.published_at IS DISTINCT FROM OLD.published_at)
     AND v_transition NOT IN ('submit', 'review') THEN
    RAISE EXCEPTION 'Announcement submission and review must use the guarded workflow';
  END IF;
  IF v_transition = '' AND NOT public.school_can_manage_announcement(OLD.id) THEN
    RAISE EXCEPTION 'Only the assigned teacher can edit a draft or rejected announcement';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_submit_announcement(p_announcement_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.school_can_manage_announcement(p_announcement_id) THEN
    RAISE EXCEPTION 'Only the assigned teacher can submit this announcement';
  END IF;
  PERFORM set_config('app.school_announcement_transition', 'submit', true);
  UPDATE public.school_announcements SET status = 'pending' WHERE id = p_announcement_id;
  PERFORM set_config('app.school_announcement_transition', '', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_review_announcement(
  p_announcement_id uuid, p_approved boolean, p_feedback text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_announcement public.school_announcements%ROWTYPE;
  v_reviewer uuid;
BEGIN
  SELECT * INTO v_announcement FROM public.school_announcements
  WHERE id = p_announcement_id FOR UPDATE;
  IF v_announcement.id IS NULL OR NOT public.school_is_admin(v_announcement.school_id)
     OR v_announcement.status <> 'pending' THEN
    RAISE EXCEPTION 'Only the School Admin can review a pending announcement';
  END IF;
  SELECT id INTO v_reviewer FROM public.school_memberships
  WHERE school_id = v_announcement.school_id AND user_id = auth.uid()
    AND school_role = 'admin' AND status = 'active'
  LIMIT 1;
  PERFORM set_config('app.school_announcement_transition', 'review', true);
  UPDATE public.school_announcements
  SET status = CASE WHEN p_approved THEN 'published' ELSE 'rejected' END,
      reviewed_by_membership_id = v_reviewer,
      reviewed_at = now(),
      published_at = CASE WHEN p_approved THEN now() ELSE NULL END,
      review_feedback = nullif(trim(p_feedback), '')
  WHERE id = p_announcement_id;
  PERFORM set_config('app.school_announcement_transition', '', true);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_notify_parents_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $
DECLARE
  v_just_published boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_just_published := NEW.status = 'published';
  ELSIF TG_OP = 'UPDATE' THEN
    v_just_published := NEW.status = 'published' AND OLD.status IS DISTINCT FROM NEW.status;
  END IF;
  IF v_just_published THEN
    INSERT INTO public.school_parent_notifications(
      school_id, parent_membership_id, student_membership_id,
      notification_type, title, message
    )
    SELECT DISTINCT link.school_id, link.parent_membership_id, student.id,
           'announcement', NEW.title, NEW.body
    FROM public.school_parent_student_links link
    JOIN public.school_memberships student ON student.id = link.student_membership_id
    WHERE link.school_id = NEW.school_id
      AND link.status = 'active'
      AND student.status IN ('active', 'suspended')
      AND (
        NEW.audience_type IN ('school', 'parents')
        OR (NEW.audience_type = 'grade' AND student.grade_label = NEW.grade_label)
        OR (NEW.audience_type = 'section' AND student.section_id = NEW.section_id)
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.school_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  conversation_type text NOT NULL CHECK (conversation_type IN ('direct', 'class')),
  section_id uuid,
  student_membership_id uuid,
  subject_name text,
  created_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  archived_at timestamptz,
  FOREIGN KEY (section_id, school_id)
    REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (student_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  UNIQUE (id, school_id),
  CHECK (
    (conversation_type = 'class' AND section_id IS NOT NULL AND student_membership_id IS NULL)
    OR (conversation_type = 'direct' AND student_membership_id IS NOT NULL AND section_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.school_conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  added_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conversation_id, school_id)
    REFERENCES public.school_conversations(id, school_id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE CASCADE,
  FOREIGN KEY (added_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  UNIQUE (conversation_id, membership_id)
);

CREATE TABLE IF NOT EXISTS public.school_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL,
  sender_membership_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conversation_id, school_id)
    REFERENCES public.school_conversations(id, school_id) ON DELETE CASCADE,
  FOREIGN KEY (sender_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  UNIQUE (id, school_id)
);

CREATE TABLE IF NOT EXISTS public.school_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  message_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (message_id, school_id)
    REFERENCES public.school_messages(id, school_id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE CASCADE,
  UNIQUE (message_id, membership_id)
);

CREATE INDEX IF NOT EXISTS school_conversations_school_idx
  ON public.school_conversations(school_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS school_messages_conversation_idx
  ON public.school_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS school_conversation_participants_membership_idx
  ON public.school_conversation_participants(membership_id, conversation_id);

CREATE OR REPLACE FUNCTION public.school_can_access_conversation(p_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_conversations conversation
    WHERE conversation.id = p_conversation_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(conversation.school_id)
        OR (
          conversation.conversation_type = 'class'
          AND EXISTS (
            SELECT 1 FROM public.school_memberships membership
            WHERE membership.user_id = auth.uid()
              AND membership.school_id = conversation.school_id
              AND membership.status IN ('active', 'suspended')
              AND (
                (membership.school_role = 'teacher' AND EXISTS (
                  SELECT 1 FROM public.school_teacher_assignments assignment
                  WHERE assignment.teacher_membership_id = membership.id
                    AND assignment.section_id = conversation.section_id
                ))
                OR (membership.school_role = 'student' AND membership.section_id = conversation.section_id)
                OR (membership.school_role = 'parent' AND EXISTS (
                  SELECT 1
                  FROM public.school_parent_student_links link
                  JOIN public.school_memberships student ON student.id = link.student_membership_id
                  WHERE link.parent_membership_id = membership.id
                    AND link.status = 'active'
                    AND student.section_id = conversation.section_id
                    AND student.status IN ('active', 'suspended')
                ))
              )
          )
        )
        OR (
          conversation.conversation_type = 'direct'
          AND EXISTS (
            SELECT 1
            FROM public.school_conversation_participants participant
            JOIN public.school_memberships membership ON membership.id = participant.membership_id
            WHERE participant.conversation_id = conversation.id
              AND membership.user_id = auth.uid()
              AND membership.status = 'active'
              AND (
                (membership.school_role = 'student' AND membership.id = conversation.student_membership_id
                  AND membership.status IN ('active', 'suspended'))
                OR (membership.school_role = 'parent' AND EXISTS (
                  SELECT 1 FROM public.school_parent_student_links link
                  WHERE link.parent_membership_id = membership.id
                    AND link.student_membership_id = conversation.student_membership_id
                    AND link.status = 'active'
                ))
                OR (membership.school_role = 'teacher' AND EXISTS (
                  SELECT 1 FROM public.school_teacher_assignments assignment
                  WHERE assignment.teacher_membership_id = membership.id
                    AND assignment.section_id = (
                      SELECT student.section_id FROM public.school_memberships student
                      WHERE student.id = conversation.student_membership_id
                    )
                ))
                OR membership.school_role = 'admin'
              )
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_send_message(p_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_conversations conversation
    WHERE conversation.id = p_conversation_id
      AND public.school_can_access_conversation(conversation.id)
      AND EXISTS (
        SELECT 1 FROM public.school_memberships sender
        WHERE sender.user_id = auth.uid()
          AND sender.school_id = conversation.school_id
          AND sender.status = 'active'
          AND sender.school_role IN ('admin', 'teacher', 'parent', 'student')
          AND (
            sender.school_role = 'admin'
            OR (
              conversation.conversation_type = 'class'
              AND (
                (sender.school_role = 'teacher' AND EXISTS (
                  SELECT 1 FROM public.school_teacher_assignments assignment
                  WHERE assignment.teacher_membership_id = sender.id
                    AND assignment.section_id = conversation.section_id
                ))
                OR (sender.school_role = 'student' AND sender.section_id = conversation.section_id)
                OR (sender.school_role = 'parent' AND EXISTS (
                  SELECT 1
                  FROM public.school_parent_student_links link
                  JOIN public.school_memberships student ON student.id = link.student_membership_id
                  WHERE link.parent_membership_id = sender.id
                    AND link.status = 'active'
                    AND student.section_id = conversation.section_id
                    AND student.status IN ('active', 'suspended')
                ))
              )
            )
            OR (
              conversation.conversation_type = 'direct'
              AND EXISTS (
                SELECT 1 FROM public.school_conversation_participants participant
                WHERE participant.conversation_id = conversation.id
                  AND participant.membership_id = sender.id
              )
              AND (
                (sender.school_role = 'student' AND sender.id = conversation.student_membership_id)
                OR (sender.school_role = 'parent' AND EXISTS (
                  SELECT 1 FROM public.school_parent_student_links link
                  WHERE link.parent_membership_id = sender.id
                    AND link.student_membership_id = conversation.student_membership_id
                    AND link.status = 'active'
                ))
                OR (sender.school_role = 'teacher' AND EXISTS (
                  SELECT 1 FROM public.school_teacher_assignments assignment
                  WHERE assignment.teacher_membership_id = sender.id
                    AND assignment.section_id = (
                      SELECT student.section_id FROM public.school_memberships student
                      WHERE student.id = conversation.student_membership_id
                    )
                ))
              )
            )
          )
      )
  );
$$;

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

  SELECT array_agg(DISTINCT participants.participant_id)
  INTO v_ids
  FROM unnest(coalesce(p_participant_membership_ids, '{}'::uuid[]) || ARRAY[v_creator_id]) AS participants(participant_id);
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
    SELECT 1 FROM unnest(v_ids) participant_id
    JOIN public.school_memberships membership ON membership.id = participant_id
    WHERE membership.school_role IN ('admin', 'teacher')
  ) THEN
    RAISE EXCEPTION 'A teacher or School Admin must participate in direct conversations';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_ids) participant_id
    JOIN public.school_memberships membership ON membership.id = participant_id
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
    SELECT 1 FROM unnest(v_ids) participant_id
    JOIN public.school_memberships membership ON membership.id = participant_id
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
    SELECT 1 FROM unnest(v_ids) participant_id
    JOIN public.school_memberships membership ON membership.id = participant_id
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

CREATE OR REPLACE FUNCTION public.school_notify_parent_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conversation public.school_conversations%ROWTYPE;
  v_sender_role text;
BEGIN
  SELECT * INTO v_conversation FROM public.school_conversations WHERE id = NEW.conversation_id;
  SELECT school_role INTO v_sender_role FROM public.school_memberships WHERE id = NEW.sender_membership_id;

  IF v_conversation.conversation_type = 'class' THEN
    INSERT INTO public.school_parent_notifications(
      school_id, parent_membership_id, student_membership_id, notification_type, title, message
    )
    SELECT DISTINCT v_conversation.school_id, link.parent_membership_id, student.id,
           'message', 'New class message', left(NEW.body, 400)
    FROM public.school_memberships student
    JOIN public.school_parent_student_links link
      ON link.student_membership_id = student.id
     AND link.status = 'active'
    WHERE student.school_id = v_conversation.school_id
      AND student.section_id = v_conversation.section_id
      AND student.status IN ('active', 'suspended')
      AND v_sender_role <> 'parent';
  ELSE
    INSERT INTO public.school_parent_notifications(
      school_id, parent_membership_id, student_membership_id, notification_type, title, message
    )
    SELECT v_conversation.school_id, participant.membership_id, v_conversation.student_membership_id,
           'message', 'New school message', left(NEW.body, 400)
    FROM public.school_conversation_participants participant
    JOIN public.school_memberships parent ON parent.id = participant.membership_id
    WHERE participant.conversation_id = v_conversation.id
      AND parent.school_role = 'parent'
      AND parent.status = 'active'
      AND parent.user_id <> auth.uid()
      AND v_sender_role <> 'parent';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_update_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.school_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

ALTER TABLE public.school_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_announcements_read ON public.school_announcements
FOR SELECT TO authenticated USING (public.school_can_view_announcement(id));
CREATE POLICY school_announcements_insert ON public.school_announcements
FOR INSERT TO authenticated
WITH CHECK (
  public.school_is_admin(school_id)
  OR (
    created_by_membership_id = public.school_my_membership_id(school_id)
    AND audience_type = 'section'
    AND status = 'draft'
    AND public.school_is_assigned_to_section(school_id, section_id)
  )
);
CREATE POLICY school_announcements_update ON public.school_announcements
FOR UPDATE TO authenticated
USING (public.school_can_manage_announcement(id))
WITH CHECK (public.school_can_manage_announcement(id));

CREATE POLICY school_announcement_reads_select ON public.school_announcement_reads
FOR SELECT TO authenticated
USING (
  membership_id = public.school_my_membership_id(school_id)
  AND public.school_can_view_announcement(announcement_id)
);
CREATE POLICY school_announcement_reads_insert ON public.school_announcement_reads
FOR INSERT TO authenticated
WITH CHECK (
  membership_id = public.school_my_membership_id(school_id)
  AND public.school_can_view_announcement(announcement_id)
);
CREATE POLICY school_announcement_reads_update ON public.school_announcement_reads
FOR UPDATE TO authenticated
USING (
  membership_id = public.school_my_membership_id(school_id)
  AND public.school_can_view_announcement(announcement_id)
)
WITH CHECK (
  membership_id = public.school_my_membership_id(school_id)
  AND public.school_can_view_announcement(announcement_id)
);

CREATE POLICY school_conversations_read ON public.school_conversations
FOR SELECT TO authenticated USING (public.school_can_access_conversation(id));
CREATE POLICY school_conversation_participants_read ON public.school_conversation_participants
FOR SELECT TO authenticated USING (public.school_can_access_conversation(conversation_id));
CREATE POLICY school_messages_read ON public.school_messages
FOR SELECT TO authenticated USING (public.school_can_access_conversation(conversation_id));
CREATE POLICY school_messages_insert ON public.school_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_membership_id = public.school_my_membership_id(school_id)
  AND public.school_can_send_message(conversation_id)
);
CREATE POLICY school_message_reads_select ON public.school_message_reads
FOR SELECT TO authenticated
USING (
  membership_id = public.school_my_membership_id(school_id)
  AND public.school_can_access_conversation(
    (SELECT message.conversation_id FROM public.school_messages message WHERE message.id = message_id)
  )
);
CREATE POLICY school_message_reads_insert ON public.school_message_reads
FOR INSERT TO authenticated
WITH CHECK (
  membership_id = public.school_my_membership_id(school_id)
  AND public.school_can_access_conversation(
    (SELECT message.conversation_id FROM public.school_messages message WHERE message.id = message_id)
  )
);
CREATE POLICY school_message_reads_update ON public.school_message_reads
FOR UPDATE TO authenticated
USING (
  membership_id = public.school_my_membership_id(school_id)
  AND public.school_can_access_conversation(
    (SELECT message.conversation_id FROM public.school_messages message WHERE message.id = message_id)
  )
)
WITH CHECK (
  membership_id = public.school_my_membership_id(school_id)
  AND public.school_can_access_conversation(
    (SELECT message.conversation_id FROM public.school_messages message WHERE message.id = message_id)
  )
);

GRANT SELECT, INSERT, UPDATE ON public.school_announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.school_announcement_reads TO authenticated;
GRANT SELECT ON public.school_conversations TO authenticated;
GRANT SELECT ON public.school_conversation_participants TO authenticated;
GRANT SELECT, INSERT ON public.school_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.school_message_reads TO authenticated;

DROP TRIGGER IF EXISTS school_announcement_validate ON public.school_announcements;
CREATE TRIGGER school_announcement_validate
BEFORE INSERT OR UPDATE ON public.school_announcements
FOR EACH ROW EXECUTE FUNCTION public.school_validate_announcement();

DROP TRIGGER IF EXISTS school_announcement_notify_parents ON public.school_announcements;
CREATE TRIGGER school_announcement_notify_parents
AFTER INSERT OR UPDATE OF status ON public.school_announcements
FOR EACH ROW EXECUTE FUNCTION public.school_notify_parents_announcement();

DROP TRIGGER IF EXISTS school_message_notify_parent ON public.school_messages;
CREATE TRIGGER school_message_notify_parent
AFTER INSERT ON public.school_messages
FOR EACH ROW EXECUTE FUNCTION public.school_notify_parent_message();

DROP TRIGGER IF EXISTS school_message_update_conversation ON public.school_messages;
CREATE TRIGGER school_message_update_conversation
AFTER INSERT ON public.school_messages
FOR EACH ROW EXECUTE FUNCTION public.school_update_conversation_last_message();

REVOKE ALL ON FUNCTION public.school_my_membership_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_is_assigned_to_section(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_announcement(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_manage_announcement(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_validate_announcement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_submit_announcement(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_review_announcement(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_notify_parents_announcement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_can_access_conversation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_send_message(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_create_conversation(uuid, text, uuid, uuid, uuid[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_notify_parent_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_update_conversation_last_message() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.school_my_membership_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_is_assigned_to_section(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_announcement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_manage_announcement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_submit_announcement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_review_announcement(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_access_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_send_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_create_conversation(uuid, text, uuid, uuid, uuid[], text) TO authenticated;
