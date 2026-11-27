-- Part 1: Executive metrics for the Extreme Admin.
-- All counts are derived from durable platform records. Finance figures are
-- explicitly limited to confirmed school-fee receipts and outstanding invoices.

CREATE OR REPLACE FUNCTION public.extreme_admin_get_executive_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_metrics jsonb;
  v_collected_by_currency jsonb := '[]'::jsonb;
  v_collected_month_by_currency jsonb := '[]'::jsonb;
  v_collected_year_by_currency jsonb := '[]'::jsonb;
  v_outstanding_by_currency jsonb := '[]'::jsonb;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('currency', totals.currency, 'collected', totals.collected)
      ORDER BY totals.currency
    ),
    '[]'::jsonb
  )
  INTO v_collected_by_currency
  FROM (
    SELECT COALESCE(NULLIF(invoice.currency, ''), 'ETB') AS currency,
           SUM(payment.amount)::numeric(14,2) AS collected
    FROM public.school_fee_payments payment
    JOIN public.school_student_invoices invoice
      ON invoice.id = payment.invoice_id AND invoice.school_id = payment.school_id
    WHERE payment.status = 'confirmed'
    GROUP BY COALESCE(NULLIF(invoice.currency, ''), 'ETB')
  ) totals;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('currency', totals.currency, 'collected', totals.collected)
      ORDER BY totals.currency
    ),
    '[]'::jsonb
  )
  INTO v_collected_month_by_currency
  FROM (
    SELECT COALESCE(NULLIF(invoice.currency, ''), 'ETB') AS currency,
           SUM(payment.amount)::numeric(14,2) AS collected
    FROM public.school_fee_payments payment
    JOIN public.school_student_invoices invoice
      ON invoice.id = payment.invoice_id AND invoice.school_id = payment.school_id
    WHERE payment.status = 'confirmed'
      AND payment.received_at >= (date_trunc('month', now() AT TIME ZONE 'Africa/Addis_Ababa') AT TIME ZONE 'Africa/Addis_Ababa')
    GROUP BY COALESCE(NULLIF(invoice.currency, ''), 'ETB')
  ) totals;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('currency', totals.currency, 'collected', totals.collected)
      ORDER BY totals.currency
    ),
    '[]'::jsonb
  )
  INTO v_collected_year_by_currency
  FROM (
    SELECT COALESCE(NULLIF(invoice.currency, ''), 'ETB') AS currency,
           SUM(payment.amount)::numeric(14,2) AS collected
    FROM public.school_fee_payments payment
    JOIN public.school_student_invoices invoice
      ON invoice.id = payment.invoice_id AND invoice.school_id = payment.school_id
    WHERE payment.status = 'confirmed'
      AND payment.received_at >= (date_trunc('year', now() AT TIME ZONE 'Africa/Addis_Ababa') AT TIME ZONE 'Africa/Addis_Ababa')
    GROUP BY COALESCE(NULLIF(invoice.currency, ''), 'ETB')
  ) totals;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('currency', totals.currency, 'outstanding', totals.outstanding)
      ORDER BY totals.currency
    ),
    '[]'::jsonb
  )
  INTO v_outstanding_by_currency
  FROM (
    SELECT COALESCE(NULLIF(invoice.currency, ''), 'ETB') AS currency,
           SUM(invoice.balance)::numeric(14,2) AS outstanding
    FROM public.school_student_invoices invoice
    WHERE invoice.balance > 0
    GROUP BY COALESCE(NULLIF(invoice.currency, ''), 'ETB')
  ) totals;

  SELECT jsonb_build_object(
    'registered_users', (SELECT count(*) FROM public.profiles),
    'registered_today', (SELECT count(*) FROM public.profiles WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'Africa/Addis_Ababa') AT TIME ZONE 'Africa/Addis_Ababa')),
    'registered_7d', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '7 days'),
    'registered_30d', (SELECT count(*) FROM public.profiles WHERE created_at >= now() - interval '30 days'),
    'schools_created_7d', (SELECT count(*) FROM public.schools WHERE created_at >= now() - interval '7 days'),
    'schools_created_30d', (SELECT count(*) FROM public.schools WHERE created_at >= now() - interval '30 days'),
    'daily_active_users', (
      SELECT count(DISTINCT presence.user_id)
      FROM public.user_presence presence
      WHERE presence.last_seen >= (date_trunc('day', now() AT TIME ZONE 'Africa/Addis_Ababa') AT TIME ZONE 'Africa/Addis_Ababa')
    ),
    'weekly_active_users', (
      SELECT count(DISTINCT presence.user_id)
      FROM public.user_presence presence
      WHERE presence.last_seen >= now() - interval '7 days'
    ),
    'monthly_active_users', (
      SELECT count(DISTINCT presence.user_id)
      FROM public.user_presence presence
      WHERE presence.last_seen >= now() - interval '30 days'
    ),
    'recently_active_10m', (
      SELECT count(DISTINCT presence.user_id)
      FROM public.user_presence presence
      WHERE presence.last_seen >= now() - interval '10 minutes'
    ),
    'schools_total', (SELECT count(*) FROM public.schools),
    'schools_active', (SELECT count(*) FROM public.schools WHERE status = 'active'),
    'schools_suspended', (SELECT count(*) FROM public.schools WHERE status = 'suspended'),
    'schools_closed', (SELECT count(*) FROM public.schools WHERE status = 'closed'),
    'students', (
      SELECT count(*) FROM (
        SELECT user_id FROM public.user_roles WHERE role = 'student'::public.app_role
        UNION
        SELECT user_id FROM public.school_memberships WHERE school_role = 'student' AND status = 'active'
      ) student_accounts
    ),
    'teachers', (
      SELECT count(*) FROM (
        SELECT user_id FROM public.user_roles WHERE role = 'teacher'::public.app_role
        UNION
        SELECT user_id FROM public.school_memberships WHERE school_role = 'teacher' AND status = 'active'
      ) teacher_accounts
    ),
    'parents', (
      SELECT count(*) FROM (
        SELECT user_id FROM public.user_roles WHERE role = 'parent'::public.app_role
        UNION
        SELECT user_id FROM public.school_memberships WHERE school_role = 'parent' AND status = 'active'
      ) parent_accounts
    ),
    'staff', (
      SELECT count(*) FROM (
        SELECT user_id FROM public.user_roles
        WHERE role IN (
          'teacher'::public.app_role, 'manager'::public.app_role,
          'admin'::public.app_role, 'finance'::public.app_role
        )
        UNION
        SELECT user_id FROM public.school_memberships
        WHERE school_role IN ('teacher', 'manager', 'admin', 'finance') AND status = 'active'
      ) staff_accounts
    ),
    'super_admins', (SELECT count(*) FROM public.user_roles WHERE role = 'super_admin'::public.app_role),
    'extreme_admins', (SELECT count(*) FROM public.user_roles WHERE role = 'extreme_admin'::public.app_role),
    'audit_events_total', (SELECT count(*) FROM public.admin_audit_logs) + (SELECT count(*) FROM public.extreme_admin_audit_logs),
    'audit_events_24h', (SELECT count(*) FROM public.admin_audit_logs WHERE created_at >= now() - interval '24 hours') + (SELECT count(*) FROM public.extreme_admin_audit_logs WHERE created_at >= now() - interval '24 hours'),
    'school_fee_payments_confirmed', (SELECT count(*) FROM public.school_fee_payments WHERE status = 'confirmed'),
    'notification_devices_enabled', (SELECT count(*) FROM public.notification_devices WHERE enabled = true),
    'notification_inbox_events_24h', (SELECT count(*) FROM public.notification_events WHERE created_at >= now() - interval '24 hours'),
    'notification_fcm_accepted_24h', (SELECT count(*) FROM public.notification_events WHERE created_at >= now() - interval '24 hours' AND delivered_at >= now() - interval '24 hours'),
    'notification_failed_24h', (SELECT count(*) FROM public.notification_events WHERE created_at >= now() - interval '24 hours' AND data ->> 'delivery_status' = 'failed'),
    'notification_skipped_24h', (SELECT count(*) FROM public.notification_events WHERE created_at >= now() - interval '24 hours' AND data ->> 'delivery_status' IN ('skipped_preferences', 'no_eligible_devices')),
    'study_call_rooms_24h', (SELECT count(*) FROM public.study_call_rooms WHERE created_at >= now() - interval '24 hours'),
    'storage_buckets_configured', (SELECT count(*) FROM storage.buckets),
    'school_invoices_total', (SELECT count(*) FROM public.school_student_invoices),
    'school_invoices_outstanding', (SELECT count(*) FROM public.school_student_invoices WHERE balance > 0),
    'school_fee_collected_by_currency', v_collected_by_currency,
    'school_fee_collected_month_by_currency', v_collected_month_by_currency,
    'school_fee_collected_year_by_currency', v_collected_year_by_currency,
    'school_fee_outstanding_by_currency', v_outstanding_by_currency,
    'metrics_generated_at', now()
  )
  INTO v_metrics;

  RETURN v_metrics;
