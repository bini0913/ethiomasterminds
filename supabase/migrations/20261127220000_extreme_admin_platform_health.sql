-- Part 3: Extreme Admin platform health, incident and maintenance oversight.
-- All operational records are private to the single Extreme Admin and accessed
-- through guarded RPCs. Storage and notification figures are read-only aggregates.

CREATE TABLE IF NOT EXISTS public.platform_health_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_by uuid NOT NULL REFERENCES auth.users(id),
  checked_at timestamptz NOT NULL DEFAULT now(),
  overall_status text NOT NULL CHECK (overall_status IN ('healthy', 'degraded', 'unknown')),
  checks jsonb NOT NULL CHECK (jsonb_typeof(checks) = 'object')
);

CREATE INDEX IF NOT EXISTS platform_health_snapshots_checked_at_idx
  ON public.platform_health_snapshots (checked_at DESC);

ALTER TABLE public.platform_health_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_health_snapshots FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.platform_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 180),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 3 AND 4000),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'monitoring', 'resolved', 'closed')),
  affected_service text NOT NULL DEFAULT 'platform',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'health_check', 'notification', 'provider')),
  opened_by uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  resolved_by uuid REFERENCES auth.users(id),
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS platform_incidents_status_severity_created_idx
  ON public.platform_incidents (status, severity, created_at DESC);

ALTER TABLE public.platform_incidents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_incidents FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.platform_maintenance_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 180),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 3 AND 2000),
  affected_services text[] NOT NULL DEFAULT ARRAY['platform']::text[],
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (cardinality(affected_services) BETWEEN 1 AND 10)
);

CREATE INDEX IF NOT EXISTS platform_maintenance_windows_start_idx
  ON public.platform_maintenance_windows (starts_at DESC);

