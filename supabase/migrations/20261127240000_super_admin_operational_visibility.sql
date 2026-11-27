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