END;
$function$;

REVOKE ALL ON FUNCTION public.extreme_admin_get_executive_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_executive_metrics() TO authenticated;

-- Extend the existing protected account directory search to include UUIDs.
-- Keep the established result contract and server-side pagination unchanged.
CREATE OR REPLACE FUNCTION public.extreme_admin_list_users(
  p_search text DEFAULT NULL,
  p_role public.app_role DEFAULT NULL,
  p_limit integer DEFAULT 300,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  name text,
  username text,
  grade text,
  xp integer,
  level integer,
  role public.app_role,
  account_status text,
  coins integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    profile.id,
    profile.name,
    profile.username,
    profile.grade,
    profile.xp,
    profile.level,
    COALESCE(public.get_user_role(profile.id), 'student'::public.app_role),
    profile.account_status,
    COALESCE(currency.coins, 0),
    profile.created_at
  FROM public.profiles profile
  LEFT JOIN LATERAL (
    SELECT user_currency.coins
    FROM public.user_currency
    WHERE user_currency.user_id = profile.id
    LIMIT 1
  ) currency ON true
  WHERE public._is_extreme_admin()
    AND (
      nullif(trim(p_search), '') IS NULL
      OR profile.name ILIKE '%' || trim(p_search) || '%'
      OR profile.username ILIKE '%' || trim(p_search) || '%'
      OR profile.id::text ILIKE '%' || trim(p_search) || '%'
    )
    AND (
      p_role IS NULL
      OR COALESCE(public.get_user_role(profile.id), 'student'::public.app_role) = p_role
    )
  ORDER BY profile.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500))
  OFFSET GREATEST(0, p_offset);
