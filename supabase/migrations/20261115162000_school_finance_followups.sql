CREATE TABLE IF NOT EXISTS public.school_finance_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL,
  student_membership_id uuid NOT NULL,
  submitted_by_membership_id uuid NOT NULL,
  note text NOT NULL CHECK (char_length(trim(note)) BETWEEN 3 AND 3000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'resolved')),
  reviewed_by_membership_id uuid,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (invoice_id, school_id) REFERENCES public.school_student_invoices(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (student_membership_id, school_id) REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (submitted_by_membership_id, school_id) REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (reviewed_by_membership_id, school_id) REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS school_finance_followups_school_status_idx
  ON public.school_finance_followups(school_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.school_can_view_finance_followup(p_followup_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_finance_followups followup
    WHERE followup.id = p_followup_id
      AND (
        public._is_extreme_admin()
        OR public.school_is_finance(followup.school_id)
        OR public.is_school_manager_or_admin(followup.school_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_send_fee_reminder(
  p_invoice_id uuid, p_message text DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice public.school_student_invoices%ROWTYPE;
  v_count integer;
BEGIN
  SELECT * INTO v_invoice FROM public.school_student_invoices
  WHERE id = p_invoice_id FOR UPDATE;
  IF v_invoice.id IS NULL OR NOT public.school_is_finance(v_invoice.school_id) THEN
    RAISE EXCEPTION 'School Finance permission required';
  END IF;
  IF v_invoice.balance <= 0 THEN
    RAISE EXCEPTION 'This invoice has no outstanding balance';
  END IF;
  INSERT INTO public.school_parent_notifications(
    school_id, parent_membership_id, student_membership_id,
    notification_type, title, message
  )
  SELECT link.school_id, link.parent_membership_id, v_invoice.student_membership_id,
         'fee', 'School fee payment reminder',
         coalesce(nullif(trim(p_message), ''),
           'Reminder: invoice ' || v_invoice.invoice_number || ' has an outstanding balance of ' ||
           v_invoice.currency || ' ' || v_invoice.balance::text || '.')
  FROM public.school_parent_student_links link
  WHERE link.school_id = v_invoice.school_id
    AND link.student_membership_id = v_invoice.student_membership_id
    AND link.status = 'active';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RAISE EXCEPTION 'No active parent account is linked to this student'; END IF;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_report_unpaid_invoice_to_admin(
  p_invoice_id uuid, p_note text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice public.school_student_invoices%ROWTYPE;
  v_actor uuid;
  v_followup_id uuid;
BEGIN
  SELECT * INTO v_invoice FROM public.school_student_invoices
  WHERE id = p_invoice_id FOR UPDATE;
  IF v_invoice.id IS NULL OR NOT public.school_is_finance(v_invoice.school_id) THEN
    RAISE EXCEPTION 'School Finance permission required';
  END IF;
  IF v_invoice.balance <= 0 THEN RAISE EXCEPTION 'Invoice is already paid'; END IF;
  v_actor := public.school_my_membership_id(v_invoice.school_id);
  INSERT INTO public.school_finance_followups(
    school_id, invoice_id, student_membership_id, submitted_by_membership_id, note
  ) VALUES (
    v_invoice.school_id, v_invoice.id, v_invoice.student_membership_id, v_actor, trim(p_note)
  )
  RETURNING id INTO v_followup_id;
  RETURN v_followup_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_resolve_finance_followup(
  p_followup_id uuid, p_note text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_followup public.school_finance_followups%ROWTYPE;
  v_actor uuid;
BEGIN
  SELECT * INTO v_followup FROM public.school_finance_followups
  WHERE id = p_followup_id FOR UPDATE;
  IF v_followup.id IS NULL OR NOT public.is_school_manager_or_admin(v_followup.school_id) THEN
    RAISE EXCEPTION 'School Admin or Manager permission required';
  END IF;
  v_actor := public.school_my_membership_id(v_followup.school_id);
  UPDATE public.school_finance_followups
  SET status = 'resolved', reviewed_by_membership_id = v_actor,
      reviewed_at = now(), resolution_note = nullif(trim(p_note), '')
  WHERE id = p_followup_id AND status <> 'resolved';
  RETURN FOUND;
END;
$$;

ALTER TABLE public.school_finance_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_finance_followups_read ON public.school_finance_followups
FOR SELECT TO authenticated USING (public.school_can_view_finance_followup(id));

GRANT SELECT ON public.school_finance_followups TO authenticated;

REVOKE ALL ON FUNCTION public.school_can_view_finance_followup(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_send_fee_reminder(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_report_unpaid_invoice_to_admin(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_resolve_finance_followup(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.school_can_view_finance_followup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_send_fee_reminder(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_report_unpaid_invoice_to_admin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_resolve_finance_followup(uuid, text) TO authenticated;
