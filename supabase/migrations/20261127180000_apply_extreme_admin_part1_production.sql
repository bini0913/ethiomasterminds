-- New forward migration: the previous 20261127170000 file was corrected after
-- it had already entered main, so the push-only deployment workflow correctly
-- did not replay that historical file. This later version applies the complete
-- production-compatible Part 1 Extreme Admin RPC set.
-- Forward production-compatible copy of Part 1 Extreme Admin executive controls.
-- Production uses profiles.account_status as its canonical account status field.
-- This migration uses the existing profile status field without adding a parallel status store.
-- Part 1: Executive metrics for the Extreme Admin.
-- Production account status is stored on public.profiles.account_status.

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
    'active_accounts', (
      SELECT count(*)
      FROM public.profiles profile
      WHERE COALESCE(profile.account_status, 'active') = 'active'
    ),
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
    'daily_active_students', (
      SELECT count(DISTINCT presence.user_id)
      FROM public.user_presence presence
      JOIN (
        SELECT user_id FROM public.user_roles WHERE role = 'student'::public.app_role
        UNION
        SELECT user_id FROM public.school_memberships WHERE school_role = 'student' AND status = 'active'
      ) student_accounts ON student_accounts.user_id = presence.user_id
      WHERE presence.last_seen >= (date_trunc('day', now() AT TIME ZONE 'Africa/Addis_Ababa') AT TIME ZONE 'Africa/Addis_Ababa')
    ),
    'weekly_active_students', (
      SELECT count(DISTINCT presence.user_id)
      FROM public.user_presence presence
      JOIN (
        SELECT user_id FROM public.user_roles WHERE role = 'student'::public.app_role
        UNION
        SELECT user_id FROM public.school_memberships WHERE school_role = 'student' AND status = 'active'
      ) student_accounts ON student_accounts.user_id = presence.user_id
      WHERE presence.last_seen >= now() - interval '7 days'
    ),
    'monthly_active_students', (
      SELECT count(DISTINCT presence.user_id)
      FROM public.user_presence presence
      JOIN (
        SELECT user_id FROM public.user_roles WHERE role = 'student'::public.app_role
        UNION
        SELECT user_id FROM public.school_memberships WHERE school_role = 'student' AND status = 'active'
      ) student_accounts ON student_accounts.user_id = presence.user_id
      WHERE presence.last_seen >= now() - interval '30 days'
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
    'active_platform_authorities', (
      SELECT count(DISTINCT roles.user_id)
      FROM public.user_roles roles
      JOIN public.profiles profile ON profile.id = roles.user_id
      WHERE roles.role IN ('extreme_admin'::public.app_role, 'super_admin'::public.app_role)
        AND COALESCE(profile.account_status, 'active') = 'active'
    ),
    'active_managers', (
      SELECT count(*) FROM (
        SELECT roles.user_id
        FROM public.user_roles roles
        JOIN public.profiles profile ON profile.id = roles.user_id
        WHERE roles.role = 'manager'::public.app_role
          AND COALESCE(profile.account_status, 'active') = 'active'
        UNION
        SELECT membership.user_id
        FROM public.school_memberships membership
        JOIN public.profiles profile ON profile.id = membership.user_id
        WHERE membership.school_role = 'manager'
          AND membership.status = 'active'
          AND COALESCE(profile.account_status, 'active') = 'active'
      ) active_manager_accounts
    ),
    'suspended_users', (SELECT count(*) FROM public.profiles WHERE account_status = 'suspended'),
    'banned_users', (SELECT count(*) FROM public.profiles WHERE account_status = 'banned'),
    'audit_events_total', (SELECT count(*) FROM public.admin_audit_logs),
    'audit_events_24h', (SELECT count(*) FROM public.admin_audit_logs WHERE created_at >= now() - interval '24 hours'),
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

-- Keep the production audit RPC's established return contract. Production has
-- one canonical audit store: public.admin_audit_logs.
DROP FUNCTION IF EXISTS public.extreme_admin_get_audit_logs(integer);
CREATE FUNCTION public.extreme_admin_get_audit_logs(p_limit integer DEFAULT 200)
RETURNS TABLE (
  id uuid,
  actor_id uuid,
  actor_name text,
  action text,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT log.id, log.actor_id, profile.name, log.action,
         log.target_type, log.target_id, log.metadata, log.created_at
  FROM public.admin_audit_logs log
  LEFT JOIN public.profiles profile ON profile.id = log.actor_id
  WHERE public._is_extreme_admin()
  ORDER BY log.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500));
$function$;