$function$;

REVOKE ALL ON FUNCTION public.extreme_admin_list_users(text, public.app_role, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_list_users(text, public.app_role, integer, integer) TO authenticated;

-- Merge the two historical audit stores into one read-only owner timeline.
-- The existing function has a different OUT-row definition, so drop this RPC
-- before recreating its stable frontend result contract.
DROP FUNCTION IF EXISTS public.extreme_admin_get_audit_logs(integer);
CREATE FUNCTION public.extreme_admin_get_audit_logs(p_limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  actor_id uuid,
  actor_name text,
  action text,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT event.id, event.actor_id, profile.name, event.action,
         event.target_type, event.target_id, event.details, event.created_at
  FROM (
    SELECT legacy.id, legacy.actor_id, legacy.action, legacy.target_type,
           legacy.target_id, legacy.details, legacy.created_at
    FROM public.extreme_admin_audit_logs legacy
    UNION ALL
    SELECT current_log.id, current_log.actor_id, current_log.action,
           current_log.target_type, current_log.target_id::text,
           current_log.metadata, current_log.created_at
    FROM public.admin_audit_logs current_log
  ) event
  LEFT JOIN public.profiles profile ON profile.id = event.actor_id
  WHERE public._is_extreme_admin()
  ORDER BY event.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 1000));
$function$;

REVOKE ALL ON FUNCTION public.extreme_admin_get_audit_logs(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_audit_logs(integer) TO authenticated;
