CREATE TABLE IF NOT EXISTS public.school_staff_conduct_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  target_teacher_membership_id uuid NOT NULL,
  submitted_by_membership_id uuid NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('misconduct', 'academic_irregularity', 'quality_concern', 'professional_conduct', 'other')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 5 AND 5000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by_membership_id uuid,
  reviewed_at timestamptz,
  manager_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (target_teacher_membership_id, school_id) REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (submitted_by_membership_id, school_id) REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by_membership_id, school_id) REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.school_teacher_assignment_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  teacher_membership_id uuid NOT NULL,
  submitted_by_membership_id uuid NOT NULL,
  current_assignment_id uuid,
  recommendation_type text NOT NULL CHECK (recommendation_type IN ('add_assignment', 'remove_assignment', 'change_assignment')),
  requested_section_id uuid,
  requested_subject_name text,
  requested_assignment_kind text CHECK (requested_assignment_kind IN ('subject', 'homeroom')),
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 5 AND 3000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  reviewed_by_membership_id uuid,
  reviewed_at timestamptz,
  manager_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (teacher_membership_id, school_id) REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (submitted_by_membership_id, school_id) REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (requested_section_id, school_id) REFERENCES public.school_sections(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by_membership_id, school_id) REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS school_staff_conduct_reports_status_idx
  ON public.school_staff_conduct_reports(school_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS school_teacher_assignment_recommendations_status_idx
  ON public.school_teacher_assignment_recommendations(school_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.school_submit_staff_conduct_report(
  p_teacher_membership_id uuid, p_report_type text, p_severity text, p_description text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_teacher public.school_memberships%ROWTYPE;
  v_actor uuid;
  v_report_id uuid;
BEGIN
  SELECT * INTO v_teacher FROM public.school_memberships
  WHERE id = p_teacher_membership_id AND school_role = 'teacher' AND status = 'active';
  IF v_teacher.id IS NULL OR NOT public.school_is_admin(v_teacher.school_id) THEN
    RAISE EXCEPTION 'Only the School Admin can report a teacher conduct concern';
  END IF;
  IF p_report_type NOT IN ('misconduct', 'academic_irregularity', 'quality_concern', 'professional_conduct', 'other')
     OR p_severity NOT IN ('low', 'medium', 'high')
     OR nullif(trim(p_description), '') IS NULL THEN
    RAISE EXCEPTION 'A valid report type, severity, and description are required';
  END IF;
  v_actor := public.school_my_membership_id(v_teacher.school_id);
  INSERT INTO public.school_staff_conduct_reports(
    school_id, target_teacher_membership_id, submitted_by_membership_id,
    report_type, severity, description
  ) VALUES (
    v_teacher.school_id, v_teacher.id, v_actor, p_report_type, p_severity, trim(p_description)
  ) RETURNING id INTO v_report_id;
  RETURN v_report_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_review_staff_conduct_report(
  p_report_id uuid, p_status text, p_note text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_report public.school_staff_conduct_reports%ROWTYPE;
  v_actor uuid;
BEGIN
  SELECT * INTO v_report FROM public.school_staff_conduct_reports WHERE id = p_report_id FOR UPDATE;
  IF v_report.id IS NULL OR NOT public.school_is_manager(v_report.school_id) THEN
    RAISE EXCEPTION 'Only the School Manager can review staff conduct reports';
  END IF;
  IF p_status NOT IN ('reviewed', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid staff conduct report decision';
  END IF;
  v_actor := public.school_my_membership_id(v_report.school_id);
  UPDATE public.school_staff_conduct_reports
  SET status = p_status, reviewed_by_membership_id = v_actor,
      reviewed_at = now(), manager_note = nullif(trim(p_note), '')
  WHERE id = p_report_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_submit_teacher_assignment_recommendation(
  p_teacher_membership_id uuid,
  p_recommendation_type text,
  p_current_assignment_id uuid DEFAULT NULL,
  p_requested_section_id uuid DEFAULT NULL,
  p_requested_subject_name text DEFAULT NULL,
  p_requested_assignment_kind text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_teacher public.school_memberships%ROWTYPE;
  v_actor uuid;
  v_recommendation_id uuid;
BEGIN
  SELECT * INTO v_teacher FROM public.school_memberships
  WHERE id = p_teacher_membership_id AND school_role = 'teacher' AND status = 'active';
  IF v_teacher.id IS NULL OR NOT public.school_is_admin(v_teacher.school_id) THEN
    RAISE EXCEPTION 'Only the School Admin can recommend teacher assignment changes';
  END IF;
  IF p_recommendation_type NOT IN ('add_assignment', 'remove_assignment', 'change_assignment')
     OR nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A valid recommendation type and reason are required';
  END IF;
  IF p_recommendation_type IN ('remove_assignment', 'change_assignment') AND p_current_assignment_id IS NULL THEN
    RAISE EXCEPTION 'Current assignment is required for a remove or change recommendation';
  END IF;
  IF p_recommendation_type IN ('add_assignment', 'change_assignment')
     AND (p_requested_section_id IS NULL OR nullif(trim(p_requested_subject_name), '') IS NULL
          OR p_requested_assignment_kind NOT IN ('subject', 'homeroom')) THEN
    RAISE EXCEPTION 'New section, subject, and assignment type are required';
  END IF;
  IF p_current_assignment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.school_teacher_assignments
    WHERE id = p_current_assignment_id AND school_id = v_teacher.school_id
      AND teacher_membership_id = v_teacher.id
  ) THEN
    RAISE EXCEPTION 'Current assignment does not belong to this teacher';
  END IF;
  v_actor := public.school_my_membership_id(v_teacher.school_id);
  INSERT INTO public.school_teacher_assignment_recommendations(
    school_id, teacher_membership_id, submitted_by_membership_id, current_assignment_id,
    recommendation_type, requested_section_id, requested_subject_name,
    requested_assignment_kind, reason
  ) VALUES (
    v_teacher.school_id, v_teacher.id, v_actor, p_current_assignment_id,
    p_recommendation_type, p_requested_section_id, nullif(trim(p_requested_subject_name), ''),
    p_requested_assignment_kind, trim(p_reason)
  ) RETURNING id INTO v_recommendation_id;
  RETURN v_recommendation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_review_teacher_assignment_recommendation(
  p_recommendation_id uuid, p_accept boolean, p_note text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recommendation public.school_teacher_assignment_recommendations%ROWTYPE;
  v_actor uuid;
BEGIN
  SELECT * INTO v_recommendation FROM public.school_teacher_assignment_recommendations
  WHERE id = p_recommendation_id FOR UPDATE;
  IF v_recommendation.id IS NULL OR NOT public.school_is_manager(v_recommendation.school_id) THEN
    RAISE EXCEPTION 'Only the School Manager can review assignment recommendations';
  END IF;
  IF v_recommendation.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending assignment recommendations can be reviewed';
  END IF;
  v_actor := public.school_my_membership_id(v_recommendation.school_id);
  UPDATE public.school_teacher_assignment_recommendations
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      reviewed_by_membership_id = v_actor, reviewed_at = now(),
      manager_note = nullif(trim(p_note), '')
  WHERE id = p_recommendation_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_staff_conduct_report(p_report_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_staff_conduct_reports report
    WHERE report.id = p_report_id
      AND (
        public._is_extreme_admin()
        OR public.school_is_manager(report.school_id)
        OR report.submitted_by_membership_id = public.school_my_membership_id(report.school_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_assignment_recommendation(p_recommendation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_teacher_assignment_recommendations recommendation
    WHERE recommendation.id = p_recommendation_id
      AND (
        public._is_extreme_admin()
        OR public.school_is_manager(recommendation.school_id)
        OR recommendation.submitted_by_membership_id = public.school_my_membership_id(recommendation.school_id)
      )
  );
$$;

ALTER TABLE public.school_staff_conduct_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_teacher_assignment_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_staff_conduct_reports_read ON public.school_staff_conduct_reports
FOR SELECT TO authenticated USING (public.school_can_view_staff_conduct_report(id));
CREATE POLICY school_staff_conduct_reports_insert ON public.school_staff_conduct_reports
FOR INSERT TO authenticated WITH CHECK (public.school_is_admin(school_id) AND submitted_by_membership_id = public.school_my_membership_id(school_id));

CREATE POLICY school_assignment_recommendations_read ON public.school_teacher_assignment_recommendations
FOR SELECT TO authenticated USING (public.school_can_view_assignment_recommendation(id));
CREATE POLICY school_assignment_recommendations_insert ON public.school_teacher_assignment_recommendations
FOR INSERT TO authenticated WITH CHECK (public.school_is_admin(school_id) AND submitted_by_membership_id = public.school_my_membership_id(school_id));

GRANT SELECT, INSERT ON public.school_staff_conduct_reports TO authenticated;
GRANT SELECT, INSERT ON public.school_teacher_assignment_recommendations TO authenticated;

REVOKE ALL ON FUNCTION public.school_submit_staff_conduct_report(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_review_staff_conduct_report(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_submit_teacher_assignment_recommendation(uuid, text, uuid, uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_review_teacher_assignment_recommendation(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_staff_conduct_report(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_assignment_recommendation(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.school_submit_staff_conduct_report(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_review_staff_conduct_report(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_submit_teacher_assignment_recommendation(uuid, text, uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_review_teacher_assignment_recommendation(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_staff_conduct_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_assignment_recommendation(uuid) TO authenticated;
