-- Complete the Super Admin school-network operations surface without granting
-- platform-wide Extreme Admin privileges or exposing individual-only accounts.

CREATE OR REPLACE FUNCTION public.super_admin_list_network_people(
  p_school_id uuid DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  name text,
  username text,
  school_id uuid,
  school_name text,
  school_code text,
  school_role text,
  membership_status text,
  account_status text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT p.id, p.name, p.username, sm.school_id, s.name, s.school_code,
         sm.school_role, sm.status, coalesce(p.account_status, 'active'), sm.created_at
  FROM public.school_memberships sm
  JOIN public.schools s ON s.id = sm.school_id
  JOIN public.profiles p ON p.id = sm.user_id
  WHERE public._is_super_admin()
    AND s.network_id = public.school_network_id()
    AND (p_school_id IS NULL OR sm.school_id = p_school_id)
    AND (p_role IS NULL OR sm.school_role = p_role)
    AND (nullif(trim(p_search), '') IS NULL
      OR p.name ILIKE '%' || trim(p_search) || '%'
      OR coalesce(p.username, '') ILIKE '%' || trim(p_search) || '%'
      OR s.name ILIKE '%' || trim(p_search) || '%'
      OR s.school_code ILIKE '%' || upper(trim(p_search)) || '%')
  ORDER BY sm.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 50), 100))
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.super_admin_get_school_analytics(p_school_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public._is_super_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id AND network_id = public.school_network_id()) THEN
    RAISE EXCEPTION 'School is outside the current network';
  END IF;
  SELECT jsonb_build_object(
    'school_id', p_school_id,
    'students', (SELECT count(*) FROM public.school_memberships WHERE school_id = p_school_id AND school_role = 'student' AND status IN ('active','suspended')),
    'teachers', (SELECT count(*) FROM public.school_memberships WHERE school_id = p_school_id AND school_role = 'teacher' AND status = 'active'),
    'parents', (SELECT count(*) FROM public.school_memberships WHERE school_id = p_school_id AND school_role = 'parent' AND status = 'active'),
    'finance_staff', (SELECT count(*) FROM public.school_memberships WHERE school_id = p_school_id AND school_role = 'finance' AND status = 'active'),
    'admins', (SELECT count(*) FROM public.school_memberships WHERE school_id = p_school_id AND school_role = 'admin' AND status = 'active'),
    'managers', (SELECT count(*) FROM public.school_memberships WHERE school_id = p_school_id AND school_role = 'manager' AND status = 'active'),
    'average_score', (SELECT round(avg(average_score), 2) FROM public.school_term_results WHERE school_id = p_school_id AND status IN ('calculated','published')),
    'published_results', (SELECT count(*) FROM public.school_term_results WHERE school_id = p_school_id AND status = 'published'),
    'attendance_records', (SELECT count(*) FROM public.school_attendance_records WHERE school_id = p_school_id),
    'attendance_rate', (SELECT round(100.0 * count(*) FILTER (WHERE attendance_status IN ('present','late')) / nullif(count(*), 0), 2) FROM public.school_attendance_records WHERE school_id = p_school_id),
    'pending_behavior_reports', (SELECT count(*) FROM public.school_behavior_reports WHERE school_id = p_school_id AND status = 'pending'),
    'outstanding_balance', (SELECT coalesce(sum(balance), 0) FROM public.school_student_invoices WHERE school_id = p_school_id AND balance > 0),
    'invoice_count', (SELECT count(*) FROM public.school_student_invoices WHERE school_id = p_school_id),
    'payment_count', (SELECT count(*) FROM public.school_fee_payments WHERE school_id = p_school_id AND status = 'confirmed')
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_get_network_finance()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public._is_super_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  SELECT jsonb_build_object(
    'invoice_count', (SELECT count(*) FROM public.school_student_invoices i JOIN public.schools s ON s.id = i.school_id WHERE s.network_id = public.school_network_id()),
    'invoiced_amount', (SELECT coalesce(sum(i.amount), 0) FROM public.school_student_invoices i JOIN public.schools s ON s.id = i.school_id WHERE s.network_id = public.school_network_id()),
    'paid_amount', (SELECT coalesce(sum(i.paid_amount), 0) FROM public.school_student_invoices i JOIN public.schools s ON s.id = i.school_id WHERE s.network_id = public.school_network_id()),
    'outstanding_balance', (SELECT coalesce(sum(i.balance), 0) FROM public.school_student_invoices i JOIN public.schools s ON s.id = i.school_id WHERE s.network_id = public.school_network_id()),
    'confirmed_payments', (SELECT count(*) FROM public.school_fee_payments p JOIN public.schools s ON s.id = p.school_id WHERE s.network_id = public.school_network_id() AND p.status = 'confirmed'),
    'pending_followups', (SELECT count(*) FROM public.school_finance_followups f JOIN public.schools s ON s.id = f.school_id WHERE s.network_id = public.school_network_id() AND f.status = 'pending')
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_get_network_audit_logs(
  p_limit integer DEFAULT 100, p_offset integer DEFAULT 0
)
RETURNS TABLE(id uuid, actor_id uuid, actor_name text, action text, target_type text, target_id uuid, metadata jsonb, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT l.id, l.actor_id, p.name, l.action, l.target_type, l.target_id, l.metadata, l.created_at
  FROM public.admin_audit_logs l
  LEFT JOIN public.profiles p ON p.id = l.actor_id
  WHERE public._is_super_admin()
    AND ((l.target_type = 'school' AND EXISTS (SELECT 1 FROM public.schools s WHERE s.id = l.target_id AND s.network_id = public.school_network_id()))
      OR l.action LIKE 'super_admin_%' OR l.action = 'school_registered')
  ORDER BY l.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 200))
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION public.super_admin_set_school_membership_status(
  p_membership_id uuid, p_status text, p_reason text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_membership public.school_memberships%ROWTYPE;
BEGIN
  IF NOT public._is_super_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  IF p_status NOT IN ('active', 'suspended', 'deactivated') THEN RAISE EXCEPTION 'Invalid membership status'; END IF;
  SELECT sm.* INTO v_membership
  FROM public.school_memberships sm JOIN public.schools s ON s.id = sm.school_id
  WHERE sm.id = p_membership_id AND s.network_id = public.school_network_id()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership is outside the current network'; END IF;
  IF v_membership.school_role NOT IN ('manager', 'admin', 'teacher', 'finance') THEN
    RAISE EXCEPTION 'Only school staff memberships can be managed here';
  END IF;
  UPDATE public.school_memberships
  SET status = p_status,
      ended_at = CASE WHEN p_status = 'deactivated' THEN coalesce(ended_at, now()) ELSE NULL END,
      end_reason = CASE WHEN p_status = 'deactivated' THEN nullif(trim(p_reason), '') ELSE NULL END,
      updated_at = now()
  WHERE id = p_membership_id;
  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin_membership_status_changed', 'school', v_membership.school_id,
          jsonb_build_object('membership_id', p_membership_id, 'user_id', v_membership.user_id, 'role', v_membership.school_role, 'status', p_status, 'reason', nullif(trim(coalesce(p_reason, '')), '')));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_get_network_settings()
RETURNS TABLE(id uuid, name text, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT n.id, n.name, n.created_at, n.updated_at
  FROM public.school_networks n
  WHERE public._is_super_admin() AND n.network_key = true;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_update_network_name(p_name text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT public._is_super_admin() THEN RAISE EXCEPTION 'Super Admin access required'; END IF;
  IF length(trim(coalesce(p_name, ''))) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Network name must be between 2 and 160 characters'; END IF;
  UPDATE public.school_networks SET name = trim(p_name), updated_at = now() WHERE network_key = true;
  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, metadata)
  VALUES (auth.uid(), 'super_admin_network_settings_changed', 'network', jsonb_build_object('name', trim(p_name)));
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_list_network_people(uuid, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.super_admin_get_school_analytics(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.super_admin_get_network_finance() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.super_admin_get_network_audit_logs(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.super_admin_set_school_membership_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.super_admin_get_network_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.super_admin_update_network_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_list_network_people(uuid, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_get_school_analytics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_get_network_finance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_get_network_audit_logs(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_set_school_membership_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_get_network_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_update_network_name(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_admin_get_network_alerts()
RETURNS TABLE(kind text, severity text, title text, detail text, school_id uuid, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
  SELECT 'school_status', 'warning', 'School access is suspended', s.name || ' (' || s.school_code || ') requires review', s.id, s.updated_at
  FROM public.schools s
  WHERE public._is_super_admin() AND s.network_id = public.school_network_id() AND s.status = 'suspended'
  UNION ALL
  SELECT 'finance_followup', 'info', 'Pending finance follow-up', f.note, f.school_id, f.created_at
  FROM public.school_finance_followups f
  JOIN public.schools s ON s.id = f.school_id
  WHERE public._is_super_admin() AND s.network_id = public.school_network_id() AND f.status = 'pending'
  ORDER BY created_at DESC
  LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.super_admin_get_network_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_get_network_alerts() TO authenticated;
