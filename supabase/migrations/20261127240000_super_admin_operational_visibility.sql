-- Expand Super Admin network visibility with safe operational alerts and finance detail.
-- This remains read-only and scoped to the authenticated Super Admin's singleton network.
CREATE OR REPLACE FUNCTION public.super_admin_get_network_finance()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public._is_super_admin() THEN
    RAISE EXCEPTION 'Super Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'invoice_count',
      (SELECT count(*) FROM public.school_student_invoices i
       JOIN public.schools s ON s.id = i.school_id
       WHERE s.network_id = public.school_network_id()),
    'confirmed_payments',
      (SELECT count(*) FROM public.school_fee_payments p
       JOIN public.school_student_invoices i
         ON i.id = p.invoice_id AND i.school_id = p.school_id
       JOIN public.schools s ON s.id = i.school_id
       WHERE s.network_id = public.school_network_id()
         AND p.status = 'confirmed'),
    'pending_followups',
      (SELECT count(*) FROM public.school_finance_followups f
       JOIN public.schools s ON s.id = f.school_id
       WHERE s.network_id = public.school_network_id()
         AND f.status = 'pending'),
    'overdue_invoice_count',
      (SELECT count(*) FROM public.school_student_invoices i
       JOIN public.schools s ON s.id = i.school_id
       WHERE s.network_id = public.school_network_id()
         AND i.balance > 0 AND i.due_date < current_date),
    'currency_totals',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'currency', totals.currency,
          'invoice_count', totals.invoice_count,
          'invoiced_amount', totals.invoiced_amount,
          'paid_amount', totals.paid_amount,
          'outstanding_balance', totals.outstanding_balance
        ) ORDER BY totals.currency)
        FROM (
          SELECT upper(COALESCE(NULLIF(trim(i.currency), ''), 'ETB')) AS currency,
                 count(*)::integer AS invoice_count,
                 COALESCE(sum(i.amount), 0) AS invoiced_amount,
                 COALESCE(sum(payment_totals.paid_amount), 0) AS paid_amount,
                 COALESCE(sum(i.balance), 0) AS outstanding_balance
          FROM public.school_student_invoices i
          JOIN public.schools s ON s.id = i.school_id
          LEFT JOIN LATERAL (
            SELECT COALESCE(sum(p.amount), 0) AS paid_amount
            FROM public.school_fee_payments p
            WHERE p.invoice_id = i.id AND p.school_id = i.school_id
              AND p.status = 'confirmed'
          ) AS payment_totals ON true
          WHERE s.network_id = public.school_network_id()
          GROUP BY upper(COALESCE(NULLIF(trim(i.currency), ''), 'ETB'))
        ) AS totals
      ), '[]'::jsonb),
    'overdue_by_currency',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'currency', overdue.currency,
          'invoice_count', overdue.invoice_count,
          'outstanding_balance', overdue.outstanding_balance
        ) ORDER BY overdue.currency)
        FROM (
          SELECT upper(COALESCE(NULLIF(trim(i.currency), ''), 'ETB')) AS currency,
                 count(*)::integer AS invoice_count,
                 COALESCE(sum(i.balance), 0) AS outstanding_balance
          FROM public.school_student_invoices i
          JOIN public.schools s ON s.id = i.school_id
          WHERE s.network_id = public.school_network_id()
            AND i.balance > 0 AND i.due_date < current_date
          GROUP BY upper(COALESCE(NULLIF(trim(i.currency), ''), 'ETB'))
        ) AS overdue
      ), '[]'::jsonb),
    'recent_invoices',
      COALESCE((
        SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
        FROM (
          SELECT i.id AS invoice_id, i.invoice_number, s.name AS school_name,
                 s.school_code, i.status, i.due_date, i.amount, i.paid_amount,
                 i.balance, upper(COALESCE(NULLIF(trim(i.currency), ''), 'ETB')) AS currency,
                 i.created_at
          FROM public.school_student_invoices i
          JOIN public.schools s ON s.id = i.school_id
          WHERE s.network_id = public.school_network_id()
          ORDER BY i.created_at DESC
          LIMIT 50
        ) AS r
      ), '[]'::jsonb),
    'recent_payments',
      COALESCE((
        SELECT jsonb_agg(to_jsonb(r) ORDER BY r.received_at DESC)
        FROM (
          SELECT p.id AS payment_id, p.receipt_number, i.invoice_number,
                 s.name AS school_name, s.school_code, p.payment_method,
                 p.status, p.amount,
                 upper(COALESCE(NULLIF(trim(i.currency), ''), 'ETB')) AS currency,
                 p.received_at
          FROM public.school_fee_payments p
          JOIN public.school_student_invoices i
            ON i.id = p.invoice_id AND i.school_id = p.school_id
          JOIN public.schools s ON s.id = p.school_id
          WHERE s.network_id = public.school_network_id()
          ORDER BY p.received_at DESC
          LIMIT 50
        ) AS r
      ), '[]'::jsonb),
    'pending_followup_records',
      COALESCE((
        SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
        FROM (
          SELECT f.id AS followup_id, s.name AS school_name, s.school_code,
                 i.invoice_number, f.status, f.created_at
          FROM public.school_finance_followups f
          JOIN public.schools s ON s.id = f.school_id
          JOIN public.school_student_invoices i
            ON i.id = f.invoice_id AND i.school_id = f.school_id
          WHERE s.network_id = public.school_network_id()
            AND f.status = 'pending'
          ORDER BY f.created_at DESC
          LIMIT 50
        ) AS r
      ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_get_network_alerts()
RETURNS TABLE(kind text, severity text, title text, detail text, school_id uuid, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT alerts.kind, alerts.severity, alerts.title, alerts.detail, alerts.school_id, alerts.created_at
  FROM (
    SELECT
      'school_status'::text AS kind,
      'warning'::text AS severity,
      'School access is suspended'::text AS title,
      s.name || ' (' || s.school_code || ') is suspended and needs review' AS detail,
      s.id AS school_id,
      s.updated_at AS created_at
    FROM public.schools s
    WHERE public._is_super_admin()
      AND s.network_id = public.school_network_id()
      AND s.status = 'suspended'

    UNION ALL

    SELECT
      'staffing'::text,
      'warning'::text,
      'School has no active Manager'::text,
      s.name || ' (' || s.school_code || ') has no active Manager membership',
      s.id,
      s.updated_at
    FROM public.schools s
    WHERE public._is_super_admin()
      AND s.network_id = public.school_network_id()
      AND s.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.school_memberships sm
        WHERE sm.school_id = s.id
          AND sm.school_role = 'manager'
          AND sm.status = 'active'
      )

    UNION ALL

    SELECT
      'finance_followup'::text,
      'info'::text,
      'Pending finance follow-ups'::text,
      count(*)::text || ' follow-up item(s) await review in ' || s.name || ' (' || s.school_code || ')',
      f.school_id,
      max(f.created_at)
    FROM public.school_finance_followups f
    JOIN public.schools s ON s.id = f.school_id
    WHERE public._is_super_admin()
      AND s.network_id = public.school_network_id()
      AND f.status = 'pending'
    GROUP BY f.school_id, s.name, s.school_code

    UNION ALL

    SELECT
      'behavior_review'::text,
      CASE WHEN count(*) FILTER (WHERE br.severity IN ('high', 'critical')) > 0
        THEN 'warning' ELSE 'info' END,
      'Pending behavior reports'::text,
      count(*)::text || ' report(s) await review in ' || s.name || ' (' || s.school_code || ')',
      br.school_id,
      max(br.created_at)
    FROM public.school_behavior_reports br
    JOIN public.schools s ON s.id = br.school_id
    WHERE public._is_super_admin()
      AND s.network_id = public.school_network_id()
      AND br.status = 'pending'
    GROUP BY br.school_id, s.name, s.school_code
  ) AS alerts
  ORDER BY alerts.created_at DESC NULLS LAST
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.super_admin_get_network_finance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_get_network_finance() TO authenticated;
REVOKE ALL ON FUNCTION public.super_admin_get_network_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_get_network_alerts() TO authenticated;


-- Existing-account assignment is a distinct Super Admin workflow. Keep it
-- network-scoped and auditable instead of reusing school-manager provisioning.
CREATE OR REPLACE FUNCTION public.super_admin_attach_existing_account(
  p_school_id uuid,
  p_user_id uuid,
  p_school_role text,
  p_school_username text,
  p_reason text,
  p_student_membership_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_membership_id uuid;
  v_account_status text;
  v_profile_username text;
  v_student_ids uuid[];
BEGIN
  IF NOT public._is_super_admin() THEN
    RAISE EXCEPTION 'Super Admin access required';
  END IF;

  IF p_school_id IS NULL OR p_user_id IS NULL
     OR p_school_role IS NULL
     OR p_school_role NOT IN ('manager', 'finance', 'parent')
     OR nullif(trim(p_school_username), '') IS NULL
     OR length(trim(coalesce(p_reason, ''))) < 8 THEN
    RAISE EXCEPTION 'A school, active account, supported role, username, and reason are required';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot assign your own account to a school';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = p_school_id
      AND s.network_id = public.school_network_id()
      AND s.status = 'active'
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'School is not active in the current network';
  END IF;

  SELECT lower(trim(p.username)), coalesce(p.account_status, 'active')
    INTO v_profile_username, v_account_status
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR SHARE;

  IF v_profile_username IS NULL THEN
    RAISE EXCEPTION 'Existing account was not found';
  END IF;
  IF v_account_status <> 'active' THEN
    RAISE EXCEPTION 'Only active accounts can be assigned to a school';
  END IF;
  IF v_profile_username <> lower(trim(p_school_username)) THEN
    RAISE EXCEPTION 'School username does not match the existing account profile';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role IN ('extreme_admin'::public.app_role, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Platform authority accounts cannot be assigned to a school';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role::text NOT IN ('extreme_admin', 'super_admin', p_school_role)
  ) OR EXISTS (
    SELECT 1 FROM public.school_memberships sm
    WHERE sm.user_id = p_user_id
      AND sm.status = 'active'
      AND sm.school_role <> p_school_role
  ) THEN
    RAISE EXCEPTION 'The existing account has a different active school role; use a matching account role';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.school_memberships sm
    WHERE sm.school_id = p_school_id AND sm.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'This account already has a membership in the selected school';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.school_memberships sm
    WHERE sm.school_id = p_school_id
      AND lower(sm.school_username) = v_profile_username
  ) THEN
    RAISE EXCEPTION 'This school username is already in use';
  END IF;

  v_student_ids := ARRAY(
    SELECT DISTINCT student_id
    FROM unnest(coalesce(p_student_membership_ids, '{}'::uuid[])) AS ids(student_id)
    WHERE student_id IS NOT NULL
  );

  IF p_school_role = 'parent' THEN
    IF v_profile_username NOT LIKE 'pa%' THEN
      RAISE EXCEPTION 'Existing Parent usernames must begin with pa';
    END IF;
    IF cardinality(v_student_ids) = 0 THEN
      RAISE EXCEPTION 'A Parent account must be linked to at least one active student';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM unnest(v_student_ids) AS ids(student_id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.school_memberships sm
        WHERE sm.id = ids.student_id
          AND sm.school_id = p_school_id
          AND sm.school_role = 'student'
          AND sm.status = 'active'
      )
    ) THEN
      RAISE EXCEPTION 'Every linked student must be actively enrolled in this school';
    END IF;
  ELSIF cardinality(v_student_ids) > 0 THEN
    RAISE EXCEPTION 'Student links are only valid for Parent assignments';
  END IF;

  INSERT INTO public.school_memberships(
    school_id, user_id, school_role, status, school_username, created_by
  )
  VALUES (
    p_school_id, p_user_id, p_school_role, 'active', v_profile_username, auth.uid()
  )
  RETURNING id INTO v_membership_id;

  IF p_school_role = 'parent' THEN
    INSERT INTO public.school_parent_student_links(
      school_id, parent_membership_id, student_membership_id, linked_by
    )
    SELECT p_school_id, v_membership_id, ids.student_id, auth.uid()
    FROM unnest(v_student_ids) AS ids(student_id);
  END IF;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    'school_network_existing_account_assigned',
    'school_membership',
    v_membership_id,
    jsonb_build_object(
      'school_id', p_school_id,
      'user_id', p_user_id,
      'school_role', p_school_role,
      'username', v_profile_username,
      'reason', trim(p_reason),
      'linked_student_count', cardinality(v_student_ids)
    )
  );

  RETURN v_membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_attach_existing_account(uuid, uuid, text, text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_attach_existing_account(uuid, uuid, text, text, text, uuid[]) TO authenticated;
