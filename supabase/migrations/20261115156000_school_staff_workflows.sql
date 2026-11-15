-- Staff tasks, evaluations, disciplinary recommendations, and role/responsibility requests.

CREATE TABLE IF NOT EXISTS public.school_staff_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  assigned_to_membership_id uuid NOT NULL,
  assigned_by_membership_id uuid NOT NULL,
  task_type text NOT NULL CHECK (task_type IN ('oversight', 'academic', 'finance', 'follow_up')),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 180),
  description text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'submitted', 'verified', 'returned', 'cancelled')),
  due_date date,
  response text,
  submitted_at timestamptz,
  verified_by_membership_id uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assigned_to_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (verified_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  UNIQUE (id, school_id)
);

CREATE TABLE IF NOT EXISTS public.school_staff_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  task_id uuid NOT NULL,
  author_membership_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (task_id, school_id)
    REFERENCES public.school_staff_tasks(id, school_id) ON DELETE CASCADE,
  FOREIGN KEY (author_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.school_staff_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  target_membership_id uuid NOT NULL,
  reviewer_membership_id uuid NOT NULL,
  evaluation_type text NOT NULL CHECK (evaluation_type IN ('staff_performance', 'academic_work')),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  period_start date,
  period_end date,
  notes text NOT NULL CHECK (char_length(trim(notes)) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (target_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewer_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS public.school_disciplinary_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  target_membership_id uuid NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('student', 'staff')),
  submitted_by_membership_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 3 AND 5000),
  recommendation text NOT NULL CHECK (char_length(trim(recommendation)) BETWEEN 3 AND 3000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'resolved')),
  reviewed_by_membership_id uuid,
  reviewed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (target_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (submitted_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.school_staff_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  target_membership_id uuid NOT NULL,
  requester_membership_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('role_change', 'assignment_change', 'responsibility_change')),
  requested_role text CHECK (requested_role IN ('manager', 'admin', 'teacher', 'finance', 'parent', 'student')),
  requested_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 3 AND 3000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (target_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (requester_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS school_staff_tasks_assignee_idx
  ON public.school_staff_tasks(assigned_to_membership_id, status, due_date);
CREATE INDEX IF NOT EXISTS school_staff_tasks_school_idx
  ON public.school_staff_tasks(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS school_staff_evaluations_target_idx
  ON public.school_staff_evaluations(target_membership_id, created_at DESC);
CREATE INDEX IF NOT EXISTS school_disciplinary_recommendations_target_idx
  ON public.school_disciplinary_recommendations(target_membership_id, status);
CREATE INDEX IF NOT EXISTS school_staff_change_requests_school_idx
  ON public.school_staff_change_requests(school_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.school_can_view_staff_task(p_task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_staff_tasks task
    WHERE task.id = p_task_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(task.school_id)
        OR task.assigned_to_membership_id = public.school_my_membership_id(task.school_id)
        OR task.assigned_by_membership_id = public.school_my_membership_id(task.school_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_validate_staff_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid;
  v_actor_role text;
  v_target_role text;
  v_verified_by uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_actor := public.school_my_membership_id(NEW.school_id);
    SELECT school_role INTO v_actor_role FROM public.school_memberships WHERE id = v_actor;
    SELECT school_role INTO v_target_role FROM public.school_memberships
    WHERE id = NEW.assigned_to_membership_id AND school_id = NEW.school_id AND status = 'active';

    IF v_actor IS NULL OR NEW.assigned_by_membership_id <> v_actor OR v_target_role IS NULL THEN
      RAISE EXCEPTION 'Task creator and assignee must be active school members';
    END IF;
    IF v_actor_role = 'manager' THEN
      IF v_target_role NOT IN ('admin', 'teacher', 'finance') THEN
        RAISE EXCEPTION 'Manager tasks may be assigned to Admin, Teacher, or Finance staff';
      END IF;
    ELSIF v_actor_role = 'admin' THEN
      IF v_target_role <> 'teacher' OR NEW.task_type <> 'academic' THEN
        RAISE EXCEPTION 'School Admin can assign academic tasks to teachers only';
      END IF;
    ELSE
      RAISE EXCEPTION 'Only the School Manager or Admin can assign staff tasks';
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(NEW.school_id, NEW.assigned_to_membership_id, NEW.assigned_by_membership_id,
         NEW.task_type, NEW.title, NEW.description, NEW.priority, NEW.due_date, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.school_id, OLD.assigned_to_membership_id, OLD.assigned_by_membership_id,
         OLD.task_type, OLD.title, OLD.description, OLD.priority, OLD.due_date, OLD.created_at) THEN
    RAISE EXCEPTION 'Task assignment details are immutable after creation';
  END IF;

  v_actor := public.school_my_membership_id(OLD.school_id);
  SELECT school_role INTO v_actor_role FROM public.school_memberships WHERE id = v_actor;

  IF v_actor = OLD.assigned_to_membership_id THEN
    IF NEW.status NOT IN ('in_progress', 'submitted')
       OR OLD.status NOT IN ('open', 'in_progress', 'returned')
       OR NEW.verified_by_membership_id IS DISTINCT FROM OLD.verified_by_membership_id
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
      RAISE EXCEPTION 'Assigned staff can only start or submit their task';
    END IF;
    IF NEW.status = 'submitted' THEN NEW.submitted_at := now(); END IF;
  ELSIF v_actor = OLD.assigned_by_membership_id
        AND v_actor_role IN ('manager', 'admin') THEN
    IF NEW.status NOT IN ('verified', 'returned', 'cancelled')
       OR OLD.status NOT IN ('submitted', 'open', 'in_progress', 'returned') THEN
      RAISE EXCEPTION 'Task assigner can verify, return, or cancel the task';
    END IF;
    IF NEW.status = 'verified' THEN
      NEW.verified_by_membership_id := v_actor;
      NEW.verified_at := now();
    END IF;
  ELSE
    RAISE EXCEPTION 'Only the assigned staff member or task assigner can update this task';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_staff_evaluation(p_evaluation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_staff_evaluations evaluation
    JOIN public.school_memberships target ON target.id = evaluation.target_membership_id
    WHERE evaluation.id = p_evaluation_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(evaluation.school_id)
        OR (target.user_id = auth.uid() AND target.status IN ('active', 'suspended'))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_validate_staff_evaluation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reviewer public.school_memberships%ROWTYPE;
  v_target public.school_memberships%ROWTYPE;
BEGIN
  SELECT * INTO v_reviewer FROM public.school_memberships
  WHERE id = NEW.reviewer_membership_id AND school_id = NEW.school_id AND status = 'active';
  SELECT * INTO v_target FROM public.school_memberships
  WHERE id = NEW.target_membership_id AND school_id = NEW.school_id;
  IF v_reviewer.id IS NULL OR v_reviewer.user_id <> auth.uid() OR v_target.id IS NULL THEN
    RAISE EXCEPTION 'Evaluation reviewer and target must belong to this school';
  END IF;
  IF v_reviewer.school_role = 'manager' THEN
    IF v_target.school_role NOT IN ('admin', 'teacher', 'finance') OR NEW.evaluation_type <> 'staff_performance' THEN
      RAISE EXCEPTION 'Manager evaluations are staff performance evaluations';
    END IF;
  ELSIF v_reviewer.school_role = 'admin' THEN
    IF v_target.school_role <> 'teacher' OR NEW.evaluation_type <> 'academic_work' THEN
      RAISE EXCEPTION 'School Admin can evaluate teachers academic work only';
    END IF;
  ELSE
    RAISE EXCEPTION 'Only the School Manager or Admin can evaluate staff';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_disciplinary_recommendation(p_recommendation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_disciplinary_recommendations recommendation
    JOIN public.school_memberships target ON target.id = recommendation.target_membership_id
    WHERE recommendation.id = p_recommendation_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(recommendation.school_id)
        OR (target.user_id = auth.uid() AND target.status IN ('active', 'suspended'))
        OR recommendation.submitted_by_membership_id = public.school_my_membership_id(recommendation.school_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_validate_disciplinary_recommendation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $
DECLARE
  v_actor uuid;
  v_actor_role text;
  v_target_role text;
  v_review text := coalesce(current_setting('app.school_discipline_review', true), '');
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF v_review <> 'true'
       OR OLD.status <> 'pending'
       OR NEW.status NOT IN ('accepted', 'rejected')
       OR ROW(NEW.school_id, NEW.target_membership_id, NEW.target_kind, NEW.submitted_by_membership_id,
              NEW.reason, NEW.recommendation, NEW.created_at)
          IS DISTINCT FROM
          ROW(OLD.school_id, OLD.target_membership_id, OLD.target_kind, OLD.submitted_by_membership_id,
              OLD.reason, OLD.recommendation, OLD.created_at) THEN
      RAISE EXCEPTION 'Disciplinary review must use the guarded workflow';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_actor := public.school_my_membership_id(NEW.school_id);
    SELECT school_role INTO v_actor_role FROM public.school_memberships WHERE id = v_actor;
    SELECT school_role INTO v_target_role FROM public.school_memberships
    WHERE id = NEW.target_membership_id AND school_id = NEW.school_id;
    IF v_actor IS NULL OR NEW.submitted_by_membership_id <> v_actor THEN
      RAISE EXCEPTION 'Recommendation submitter must be the current school member';
    END IF;
    IF v_actor_role = 'admin' AND v_target_role = 'student' AND NEW.target_kind = 'student' THEN
      RETURN NEW;
    ELSIF v_actor_role = 'manager' AND v_target_role IN ('admin', 'teacher', 'finance') AND NEW.target_kind = 'staff' THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Only Admins can recommend student discipline and Managers can recommend staff discipline';
    END IF;
  END IF;
  RAISE EXCEPTION 'Disciplinary recommendations must be reviewed through the guarded function';
END;
$$;

CREATE OR REPLACE FUNCTION public.school_review_disciplinary_recommendation(
  p_recommendation_id uuid, p_accept boolean, p_note text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_recommendation public.school_disciplinary_recommendations%ROWTYPE;
  v_actor_membership uuid;
  v_actor_role text;
BEGIN
  SELECT * INTO v_recommendation
  FROM public.school_disciplinary_recommendations
  WHERE id = p_recommendation_id FOR UPDATE;
  IF v_recommendation.id IS NULL OR v_recommendation.status <> 'pending' THEN
    RAISE EXCEPTION 'Pending disciplinary recommendation not found';
  END IF;

  v_actor_membership := public.school_my_membership_id(v_recommendation.school_id);
  SELECT school_role INTO v_actor_role FROM public.school_memberships WHERE id = v_actor_membership;

  IF v_recommendation.target_kind = 'student' THEN
    IF v_actor_role <> 'manager' AND NOT public._is_extreme_admin() THEN
      RAISE EXCEPTION 'Only the School Manager can review student disciplinary recommendations';
    END IF;
  ELSIF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Only the Super Admin can review staff disciplinary recommendations';
  END IF;

  PERFORM set_config('app.school_discipline_review', 'true', true);
  UPDATE public.school_disciplinary_recommendations
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
      reviewed_by_membership_id = v_actor_membership,
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now(),
      decision_note = nullif(trim(p_note), '')
  WHERE id = p_recommendation_id;
  PERFORM set_config('app.school_discipline_review', '', true);

  IF p_accept AND v_recommendation.target_kind = 'student' THEN
    INSERT INTO public.school_parent_notifications(
      school_id, parent_membership_id, student_membership_id,
      notification_type, title, message
    )
    SELECT link.school_id, link.parent_membership_id, v_recommendation.target_membership_id,
           'behavior', 'School disciplinary recommendation reviewed',
           'The school has reviewed a disciplinary recommendation concerning your child. Please contact the School Admin for details.'
    FROM public.school_parent_student_links link
    WHERE link.student_membership_id = v_recommendation.target_membership_id
      AND link.status = 'active';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_staff_change_request(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_staff_change_requests request
    JOIN public.school_memberships target ON target.id = request.target_membership_id
    WHERE request.id = p_request_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(request.school_id)
        OR request.requester_membership_id = public.school_my_membership_id(request.school_id)
        OR target.user_id = auth.uid()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_validate_staff_change_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $
DECLARE
  v_requester uuid;
  v_role text;
  v_target public.school_memberships%ROWTYPE;
  v_review text := coalesce(current_setting('app.school_staff_change_review', true), '');
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF v_review <> 'true'
       OR OLD.status <> 'pending'
       OR NEW.status NOT IN ('approved', 'rejected')
       OR ROW(NEW.school_id, NEW.target_membership_id, NEW.requester_membership_id, NEW.request_type,
              NEW.requested_role, NEW.requested_details, NEW.reason, NEW.created_at)
          IS DISTINCT FROM
          ROW(OLD.school_id, OLD.target_membership_id, OLD.requester_membership_id, OLD.request_type,
              OLD.requested_role, OLD.requested_details, OLD.reason, OLD.created_at) THEN
      RAISE EXCEPTION 'Staff change request review must use the guarded workflow';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_requester := public.school_my_membership_id(NEW.school_id);
    SELECT school_role INTO v_role FROM public.school_memberships WHERE id = v_requester;
    SELECT * INTO v_target FROM public.school_memberships
    WHERE id = NEW.target_membership_id AND school_id = NEW.school_id;
    IF v_role <> 'manager' OR v_requester <> NEW.requester_membership_id OR v_target.id IS NULL
       OR v_target.school_role = 'manager' THEN
      RAISE EXCEPTION 'Only the School Manager can request changes for school staff';
    END IF;
    IF NEW.request_type = 'role_change' AND NEW.requested_role IS NULL THEN
      RAISE EXCEPTION 'Requested role is required for a role change request';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Staff change requests must be reviewed through the guarded function';
END;
$$;

CREATE OR REPLACE FUNCTION public.school_review_staff_change_request(
  p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_request public.school_staff_change_requests%ROWTYPE;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Only the Super Admin can review staff responsibility and role requests';
  END IF;
  SELECT * INTO v_request FROM public.school_staff_change_requests
  WHERE id = p_request_id FOR UPDATE;
  IF v_request.id IS NULL OR v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Pending staff change request not found';
  END IF;
  PERFORM set_config('app.school_staff_change_review', 'true', true);
  UPDATE public.school_staff_change_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by_user_id = auth.uid(),
      reviewed_at = now(),
      review_note = nullif(trim(p_note), '')
  WHERE id = p_request_id;
  PERFORM set_config('app.school_staff_change_review', '', true);
  RETURN true;
END;
$;

ALTER TABLE public.school_staff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_staff_task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_staff_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_disciplinary_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_staff_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_staff_tasks_read ON public.school_staff_tasks
FOR SELECT TO authenticated USING (public.school_can_view_staff_task(id));
CREATE POLICY school_staff_tasks_insert ON public.school_staff_tasks
FOR INSERT TO authenticated
WITH CHECK (assigned_by_membership_id = public.school_my_membership_id(school_id));
CREATE POLICY school_staff_tasks_update ON public.school_staff_tasks
FOR UPDATE TO authenticated
USING (
  assigned_to_membership_id = public.school_my_membership_id(school_id)
  OR assigned_by_membership_id = public.school_my_membership_id(school_id)
)
WITH CHECK (
  assigned_to_membership_id = public.school_my_membership_id(school_id)
  OR assigned_by_membership_id = public.school_my_membership_id(school_id)
);

CREATE POLICY school_staff_task_comments_read ON public.school_staff_task_comments
FOR SELECT TO authenticated USING (public.school_can_view_staff_task(task_id));
CREATE POLICY school_staff_task_comments_insert ON public.school_staff_task_comments
FOR INSERT TO authenticated
WITH CHECK (
  author_membership_id = public.school_my_membership_id(school_id)
  AND public.school_can_view_staff_task(task_id)
);

CREATE POLICY school_staff_evaluations_read ON public.school_staff_evaluations
FOR SELECT TO authenticated USING (public.school_can_view_staff_evaluation(id));
CREATE POLICY school_staff_evaluations_insert ON public.school_staff_evaluations
FOR INSERT TO authenticated
WITH CHECK (reviewer_membership_id = public.school_my_membership_id(school_id));

CREATE POLICY school_disciplinary_recommendations_read ON public.school_disciplinary_recommendations
FOR SELECT TO authenticated USING (public.school_can_view_disciplinary_recommendation(id));
CREATE POLICY school_disciplinary_recommendations_insert ON public.school_disciplinary_recommendations
FOR INSERT TO authenticated
WITH CHECK (submitted_by_membership_id = public.school_my_membership_id(school_id));

CREATE POLICY school_staff_change_requests_read ON public.school_staff_change_requests
FOR SELECT TO authenticated USING (public.school_can_view_staff_change_request(id));
CREATE POLICY school_staff_change_requests_insert ON public.school_staff_change_requests
FOR INSERT TO authenticated
WITH CHECK (requester_membership_id = public.school_my_membership_id(school_id));

GRANT SELECT, INSERT, UPDATE ON public.school_staff_tasks TO authenticated;
GRANT SELECT, INSERT ON public.school_staff_task_comments TO authenticated;
GRANT SELECT, INSERT ON public.school_staff_evaluations TO authenticated;
GRANT SELECT, INSERT ON public.school_disciplinary_recommendations TO authenticated;
GRANT SELECT, INSERT ON public.school_staff_change_requests TO authenticated;

DROP TRIGGER IF EXISTS school_staff_task_validate ON public.school_staff_tasks;
CREATE TRIGGER school_staff_task_validate
BEFORE INSERT OR UPDATE ON public.school_staff_tasks
FOR EACH ROW EXECUTE FUNCTION public.school_validate_staff_task();

DROP TRIGGER IF EXISTS school_staff_evaluation_validate ON public.school_staff_evaluations;
CREATE TRIGGER school_staff_evaluation_validate
BEFORE INSERT ON public.school_staff_evaluations
FOR EACH ROW EXECUTE FUNCTION public.school_validate_staff_evaluation();

DROP TRIGGER IF EXISTS school_disciplinary_validate ON public.school_disciplinary_recommendations;
CREATE TRIGGER school_disciplinary_validate
BEFORE INSERT OR UPDATE ON public.school_disciplinary_recommendations
FOR EACH ROW EXECUTE FUNCTION public.school_validate_disciplinary_recommendation();

DROP TRIGGER IF EXISTS school_staff_change_request_validate ON public.school_staff_change_requests;
CREATE TRIGGER school_staff_change_request_validate
BEFORE INSERT OR UPDATE ON public.school_staff_change_requests
FOR EACH ROW EXECUTE FUNCTION public.school_validate_staff_change_request();

REVOKE ALL ON FUNCTION public.school_can_view_staff_task(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_validate_staff_task() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_can_view_staff_evaluation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_validate_staff_evaluation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_can_view_disciplinary_recommendation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_validate_disciplinary_recommendation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_review_disciplinary_recommendation(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_staff_change_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_validate_staff_change_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_review_staff_change_request(uuid, boolean, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.school_can_view_staff_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_staff_evaluation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_disciplinary_recommendation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_review_disciplinary_recommendation(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_staff_change_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_review_staff_change_request(uuid, boolean, text) TO authenticated;
