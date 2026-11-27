-- Keep Super Admin network finance and school balances currency-safe.
-- Only confirmed payments linked to an invoice count as collections.

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
    'currency_totals',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'currency', totals.currency,
            'invoice_count', totals.invoice_count,
            'invoiced_amount', totals.invoiced_amount,
            'paid_amount', totals.paid_amount,
            'outstanding_balance', totals.outstanding_balance
          ) ORDER BY totals.currency
        )
        FROM (
          SELECT
            upper(COALESCE(NULLIF(trim(i.currency), ''), 'ETB')) AS currency,
            count(*)::integer AS invoice_count,
            COALESCE(sum(i.amount), 0) AS invoiced_amount,
            COALESCE(sum(payment_totals.paid_amount), 0) AS paid_amount,
            COALESCE(sum(i.balance), 0) AS outstanding_balance
          FROM public.school_student_invoices i
          JOIN public.schools s ON s.id = i.school_id
          LEFT JOIN LATERAL (
            SELECT COALESCE(sum(p.amount), 0) AS paid_amount
            FROM public.school_fee_payments p
            WHERE p.invoice_id = i.id
              AND p.school_id = i.school_id
              AND p.status = 'confirmed'
          ) AS payment_totals ON true
          WHERE s.network_id = public.school_network_id()
          GROUP BY upper(COALESCE(NULLIF(trim(i.currency), ''), 'ETB'))
        ) AS totals
      ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_get_school_analytics(p_school_id uuid)
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

  IF NOT EXISTS (
    SELECT 1 FROM public.schools
    WHERE id = p_school_id AND network_id = public.school_network_id()
  ) THEN
    RAISE EXCEPTION 'School is outside the current network';
  END IF;

  SELECT jsonb_build_object(
    'school_id', p_school_id,
    'students', (SELECT count(*) FROM public.school_memberships
      WHERE school_id = p_school_id AND school_role = 'student'
        AND status IN ('active','suspended')),
    'teachers', (SELECT count(*) FROM public.school_memberships
      WHERE school_id = p_school_id AND school_role = 'teacher' AND status = 'active'),
    'parents', (SELECT count(*) FROM public.school_memberships
      WHERE school_id = p_school_id AND school_role = 'parent' AND status = 'active'),
    'finance_staff', (SELECT count(*) FROM public.school_memberships
      WHERE school_id = p_school_id AND school_role = 'finance' AND status = 'active'),
    'admins', (SELECT count(*) FROM public.school_memberships
      WHERE school_id = p_school_id AND school_role = 'admin' AND status = 'active'),
    'managers', (SELECT count(*) FROM public.school_memberships
      WHERE school_id = p_school_id AND school_role = 'manager' AND status = 'active'),
    'average_score', (SELECT round(avg(average_score), 2)
      FROM public.school_term_results
      WHERE school_id = p_school_id AND status IN ('calculated','published')),
    'published_results', (SELECT count(*) FROM public.school_term_results
      WHERE school_id = p_school_id AND status = 'published'),
    'attendance_records', (SELECT count(*) FROM public.school_attendance_records
      WHERE school_id = p_school_id),
    'attendance_rate', (SELECT round(
      100.0 * count(*) FILTER (WHERE attendance_status IN ('present','late'))
      / nullif(count(*), 0), 2)
      FROM public.school_attendance_records WHERE school_id = p_school_id),
    'pending_behavior_reports', (SELECT count(*) FROM public.school_behavior_reports
      WHERE school_id = p_school_id AND status = 'pending'),
    'invoice_count', (SELECT count(*) FROM public.school_student_invoices
      WHERE school_id = p_school_id),
    'payment_count', (SELECT count(*) FROM public.school_fee_payments p
      JOIN public.school_student_invoices i
        ON i.id = p.invoice_id AND i.school_id = p.school_id
      WHERE p.school_id = p_school_id AND p.status = 'confirmed'),
    'outstanding_by_currency',
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'currency', balances.currency,
            'outstanding_balance', balances.outstanding_balance
          ) ORDER BY balances.currency
        )
        FROM (
          SELECT
            upper(COALESCE(NULLIF(trim(i.currency), ''), 'ETB')) AS currency,
            COALESCE(sum(i.balance), 0) AS outstanding_balance
          FROM public.school_student_invoices i
          WHERE i.school_id = p_school_id AND i.balance > 0
          GROUP BY upper(COALESCE(NULLIF(trim(i.currency), ''), 'ETB'))
        ) AS balances
      ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
