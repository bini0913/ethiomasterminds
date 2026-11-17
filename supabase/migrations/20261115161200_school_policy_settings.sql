CREATE TABLE IF NOT EXISTS public.school_policy_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE RESTRICT,
  attendance_notifications_enabled boolean NOT NULL DEFAULT true,
  behavior_notifications_enabled boolean NOT NULL DEFAULT true,
  report_card_notifications_enabled boolean NOT NULL DEFAULT true,
  absence_review_threshold integer NOT NULL DEFAULT 5 CHECK (absence_review_threshold BETWEEN 1 AND 60),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.school_seed_policy_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.school_policy_settings(school_id)
  VALUES (NEW.id)
  ON CONFLICT (school_id) DO NOTHING;
  RETURN NEW;
END;
$$;

INSERT INTO public.school_policy_settings(school_id)
SELECT id FROM public.schools
ON CONFLICT (school_id) DO NOTHING;

DROP TRIGGER IF EXISTS school_seed_policy_settings_after_insert ON public.schools;
CREATE TRIGGER school_seed_policy_settings_after_insert
AFTER INSERT ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.school_seed_policy_settings();

ALTER TABLE public.school_policy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_policy_settings_read ON public.school_policy_settings
FOR SELECT TO authenticated
USING (public.is_school_manager_or_admin(school_id) OR public.school_is_finance(school_id));

CREATE POLICY school_policy_settings_manager_update ON public.school_policy_settings
FOR UPDATE TO authenticated
USING (public.school_is_manager(school_id))
WITH CHECK (public.school_is_manager(school_id));

GRANT SELECT, UPDATE ON public.school_policy_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.school_notify_parents_attendance_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT attendance_notifications_enabled INTO v_enabled
  FROM public.school_policy_settings WHERE school_id = NEW.school_id;
  IF COALESCE(v_enabled, true)
     AND NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.school_parent_notifications(
      school_id, parent_membership_id, student_membership_id, notification_type, title, message
    )
    SELECT link.school_id, link.parent_membership_id, record.student_membership_id,
           'attendance', 'Daily attendance updated',
           'Attendance for ' || to_char(NEW.attendance_date, 'DD Mon YYYY') ||
           ' was recorded as ' || record.attendance_status || '.'
    FROM public.school_attendance_records record
    JOIN public.school_parent_student_links link
      ON link.student_membership_id = record.student_membership_id
     AND link.status = 'active'
    WHERE record.session_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_notify_parent_behavior_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT behavior_notifications_enabled INTO v_enabled
  FROM public.school_policy_settings WHERE school_id = NEW.school_id;
  IF COALESCE(v_enabled, true)
     AND NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.school_parent_notifications(
      school_id, parent_membership_id, student_membership_id, notification_type, title, message
    )
    SELECT link.school_id, link.parent_membership_id, NEW.student_membership_id,
           'behavior', 'Behavior report available',
           'A behavior report has been reviewed and approved by the school.'
    FROM public.school_parent_student_links link
    WHERE link.student_membership_id = NEW.student_membership_id AND link.status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_notify_parent_results_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enabled boolean;
BEGIN
  SELECT report_card_notifications_enabled INTO v_enabled
  FROM public.school_policy_settings WHERE school_id = NEW.school_id;
  IF COALESCE(v_enabled, true)
     AND NEW.status = 'published' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.school_parent_notifications(
      school_id, parent_membership_id, student_membership_id, notification_type, title, message
    )
    SELECT link.school_id, link.parent_membership_id, NEW.student_membership_id,
           'academic', 'Academic results published',
           'Official results for ' || NEW.subject_name || ' are now available.'
    FROM public.school_parent_student_links link
    WHERE link.student_membership_id = NEW.student_membership_id
      AND link.status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.school_seed_policy_settings() FROM PUBLIC, anon, authenticated;
