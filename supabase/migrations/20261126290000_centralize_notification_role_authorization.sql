-- Centralize the first approved authorization slice: platform role assignment
-- and staff push-notification recipient/payload derivation.

CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (char_length(trim(kind)) BETWEEN 1 AND 100),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 2000),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_events_user_created_idx
  ON public.notification_events(user_id, created_at DESC);
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_events FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.notification_devices FROM authenticated;
GRANT SELECT ON TABLE public.notification_devices TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_assign_role(
  p_user_id uuid,
  p_role public.app_role
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A target account is required';
  END IF;
  IF p_role IN ('extreme_admin'::public.app_role, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Top-level roles require the dedicated platform provisioning workflow';
  END IF;

  IF p_user_id = auth.uid() THEN
    IF p_role <> 'student'::public.app_role THEN
      RAISE EXCEPTION 'Users may only self-assign the student role';
    END IF;
  ELSE
    IF NOT public._is_extreme_admin() THEN
      RAISE EXCEPTION 'Extreme Admin access required';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = p_user_id
        AND role IN ('extreme_admin'::public.app_role, 'super_admin'::public.app_role)
    ) THEN
      RAISE EXCEPTION 'Top-level account roles cannot be changed here';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Target account does not exist';
  END IF;

  IF p_user_id <> auth.uid() THEN
    DELETE FROM public.user_roles WHERE user_id = p_user_id;
  END IF;
  INSERT INTO public.user_roles(user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    CASE WHEN p_user_id = auth.uid() THEN 'self_assign_role' ELSE 'platform_assign_role' END,
    'user',
    p_user_id,
    jsonb_build_object('role', p_role)
  );
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.platform_assign_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_assign_role(uuid, public.app_role) TO authenticated;

-- This RPC returns only records the caller is authorized to notify. The Edge
-- Function cannot choose an arbitrary recipient or message for staff pushes.
CREATE OR REPLACE FUNCTION public.authorize_staff_push_notification(
  p_source_id uuid,
  p_kind text
)
RETURNS TABLE(
  recipient_id uuid,
  notification_kind text,
  notification_title text,
  notification_body text,
  notification_data jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_announcement public.announcements%ROWTYPE;
  v_assignment public.quiz_assignments%ROWTYPE;
  v_quiz public.quizzes%ROWTYPE;
  v_is_staff boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  v_is_staff := private.has_role_for_user(auth.uid(), 'teacher'::public.app_role)
    OR private.has_role_for_user(auth.uid(), 'admin'::public.app_role)
    OR private.has_role_for_user(auth.uid(), 'manager'::public.app_role)
    OR public._is_extreme_admin();
  IF NOT v_is_staff THEN
    RAISE EXCEPTION 'Staff notification authorization required';
  END IF;

  IF p_kind IN ('teacher_announcement', 'admin_announcement') THEN
    SELECT * INTO v_announcement
    FROM public.announcements
    WHERE id = p_source_id AND author_id = auth.uid();
    IF v_announcement.id IS NULL THEN
      RAISE EXCEPTION 'Announcement not found or not owned by caller';
    END IF;
    IF p_kind = 'teacher_announcement' THEN
      IF NOT private.has_role_for_user(auth.uid(), 'teacher'::public.app_role) THEN
        RAISE EXCEPTION 'Teacher announcement authorization required';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.school_memberships actor
        WHERE actor.user_id = auth.uid()
          AND actor.school_role = 'teacher'
          AND actor.status = 'active'
      ) THEN
        RAISE EXCEPTION 'An active teacher school membership is required';
      END IF;
      IF v_announcement.target_type = 'class' THEN
        IF v_announcement.target_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.classes c
          WHERE c.id = v_announcement.target_id AND c.teacher_id = auth.uid()
        ) THEN
          RAISE EXCEPTION 'Teacher may notify only an owned class';
        END IF;
        RETURN QUERY
        SELECT DISTINCT cs.student_id, p_kind, v_announcement.title, v_announcement.content,
          jsonb_build_object('route', '/notifications', 'announcement_id', v_announcement.id)
        FROM public.class_students cs
        WHERE cs.class_id = v_announcement.target_id
          AND EXISTS (
            SELECT 1
            FROM public.school_memberships actor
            JOIN public.school_memberships student
              ON student.school_id = actor.school_id
             AND student.user_id = cs.student_id
             AND student.school_role = 'student'
             AND student.status IN ('active', 'suspended')
            WHERE actor.user_id = auth.uid()
              AND actor.school_role = 'teacher'
              AND actor.status = 'active'
          );
      ELSIF v_announcement.target_type = 'students' THEN
        RETURN QUERY
        SELECT DISTINCT cs.student_id, p_kind, v_announcement.title, v_announcement.content,
          jsonb_build_object('route', '/notifications', 'announcement_id', v_announcement.id)
        FROM public.class_students cs
        JOIN public.classes c ON c.id = cs.class_id AND c.teacher_id = auth.uid()
        WHERE EXISTS (
          SELECT 1
          FROM public.school_memberships actor
          JOIN public.school_memberships student
            ON student.school_id = actor.school_id
           AND student.user_id = cs.student_id
           AND student.school_role = 'student'
           AND student.status IN ('active', 'suspended')
          WHERE actor.user_id = auth.uid()
            AND actor.school_role = 'teacher'
            AND actor.status = 'active'
        );
      ELSE
        RAISE EXCEPTION 'Teacher notification target is not supported';
      END IF;
    ELSE
      IF NOT (
        private.has_role_for_user(auth.uid(), 'admin'::public.app_role)
        OR private.has_role_for_user(auth.uid(), 'manager'::public.app_role)
        OR public._is_extreme_admin()
      ) THEN
        RAISE EXCEPTION 'Administrative announcement authorization required';
      END IF;
      IF v_announcement.target_type NOT IN ('all', 'students', 'teachers') THEN
        RAISE EXCEPTION 'Administrative notification target is not supported';
      END IF;
      RETURN QUERY
      SELECT DISTINCT ur.user_id, p_kind, v_announcement.title, v_announcement.content,
        jsonb_build_object('route', '/notifications', 'announcement_id', v_announcement.id)
      FROM public.user_roles ur
      WHERE ur.user_id <> auth.uid()
        AND ur.role = CASE
          WHEN v_announcement.target_type = 'students' THEN 'student'::public.app_role
          WHEN v_announcement.target_type = 'teachers' THEN 'teacher'::public.app_role
          ELSE ur.role
        END
        AND ur.role IN ('student'::public.app_role, 'teacher'::public.app_role);
    END IF;
    RETURN;
  END IF;

  IF p_kind = 'quiz_assignment' THEN
    IF NOT private.has_role_for_user(auth.uid(), 'teacher'::public.app_role) THEN
      RAISE EXCEPTION 'Teacher assignment authorization required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.school_memberships actor
      WHERE actor.user_id = auth.uid()
        AND actor.school_role = 'teacher'
        AND actor.status = 'active'
    ) THEN
      RAISE EXCEPTION 'An active teacher school membership is required';
    END IF;
    SELECT * INTO v_assignment
    FROM public.quiz_assignments
    WHERE id = p_source_id AND assigned_by = auth.uid();
    IF v_assignment.id IS NULL OR v_assignment.class_id IS NULL THEN
      RAISE EXCEPTION 'Quiz assignment not found or not owned by caller';
    END IF;
    SELECT * INTO v_quiz FROM public.quizzes WHERE id = v_assignment.quiz_id;
    IF v_quiz.id IS NULL THEN
      RAISE EXCEPTION 'Quiz not found';
    END IF;
    RETURN QUERY
    SELECT DISTINCT cs.student_id, p_kind,
      'New assignment: ' || v_quiz.title,
      'Your teacher assigned ' || v_quiz.title || '. Open Master Minds to get started.',
      jsonb_build_object('route', '/notifications', 'quiz_id', v_assignment.quiz_id, 'class_id', v_assignment.class_id)
    FROM public.class_students cs
    WHERE cs.class_id = v_assignment.class_id
      AND EXISTS (
        SELECT 1
        FROM public.school_memberships actor
        JOIN public.school_memberships student
          ON student.school_id = actor.school_id
         AND student.user_id = cs.student_id
         AND student.school_role = 'student'
         AND student.status IN ('active', 'suspended')
        WHERE actor.user_id = auth.uid()
          AND actor.school_role = 'teacher'
          AND actor.status = 'active'
      );
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unsupported staff notification kind';
END;
$function$;

REVOKE ALL ON FUNCTION public.authorize_staff_push_notification(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_staff_push_notification(uuid, text) TO authenticated;