REVOKE ALL ON FUNCTION public.extreme_admin_get_audit_logs(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_audit_logs(integer) TO authenticated;


-- Keep top-level platform authority accounts out of general suspension/ban
-- controls. A Super Admin may be reactivated, but must be revoked through the
-- singleton authority workflow before it can be suspended or banned.
CREATE OR REPLACE FUNCTION public.extreme_admin_set_user_status(
  p_user_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_target_role public.app_role;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;

  IF p_status NOT IN ('active', 'suspended', 'banned') THEN
    RAISE EXCEPTION 'Invalid account status';
  END IF;
  IF nullif(trim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'An audit reason is required for account status changes';
  END IF;

  SELECT role INTO v_target_role
  FROM public.user_roles
  WHERE user_id = p_user_id
    AND role IN ('extreme_admin'::public.app_role, 'super_admin'::public.app_role)
  LIMIT 1;

  IF v_target_role = 'extreme_admin'::public.app_role THEN
    RAISE EXCEPTION 'The Extreme Admin owner account cannot be changed through general account status controls';
  END IF;

  IF v_target_role = 'super_admin'::public.app_role AND p_status <> 'active' THEN
    RAISE EXCEPTION 'Revoke Super Admin authority before suspending or banning that account';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  -- profiles.account_status is the canonical account-status field in production.
  UPDATE public.profiles
  SET account_status = p_status, updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(), 'set_user_status', 'user', p_user_id,
    jsonb_build_object('status', p_status, 'reason', p_reason)
  );

  RETURN true;
END;
$function$;


-- Enforce audit reasons in the database, not only in the browser form.
CREATE OR REPLACE FUNCTION public.extreme_admin_set_role(
  p_user_id uuid,
  p_role public.app_role,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;
  IF nullif(trim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'An audit reason is required for role changes';
  END IF;
  IF p_role IN ('extreme_admin'::public.app_role, 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Use the dedicated top-level account controls';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id
      AND role IN ('extreme_admin'::public.app_role, 'super_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Top-level account roles cannot be changed here';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (p_user_id, p_role);
  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'root_set_role', 'user', p_user_id,
    jsonb_build_object('role', p_role, 'reason', trim(p_reason)));
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.extreme_admin_set_role(uuid, public.app_role, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_role(uuid, public.app_role, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.extreme_admin_set_super_admin(
  p_user_id uuid,
  p_enabled boolean,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_previous_user_id uuid;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;
  IF nullif(trim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'An audit reason is required for Super Admin authority changes';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A target account is required';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'The Extreme Admin cannot also be the Super Admin';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('master_minds.super_admin.singleton')::bigint);
  IF p_enabled THEN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
      RAISE EXCEPTION 'Target account does not exist';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_user_id AND coalesce(account_status, 'active') = 'active'
    ) THEN
      RAISE EXCEPTION 'The Super Admin account must have an active profile';
    END IF;
    IF private.has_role_for_user(p_user_id, 'extreme_admin'::public.app_role) THEN
      RAISE EXCEPTION 'The Extreme Admin account cannot become Super Admin';
    END IF;
    SELECT user_id INTO v_previous_user_id
    FROM public.user_roles
    WHERE role = 'super_admin'::public.app_role
    FOR UPDATE;
    IF v_previous_user_id IS NOT NULL AND v_previous_user_id <> p_user_id THEN
      DELETE FROM public.user_roles
      WHERE user_id = v_previous_user_id
        AND role = 'super_admin'::public.app_role;
    END IF;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'super_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = 'super_admin'::public.app_role;
  END IF;
  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    CASE WHEN p_enabled THEN 'set_super_admin' ELSE 'revoke_super_admin' END,
    'user',
    p_user_id,
    jsonb_build_object('enabled', p_enabled, 'reason', trim(p_reason), 'replaced_user_id', v_previous_user_id)
  );
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.extreme_admin_set_super_admin(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_super_admin(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.extreme_admin_set_school_status(
  p_school_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;
  IF nullif(trim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'An audit reason is required for school status changes';
  END IF;
  IF p_school_id IS NULL OR p_status NOT IN ('active', 'suspended', 'closed') THEN
    RAISE EXCEPTION 'A valid school and status are required';
  END IF;
  UPDATE public.schools SET status = p_status, updated_at = now() WHERE id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found';
  END IF;
  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(), 'root_set_school_status', 'school', p_school_id,
    jsonb_build_object('status', p_status, 'reason', trim(p_reason))
  );
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.extreme_admin_set_school_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_school_status(uuid, text, text) TO authenticated;


REVOKE ALL ON FUNCTION public.extreme_admin_set_user_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extreme_admin_set_user_status(uuid, text, text) TO authenticated;
