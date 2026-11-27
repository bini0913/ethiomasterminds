-- Part 2: Extreme Admin business intelligence (read-only reporting).
-- No data is seeded or changed. Currency totals are never combined across currencies.
CREATE OR REPLACE FUNCTION public.extreme_admin_get_business_intelligence(
  p_days integer DEFAULT 30,
  p_school_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_start_date date;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;
  IF p_days NOT IN (7, 30, 90) THEN
    RAISE EXCEPTION 'Days must be 7, 30 or 90';
  END IF;
  IF p_school_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.schools s WHERE s.id = p_school_id
  ) THEN
    RAISE EXCEPTION 'Unknown school filter';
  END IF;

  v_start_date := (now() AT TIME ZONE 'Africa/Addis_Ababa')::date - (p_days - 1);

  SELECT jsonb_build_object(
    'generated_at', now(),
    'days', p_days,
    'school_filter', p_school_id,
    'platform_finance', jsonb_build_object(
      'active_accounts', (SELECT count(*) FROM public.finance_accounts WHERE active),
      'account_balances', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('currency', COALESCE(NULLIF(currency, ''), 'ETB'),
          'balance', balance) ORDER BY currency)
        FROM (SELECT COALESCE(NULLIF(currency, ''), 'ETB') currency,
          sum(current_balance)::numeric(14,2) balance
          FROM public.finance_accounts WHERE active
          GROUP BY COALESCE(NULLIF(currency, ''), 'ETB')) a
      ), '[]'::jsonb),
      'invoice_count', (SELECT count(*) FROM public.finance_invoices),
      'payment_records', (SELECT count(*) FROM public.finance_payments),
      'paid_amount_by_currency', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('currency', currency, 'paid', paid) ORDER BY currency)
        FROM (SELECT COALESCE(NULLIF(i.currency, ''), 'ETB') currency,
          sum(p.amount)::numeric(14,2) paid
          FROM public.finance_payments p
          JOIN public.finance_invoices i ON i.id = p.invoice_id
          WHERE p.paid_at IS NOT NULL
          GROUP BY COALESCE(NULLIF(i.currency, ''), 'ETB')) x
      ), '[]'::jsonb),
      'transaction_records', (SELECT count(*) FROM public.finance_transactions),
      'ledger_statuses', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('status', status, 'direction', direction, 'records', records)
          ORDER BY status, direction)
        FROM (SELECT COALESCE(status, 'unspecified') status,
          COALESCE(direction, 'unspecified') direction, count(*) records
          FROM public.finance_transactions GROUP BY status, direction) x
      ), '[]'::jsonb),
      'recent_payments', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('payment_id', p.id, 'invoice_number', i.invoice_number,
          'amount', p.amount, 'currency', COALESCE(NULLIF(i.currency, ''), 'ETB'),
          'method', p.method, 'paid_at', p.paid_at) ORDER BY p.paid_at DESC NULLS LAST)
        FROM (SELECT * FROM public.finance_payments ORDER BY paid_at DESC NULLS LAST LIMIT 100) p
        LEFT JOIN public.finance_invoices i ON i.id = p.invoice_id
      ), '[]'::jsonb),
      'recent_invoices', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('invoice_id', id, 'invoice_number', invoice_number,
          'description', description, 'currency', COALESCE(NULLIF(currency, ''), 'ETB'),
          'total', total, 'amount_paid', COALESCE(amount_paid, 0),
          'outstanding', GREATEST(total - COALESCE(amount_paid, 0), 0),
          'status', status, 'due_date', due_date, 'created_at', created_at) ORDER BY created_at DESC)
        FROM (SELECT * FROM public.finance_invoices ORDER BY created_at DESC LIMIT 100) i
      ), '[]'::jsonb),
      'ledger_movements', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('currency', currency, 'status', status,
          'direction', direction, 'amount', amount, 'records', records) ORDER BY currency, status, direction)
        FROM (SELECT COALESCE(NULLIF(currency, ''), 'ETB') currency,
          COALESCE(status, 'unspecified') status, COALESCE(direction, 'unspecified') direction,
          sum(amount)::numeric(14,2) amount, count(*) records
          FROM public.finance_transactions
          GROUP BY COALESCE(NULLIF(currency, ''), 'ETB'), COALESCE(status, 'unspecified'), COALESCE(direction, 'unspecified')) x
      ), '[]'::jsonb),
      'receivables_by_currency', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('currency', currency, 'outstanding', outstanding)
          ORDER BY currency)
        FROM (SELECT COALESCE(NULLIF(currency, ''), 'ETB') currency,
          sum(GREATEST(total - COALESCE(amount_paid, 0), 0))::numeric(14,2) outstanding
          FROM public.finance_invoices
          WHERE total > COALESCE(amount_paid, 0)
          GROUP BY COALESCE(NULLIF(currency, ''), 'ETB')) x
      ), '[]'::jsonb)
    ),
    'school_finance', jsonb_build_object(
      'invoice_count', (SELECT count(*) FROM public.school_student_invoices i
        WHERE p_school_id IS NULL OR i.school_id = p_school_id),
      'confirmed_payment_count', (SELECT count(*) FROM public.school_fee_payments p
        WHERE p.status = 'confirmed' AND (p_school_id IS NULL OR p.school_id = p_school_id)),
      'outstanding_invoice_count', (SELECT count(*) FROM public.school_student_invoices i
        WHERE i.balance > 0 AND (p_school_id IS NULL OR i.school_id = p_school_id)),
      'collections_by_currency', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('currency', currency, 'collected', collected)
          ORDER BY currency)
        FROM (SELECT COALESCE(NULLIF(i.currency, ''), 'ETB') currency,
          sum(p.amount)::numeric(14,2) collected
          FROM public.school_fee_payments p
          JOIN public.school_student_invoices i ON i.id = p.invoice_id AND i.school_id = p.school_id
          WHERE p.status = 'confirmed' AND (p_school_id IS NULL OR p.school_id = p_school_id)
          GROUP BY COALESCE(NULLIF(i.currency, ''), 'ETB')) x
      ), '[]'::jsonb),
      'outstanding_by_currency', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('currency', currency, 'outstanding', outstanding)
          ORDER BY currency)
        FROM (SELECT COALESCE(NULLIF(currency, ''), 'ETB') currency,
          sum(balance)::numeric(14,2) outstanding
          FROM public.school_student_invoices
          WHERE balance > 0 AND (p_school_id IS NULL OR school_id = p_school_id)
          GROUP BY COALESCE(NULLIF(currency, ''), 'ETB')) x
      ), '[]'::jsonb),
      'by_school', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'school_id', s.id, 'school_name', s.name, 'school_code', s.school_code,
          'invoice_count', COALESCE(inv.invoice_count, 0),
          'outstanding_invoice_count', COALESCE(inv.outstanding_invoice_count, 0),
          'outstanding_by_currency', COALESCE(inv.outstanding_by_currency, '[]'::jsonb),
          'collections_by_currency', COALESCE(col.collections_by_currency, '[]'::jsonb)
        ) ORDER BY s.name)
        FROM public.schools s
        LEFT JOIN LATERAL (
          SELECT
            (SELECT count(*) FROM public.school_student_invoices i WHERE i.school_id = s.id) invoice_count,
            (SELECT count(*) FROM public.school_student_invoices i WHERE i.school_id = s.id AND i.balance > 0) outstanding_invoice_count,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount) ORDER BY currency)
              FROM (SELECT COALESCE(NULLIF(i.currency, ''), 'ETB') currency,
                sum(i.balance)::numeric(14,2) amount
                FROM public.school_student_invoices i
                WHERE i.school_id = s.id AND i.balance > 0
                GROUP BY COALESCE(NULLIF(i.currency, ''), 'ETB')) balances
            ), '[]'::jsonb) outstanding_by_currency
        ) inv ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount)
            ORDER BY currency), '[]'::jsonb) collections_by_currency
          FROM (SELECT COALESCE(NULLIF(i.currency, ''), 'ETB') currency,
              sum(p.amount)::numeric(14,2) amount
            FROM public.school_fee_payments p
            JOIN public.school_student_invoices i ON i.id = p.invoice_id AND i.school_id = p.school_id
            WHERE p.school_id = s.id AND p.status = 'confirmed'
            GROUP BY COALESCE(NULLIF(i.currency, ''), 'ETB')) z
        ) col ON true
        WHERE p_school_id IS NULL OR s.id = p_school_id
      ), '[]'::jsonb),
      'recent_payments', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('payment_id', p.id, 'school_id', p.school_id,
          'school_name', s.name, 'invoice_number', i.invoice_number, 'receipt_number', p.receipt_number,
          'amount', p.amount, 'currency', COALESCE(NULLIF(i.currency, ''), 'ETB'),
          'method', COALESCE(NULLIF(p.payment_method, ''), 'Unspecified'),
          'status', p.status, 'received_at', p.received_at) ORDER BY p.received_at DESC NULLS LAST)
        FROM (SELECT * FROM public.school_fee_payments
          WHERE p_school_id IS NULL OR school_id = p_school_id
          ORDER BY received_at DESC NULLS LAST LIMIT 100) p
        JOIN public.school_student_invoices i ON i.id = p.invoice_id AND i.school_id = p.school_id
        JOIN public.schools s ON s.id = p.school_id
      ), '[]'::jsonb),
      'recent_invoices', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('invoice_id', i.id, 'school_id', i.school_id,
          'school_name', s.name, 'invoice_number', i.invoice_number, 'description', i.description,
          'amount', i.amount, 'paid_amount', i.paid_amount, 'balance', i.balance,
          'currency', COALESCE(NULLIF(i.currency, ''), 'ETB'), 'status', i.status,
          'due_date', i.due_date, 'created_at', i.created_at) ORDER BY i.created_at DESC)
        FROM (SELECT * FROM public.school_student_invoices
          WHERE p_school_id IS NULL OR school_id = p_school_id
          ORDER BY created_at DESC LIMIT 100) i
        JOIN public.schools s ON s.id = i.school_id
      ), '[]'::jsonb),
      'payment_methods', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('method', method, 'currency', currency,
          'collected', collected, 'payments', payments) ORDER BY method, currency)
        FROM (SELECT COALESCE(NULLIF(p.payment_method, ''), 'Unspecified') method,
          COALESCE(NULLIF(i.currency, ''), 'ETB') currency,
          sum(p.amount)::numeric(14,2) collected, count(*) payments
          FROM public.school_fee_payments p
          JOIN public.school_student_invoices i ON i.id = p.invoice_id AND i.school_id = p.school_id
          WHERE p.status = 'confirmed' AND (p_school_id IS NULL OR p.school_id = p_school_id)
          GROUP BY COALESCE(NULLIF(p.payment_method, ''), 'Unspecified'),
            COALESCE(NULLIF(i.currency, ''), 'ETB')) x
      ), '[]'::jsonb),
      'daily_collections', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('day', day, 'currency', currency, 'collected', collected)
          ORDER BY day, currency)
        FROM (SELECT (p.received_at AT TIME ZONE 'Africa/Addis_Ababa')::date day,
          COALESCE(NULLIF(i.currency, ''), 'ETB') currency,
          sum(p.amount)::numeric(14,2) collected
          FROM public.school_fee_payments p
          JOIN public.school_student_invoices i ON i.id = p.invoice_id AND i.school_id = p.school_id
          WHERE p.status = 'confirmed'
            AND p.received_at >= (v_start_date::timestamp AT TIME ZONE 'Africa/Addis_Ababa')
            AND (p_school_id IS NULL OR p.school_id = p_school_id)
          GROUP BY (p.received_at AT TIME ZONE 'Africa/Addis_Ababa')::date,
            COALESCE(NULLIF(i.currency, ''), 'ETB')) x
      ), '[]'::jsonb)
    ),
    'growth', jsonb_build_object(
      'registrations_by_day', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('day', day, 'registrations', registrations) ORDER BY day)
        FROM (SELECT (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date day, count(*) registrations
          FROM public.profiles
          WHERE created_at >= (v_start_date::timestamp AT TIME ZONE 'Africa/Addis_Ababa')
          GROUP BY (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date) x
      ), '[]'::jsonb),
      'schools_created_by_day', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('day', day, 'schools', schools) ORDER BY day)
        FROM (SELECT (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date day, count(*) schools
          FROM public.schools
          WHERE created_at >= (v_start_date::timestamp AT TIME ZONE 'Africa/Addis_Ababa')
            AND (p_school_id IS NULL OR id = p_school_id)
          GROUP BY (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date) x
      ), '[]'::jsonb),
      'student_activity_by_day', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('day', day, 'active_students', active_students,
          'questions', questions, 'correct', correct, 'quizzes', quizzes, 'xp', xp) ORDER BY day)
        FROM (SELECT activity_date day, count(DISTINCT user_id) active_students,
          sum(question_count)::bigint questions, sum(correct_count)::bigint correct,
          sum(quiz_count)::bigint quizzes, sum(xp_earned)::bigint xp
          FROM public.upper_student_daily_activity
          WHERE activity_date >= v_start_date
          GROUP BY activity_date) x
      ), '[]'::jsonb),
      'study_sessions_by_day', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('day', day, 'sessions', sessions, 'duration_units', duration_units) ORDER BY day)
        FROM (SELECT (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date day,
          count(*) sessions, sum(COALESCE(duration, 0))::bigint duration_units
          FROM public.study_sessions
          WHERE created_at >= (v_start_date::timestamp AT TIME ZONE 'Africa/Addis_Ababa')
          GROUP BY (created_at AT TIME ZONE 'Africa/Addis_Ababa')::date) x
      ), '[]'::jsonb),
      'activity_summary', (SELECT jsonb_build_object(
        'active_students', count(DISTINCT user_id),
        'repeat_active_students', count(DISTINCT user_id) FILTER (WHERE active_days >= 2),
        'active_days_total', COALESCE(sum(active_days), 0),
        'questions', COALESCE(sum(questions), 0),
        'correct', COALESCE(sum(correct), 0),
        'quizzes', COALESCE(sum(quizzes), 0),
        'xp', COALESCE(sum(xp), 0)
      ) FROM (SELECT user_id, count(DISTINCT activity_date) active_days,
          sum(question_count)::bigint questions, sum(correct_count)::bigint correct,
          sum(quiz_count)::bigint quizzes, sum(xp_earned)::bigint xp
        FROM public.upper_student_daily_activity
        WHERE activity_date >= v_start_date
        GROUP BY user_id) a)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.extreme_admin_get_business_intelligence(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_business_intelligence(integer, uuid) TO authenticated;