ALTER TABLE public.platform_maintenance_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_maintenance_windows FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.extreme_admin_record_platform_health_snapshot(p_checks jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_status text := 'unknown';
  v_id bigint;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;
  IF p_checks IS NULL OR jsonb_typeof(p_checks) <> 'object' OR octet_length(p_checks::text) > 20000 THEN
    RAISE EXCEPTION 'A valid health-check object is required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_checks) AS entry(key, value)
    WHERE entry.value->>'status' = 'degraded'
  ) THEN
    v_status := 'degraded';
  ELSIF EXISTS (
    SELECT 1 FROM jsonb_each(p_checks) AS entry(key, value)
    WHERE entry.value->>'status' = 'healthy'
  ) THEN
    v_status := 'healthy';
  END IF;

  INSERT INTO public.platform_health_snapshots(checked_by, overall_status, checks)
  VALUES (auth.uid(), v_status, p_checks)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.extreme_admin_get_platform_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'storage_buckets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'bucket_id', b.id,
        'bucket_name', b.name,
        'object_count', COALESCE(o.object_count, 0),
        'bytes_used', COALESCE(o.bytes_used, 0)
      ) ORDER BY COALESCE(o.bytes_used, 0) DESC, b.name)
      FROM storage.buckets b
      LEFT JOIN LATERAL (
        SELECT count(*)::bigint AS object_count,
          COALESCE(sum(CASE WHEN obj.metadata->>'size' ~ '^[0-9]+$'
            THEN (obj.metadata->>'size')::bigint ELSE 0 END), 0)::bigint AS bytes_used
        FROM storage.objects obj
        WHERE obj.bucket_id = b.id
      ) o ON true
    ), '[]'::jsonb),
    'notification_delivery_24h', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'kind', kind,
        'delivery_status', delivery_status,
        'delivery_reason', delivery_reason,
        'events', events,
        'attempted', attempted,
        'accepted', accepted,
        'failures', failures
      ) ORDER BY kind, delivery_status)
      FROM (
        SELECT COALESCE(kind, 'unspecified') AS kind,
          COALESCE(data->>'delivery_status', 'not_recorded') AS delivery_status,
          data->>'delivery_reason' AS delivery_reason,
          count(*)::bigint AS events,
          COALESCE(sum(CASE WHEN data->>'attempted' ~ '^[0-9]+$' THEN (data->>'attempted')::bigint ELSE 0 END), 0)::bigint AS attempted,
          COALESCE(sum(CASE WHEN data->>'sent' ~ '^[0-9]+$' THEN (data->>'sent')::bigint ELSE 0 END), 0)::bigint AS accepted,
          COALESCE(sum(CASE WHEN data->>'failure_count' ~ '^[0-9]+$' THEN (data->>'failure_count')::bigint ELSE 0 END), 0)::bigint AS failures
        FROM public.notification_events
        WHERE created_at >= now() - interval '24 hours'
        GROUP BY COALESCE(kind, 'unspecified'), COALESCE(data->>'delivery_status', 'not_recorded'), data->>'delivery_reason'
      ) delivery
    ), '[]'::jsonb),
    'provider_failure_codes_24h', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('code', provider_code, 'failures', failures) ORDER BY failures DESC, provider_code)
      FROM (
        SELECT item->>'code' AS provider_code,
          sum(CASE WHEN item->>'count' ~ '^[0-9]+$' THEN (item->>'count')::bigint ELSE 0 END)::bigint AS failures
        FROM public.notification_events AS event
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(event.data->'provider_failure_codes') = 'array'
            THEN event.data->'provider_failure_codes' ELSE '[]'::jsonb END
        ) AS failure_items(item)
        WHERE event.created_at >= now() - interval '24 hours'
        GROUP BY item->>'code'
      ) provider_codes
    ), '[]'::jsonb),
    'recent_snapshots', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'checked_at', checked_at, 'overall_status', overall_status, 'checks', checks
      ) ORDER BY checked_at DESC)
      FROM (
        SELECT id, checked_at, overall_status, checks
        FROM public.platform_health_snapshots
        ORDER BY checked_at DESC
        LIMIT 30
      ) snapshots
    ), '[]'::jsonb),
    'incidents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'description', description, 'severity', severity,
        'status', status, 'affected_service', affected_service, 'source', source,
        'opened_by', opened_by, 'updated_by', updated_by, 'resolved_by', resolved_by,
        'resolution_note', resolution_note, 'created_at', created_at, 'updated_at', updated_at,
        'resolved_at', resolved_at
      ) ORDER BY created_at DESC)
      FROM (
        SELECT * FROM public.platform_incidents
        ORDER BY created_at DESC
        LIMIT 100
      ) incidents
    ), '[]'::jsonb),
    'incident_summary', jsonb_build_object(
      'active', (SELECT count(*) FROM public.platform_incidents WHERE status IN ('open', 'investigating', 'monitoring')),
      'critical_active', (SELECT count(*) FROM public.platform_incidents WHERE severity = 'critical' AND status IN ('open', 'investigating', 'monitoring'))
    ),
    'maintenance_windows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'description', description, 'affected_services', affected_services,
        'starts_at', starts_at, 'ends_at', ends_at, 'status', status,
        'created_by', created_by, 'updated_by', updated_by, 'created_at', created_at, 'updated_at', updated_at
      ) ORDER BY starts_at DESC)
      FROM (
        SELECT * FROM public.platform_maintenance_windows
        ORDER BY starts_at DESC
        LIMIT 50
      ) windows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.extreme_admin_create_platform_incident(
  p_title text,
  p_description text,
  p_severity text,
  p_affected_service text DEFAULT 'platform'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;
  IF length(trim(COALESCE(p_title, ''))) NOT BETWEEN 3 AND 180
    OR length(trim(COALESCE(p_description, ''))) NOT BETWEEN 3 AND 4000 THEN
    RAISE EXCEPTION 'Incident title and description are required';
  END IF;
  IF p_severity NOT IN ('low', 'medium', 'high', 'critical') THEN
    RAISE EXCEPTION 'Invalid incident severity';
  END IF;
  IF length(trim(COALESCE(p_affected_service, ''))) NOT BETWEEN 2 AND 80 THEN
    RAISE EXCEPTION 'A valid affected service is required';
  END IF;

  INSERT INTO public.platform_incidents(title, description, severity, affected_service, opened_by, updated_by)
  VALUES (trim(p_title), trim(p_description), p_severity, trim(p_affected_service), auth.uid(), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'root_create_platform_incident', 'platform_incident', v_id,
    jsonb_build_object('severity', p_severity, 'affected_service', trim(p_affected_service)));

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.extreme_admin_update_platform_incident(
  p_incident_id uuid,
  p_status text,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;
  IF p_status NOT IN ('open', 'investigating', 'monitoring', 'resolved', 'closed') THEN
    RAISE EXCEPTION 'Invalid incident status';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'A documented incident update reason is required';
  END IF;

  UPDATE public.platform_incidents
  SET status = p_status,
      updated_by = auth.uid(),
      updated_at = now(),
      resolution_note = trim(p_reason),
      resolved_by = CASE WHEN p_status IN ('resolved', 'closed') THEN auth.uid() ELSE NULL END,
      resolved_at = CASE WHEN p_status IN ('resolved', 'closed') THEN now() ELSE NULL END
  WHERE id = p_incident_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Platform incident not found';
  END IF;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'root_update_platform_incident', 'platform_incident', p_incident_id,
    jsonb_build_object('status', p_status, 'reason', trim(p_reason)));

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.extreme_admin_create_maintenance_window(
  p_title text,
  p_description text,
  p_affected_services text[],
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;
  IF length(trim(COALESCE(p_title, ''))) NOT BETWEEN 3 AND 180
    OR length(trim(COALESCE(p_description, ''))) NOT BETWEEN 3 AND 2000 THEN
    RAISE EXCEPTION 'Maintenance title and description are required';
  END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'A valid maintenance window is required';
  END IF;
  IF p_affected_services IS NULL OR cardinality(p_affected_services) NOT BETWEEN 1 AND 10
    OR EXISTS (SELECT 1 FROM unnest(p_affected_services) service WHERE length(trim(service)) NOT BETWEEN 2 AND 80) THEN
    RAISE EXCEPTION 'Choose between 1 and 10 valid affected services';
  END IF;

  INSERT INTO public.platform_maintenance_windows(title, description, affected_services, starts_at, ends_at, created_by, updated_by)
  VALUES (trim(p_title), trim(p_description), p_affected_services, p_starts_at, p_ends_at, auth.uid(), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'root_create_maintenance_window', 'platform_maintenance_window', v_id,
    jsonb_build_object('starts_at', p_starts_at, 'ends_at', p_ends_at, 'affected_services', p_affected_services));

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.extreme_admin_update_maintenance_window(
  p_window_id uuid,
  p_status text,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NOT public._is_extreme_admin() THEN
    RAISE EXCEPTION 'Extreme Admin access required';
  END IF;
  IF p_status NOT IN ('scheduled', 'in_progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid maintenance status';
  END IF;
  IF length(trim(COALESCE(p_reason, ''))) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'A maintenance update reason is required';
  END IF;

  UPDATE public.platform_maintenance_windows
  SET status = p_status, updated_by = auth.uid(), updated_at = now()
  WHERE id = p_window_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Maintenance window not found';
  END IF;

  INSERT INTO public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'root_update_maintenance_window', 'platform_maintenance_window', p_window_id,
    jsonb_build_object('status', p_status, 'reason', trim(p_reason)));

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.extreme_admin_record_platform_health_snapshot(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.extreme_admin_get_platform_health() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.extreme_admin_create_platform_incident(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.extreme_admin_update_platform_incident(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.extreme_admin_create_maintenance_window(text, text, text[], timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.extreme_admin_update_maintenance_window(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.extreme_admin_record_platform_health_snapshot(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_get_platform_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_create_platform_incident(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_update_platform_incident(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_create_maintenance_window(text, text, text[], timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extreme_admin_update_maintenance_window(uuid, text, text) TO authenticated;
