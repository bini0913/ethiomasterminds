-- School fee structures, student invoices, payment ledger, receipts, and audit.
-- These tables are school-scoped and do not alter Individual Learning subscription finance.

CREATE TABLE IF NOT EXISTS public.school_fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  academic_year_id uuid NOT NULL,
  grade_label text NOT NULL,
  fee_name text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'ETB' CHECK (currency ~ '^[A-Z]{3}$'),
  due_date date,
  is_mandatory boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year_id, grade_label, fee_name),
  UNIQUE (id, school_id),
  FOREIGN KEY (academic_year_id, school_id)
    REFERENCES public.school_academic_years(id, school_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.school_student_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  fee_structure_id uuid NOT NULL,
  student_membership_id uuid NOT NULL,
  academic_year_id uuid NOT NULL,
  invoice_number text NOT NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  paid_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  balance numeric(12,2) NOT NULL CHECK (balance >= 0),
  currency text NOT NULL DEFAULT 'ETB' CHECK (currency ~ '^[A-Z]{3}$'),
  due_date date,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, invoice_number),
  UNIQUE (fee_structure_id, student_membership_id),
  UNIQUE (id, school_id),
  FOREIGN KEY (fee_structure_id, school_id)
    REFERENCES public.school_fee_structures(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (student_membership_id, school_id)
    REFERENCES public.school_memberships(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (academic_year_id, school_id)
    REFERENCES public.school_academic_years(id, school_id) ON DELETE RESTRICT,
  CHECK (paid_amount <= amount),
  CHECK (balance = amount - paid_amount)
);

CREATE TABLE IF NOT EXISTS public.school_fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL
    CHECK (payment_method IN ('cash', 'bank_transfer', 'mobile_money', 'other')),
  reference text,
  receipt_number text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'reversed')),
  reversal_reason text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (invoice_id, school_id)
    REFERENCES public.school_student_invoices(id, school_id) ON DELETE RESTRICT,
  UNIQUE (school_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS public.school_invoice_sequences (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE RESTRICT,
  next_number bigint NOT NULL DEFAULT 1 CHECK (next_number > 0)
);

CREATE TABLE IF NOT EXISTS public.school_receipt_sequences (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE RESTRICT,
  next_number bigint NOT NULL DEFAULT 1 CHECK (next_number > 0)
);

CREATE TABLE IF NOT EXISTS public.school_finance_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('fee_structure', 'invoice', 'payment')),
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS school_fee_structures_grade_idx
  ON public.school_fee_structures(school_id, academic_year_id, grade_label, active);
CREATE INDEX IF NOT EXISTS school_student_invoices_student_idx
  ON public.school_student_invoices(student_membership_id, status, due_date);
CREATE INDEX IF NOT EXISTS school_fee_payments_invoice_idx
  ON public.school_fee_payments(invoice_id, status, received_at);
CREATE INDEX IF NOT EXISTS school_finance_audit_school_idx
  ON public.school_finance_audit_events(school_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.school_is_finance(p_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public._is_extreme_admin()
    OR public.is_active_school_member(p_school_id, ARRAY['finance']::text[]);
$$;

CREATE OR REPLACE FUNCTION public.school_is_manager(p_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $
  SELECT public._is_extreme_admin()
    OR public.is_active_school_member(p_school_id, ARRAY['manager']::text[]);
$;

CREATE OR REPLACE FUNCTION public.school_can_view_school_finance(p_school_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $
  SELECT public._is_extreme_admin()
    OR public.is_school_manager_or_admin(p_school_id)
    OR public.school_is_finance(p_school_id);
$;

CREATE OR REPLACE FUNCTION public.school_can_view_invoice(p_invoice_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_student_invoices invoice
    JOIN public.school_memberships student ON student.id = invoice.student_membership_id
    WHERE invoice.id = p_invoice_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(invoice.school_id)
        OR public.school_is_finance(invoice.school_id)
        OR EXISTS (
          SELECT 1
          FROM public.school_parent_student_links link
          JOIN public.school_memberships parent ON parent.id = link.parent_membership_id
          WHERE link.student_membership_id = student.id
            AND link.status = 'active'
            AND parent.user_id = auth.uid()
            AND parent.school_role = 'parent'
            AND parent.status = 'active'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_can_view_payment(p_payment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.school_fee_payments payment
    JOIN public.school_student_invoices invoice ON invoice.id = payment.invoice_id
    JOIN public.school_memberships student ON student.id = invoice.student_membership_id
    WHERE payment.id = p_payment_id
      AND (
        public._is_extreme_admin()
        OR public.is_school_manager_or_admin(payment.school_id)
        OR public.school_is_finance(payment.school_id)
        OR EXISTS (
          SELECT 1
          FROM public.school_parent_student_links link
          JOIN public.school_memberships parent ON parent.id = link.parent_membership_id
          WHERE link.student_membership_id = student.id
            AND link.status = 'active'
            AND parent.user_id = auth.uid()
            AND parent.school_role = 'parent'
            AND parent.status = 'active'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.school_next_invoice_number(p_school_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_number bigint;
  v_code text;
BEGIN
  IF NOT public.school_is_finance(p_school_id) THEN
    RAISE EXCEPTION 'School Finance permission required';
  END IF;
  SELECT school_code INTO v_code FROM public.schools WHERE id = p_school_id;
  INSERT INTO public.school_invoice_sequences(school_id, next_number)
  VALUES (p_school_id, 2)
  ON CONFLICT (school_id)
  DO UPDATE SET next_number = public.school_invoice_sequences.next_number + 1
  RETURNING next_number - 1 INTO v_number;
  RETURN v_code || '-INV-' || lpad(v_number::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.school_next_receipt_number(p_school_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_number bigint;
  v_code text;
BEGIN
  IF NOT public.school_is_finance(p_school_id) THEN
    RAISE EXCEPTION 'School Finance permission required';
  END IF;
  SELECT school_code INTO v_code FROM public.schools WHERE id = p_school_id;
  INSERT INTO public.school_receipt_sequences(school_id, next_number)
  VALUES (p_school_id, 2)
  ON CONFLICT (school_id)
  DO UPDATE SET next_number = public.school_receipt_sequences.next_number + 1
  RETURNING next_number - 1 INTO v_number;
  RETURN v_code || '-RCT-' || lpad(v_number::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.school_generate_student_invoices(
  p_fee_structure_id uuid, p_section_id uuid DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_fee public.school_fee_structures%ROWTYPE;
  v_count integer := 0;
BEGIN
  SELECT * INTO v_fee FROM public.school_fee_structures
  WHERE id = p_fee_structure_id AND active = true;
  IF v_fee.id IS NULL OR NOT public.school_is_finance(v_fee.school_id) THEN
    RAISE EXCEPTION 'Active fee structure and School Finance permission required';
  END IF;
  IF p_section_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.school_sections section
    WHERE section.id = p_section_id
      AND section.school_id = v_fee.school_id
      AND section.grade_label = v_fee.grade_label
      AND section.academic_year_id = v_fee.academic_year_id
  ) THEN
    RAISE EXCEPTION 'Selected section does not match this fee structure';
  END IF;

  INSERT INTO public.school_student_invoices(
    school_id, fee_structure_id, student_membership_id, academic_year_id,
    invoice_number, description, amount, paid_amount, balance, currency, due_date, created_by
  )
  SELECT
    v_fee.school_id, v_fee.id, student.id, v_fee.academic_year_id,
    public.school_next_invoice_number(v_fee.school_id),
    v_fee.fee_name, v_fee.amount, 0, v_fee.amount, v_fee.currency, v_fee.due_date, auth.uid()
  FROM public.school_memberships student
  JOIN public.school_sections section
    ON section.id = student.section_id
   AND section.school_id = student.school_id
  WHERE student.school_id = v_fee.school_id
    AND student.school_role = 'student'
    AND student.status IN ('active', 'suspended')
    AND student.grade_label = v_fee.grade_label
    AND section.academic_year_id = v_fee.academic_year_id
    AND (p_section_id IS NULL OR section.id = p_section_id)
  ON CONFLICT (fee_structure_id, student_membership_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_record_fee_payment(
  p_invoice_id uuid, p_amount numeric, p_payment_method text, p_reference text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice public.school_student_invoices%ROWTYPE;
  v_payment_id uuid;
  v_receipt text;
BEGIN
  SELECT * INTO v_invoice FROM public.school_student_invoices
  WHERE id = p_invoice_id FOR UPDATE;
  IF v_invoice.id IS NULL OR NOT public.school_is_finance(v_invoice.school_id) THEN
    RAISE EXCEPTION 'School Finance permission required for this invoice';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > v_invoice.balance THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero and no more than the outstanding balance';
  END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'bank_transfer', 'mobile_money', 'other') THEN
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;

  v_receipt := public.school_next_receipt_number(v_invoice.school_id);
  INSERT INTO public.school_fee_payments(
    school_id, invoice_id, amount, payment_method, reference, receipt_number, recorded_by
  )
  VALUES (
    v_invoice.school_id, v_invoice.id, p_amount, p_payment_method,
    nullif(trim(p_reference), ''), v_receipt, auth.uid()
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_reverse_fee_payment(
  p_payment_id uuid, p_reason text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment public.school_fee_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_payment FROM public.school_fee_payments
  WHERE id = p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL OR NOT public.school_is_finance(v_payment.school_id) THEN
    RAISE EXCEPTION 'School Finance permission required to reverse this payment';
  END IF;
  IF v_payment.status <> 'confirmed' OR nullif(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A confirmed payment and a reversal reason are required';
  END IF;
  UPDATE public.school_fee_payments
  SET status = 'reversed', reversal_reason = trim(p_reason)
  WHERE id = p_payment_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_protect_invoice_ledger_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF ROW(NEW.school_id, NEW.fee_structure_id, NEW.student_membership_id, NEW.academic_year_id,
         NEW.invoice_number, NEW.description, NEW.amount, NEW.currency, NEW.due_date, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.school_id, OLD.fee_structure_id, OLD.student_membership_id, OLD.academic_year_id,
         OLD.invoice_number, OLD.description, OLD.amount, OLD.currency, OLD.due_date, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'Invoice identity and amount are immutable after creation';
  END IF;
  IF NEW.paid_amount IS DISTINCT FROM OLD.paid_amount
     OR NEW.balance IS DISTINCT FROM OLD.balance
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF coalesce(current_setting('app.school_invoice_ledger_update', true), '') <> 'true' THEN
      RAISE EXCEPTION 'Invoice payment totals are controlled by the payment ledger';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_recalculate_invoice_guarded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice_id uuid := coalesce(NEW.invoice_id, OLD.invoice_id);
  v_paid numeric(12,2);
BEGIN
  SELECT coalesce(sum(amount), 0) INTO v_paid
  FROM public.school_fee_payments
  WHERE invoice_id = v_invoice_id AND status = 'confirmed';

  PERFORM set_config('app.school_invoice_ledger_update', 'true', true);
  UPDATE public.school_student_invoices
  SET paid_amount = v_paid,
      balance = amount - v_paid,
      status = CASE WHEN v_paid = amount THEN 'paid'
                    WHEN v_paid > 0 THEN 'partial'
                    ELSE 'unpaid' END,
      updated_at = now()
  WHERE id = v_invoice_id;
  PERFORM set_config('app.school_invoice_ledger_update', '', true);
  RETURN coalesce(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.school_notify_parent_invoice_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.school_parent_notifications(
    school_id, parent_membership_id, student_membership_id, notification_type, title, message
  )
  SELECT link.school_id, link.parent_membership_id, NEW.student_membership_id,
         'fee', 'School fee issued',
         'A new fee invoice ' || NEW.invoice_number || ' is available. Outstanding balance: ' ||
         NEW.currency || ' ' || NEW.balance::text || '.'
  FROM public.school_parent_student_links link
  WHERE link.student_membership_id = NEW.student_membership_id
    AND link.status = 'active';
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_notify_parent_payment_recorded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invoice public.school_student_invoices%ROWTYPE;
BEGIN
  IF NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT * INTO v_invoice FROM public.school_student_invoices WHERE id = NEW.invoice_id;
    INSERT INTO public.school_parent_notifications(
      school_id, parent_membership_id, student_membership_id, notification_type, title, message
    )
    SELECT link.school_id, link.parent_membership_id, v_invoice.student_membership_id,
           'fee', 'School payment recorded',
           'Payment receipt ' || NEW.receipt_number || ' for ' || v_invoice.currency || ' ' || NEW.amount::text || ' was recorded.'
    FROM public.school_parent_student_links link
    WHERE link.student_membership_id = v_invoice.student_membership_id
      AND link.status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.school_record_finance_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school_id uuid;
  v_entity_id uuid;
  v_event_type text;
  v_details jsonb;
  v_entity_type text;
BEGIN
  IF TG_TABLE_NAME = 'school_fee_structures' THEN
    v_school_id := NEW.school_id;
    v_entity_id := NEW.id;
    v_entity_type := 'fee_structure';
    v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'fee_structure_created' ELSE 'fee_structure_updated' END;
    v_details := jsonb_build_object('grade', NEW.grade_label, 'fee_name', NEW.fee_name, 'amount', NEW.amount, 'currency', NEW.currency);
  ELSIF TG_TABLE_NAME = 'school_student_invoices' THEN
    v_school_id := NEW.school_id;
    v_entity_id := NEW.id;
    v_entity_type := 'invoice';
    v_event_type := 'invoice_created';
    v_details := jsonb_build_object('student_membership_id', NEW.student_membership_id, 'invoice_number', NEW.invoice_number, 'amount', NEW.amount);
  ELSE
    v_school_id := NEW.school_id;
    v_entity_id := NEW.id;
    v_entity_type := 'payment';
    v_event_type := CASE WHEN TG_OP = 'INSERT' THEN 'payment_recorded' ELSE 'payment_updated' END;
    v_details := jsonb_build_object('invoice_id', NEW.invoice_id, 'amount', NEW.amount, 'status', NEW.status, 'receipt_number', NEW.receipt_number);
  END IF;
  INSERT INTO public.school_finance_audit_events(school_id, actor_id, entity_type, entity_id, event_type, details)
  VALUES (v_school_id, auth.uid(), v_entity_type, v_entity_id, v_event_type, v_details);
  RETURN NEW;
END;
$$;

ALTER TABLE public.school_fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_student_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_receipt_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_finance_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.school_invoice_sequences, public.school_receipt_sequences FROM PUBLIC, anon, authenticated;

CREATE POLICY school_fee_structures_read ON public.school_fee_structures
FOR SELECT TO authenticated
USING (public.school_can_view_school_finance(school_id));
CREATE POLICY school_fee_structures_manager_insert ON public.school_fee_structures
FOR INSERT TO authenticated WITH CHECK (public.school_is_manager(school_id));
CREATE POLICY school_fee_structures_manager_update ON public.school_fee_structures
FOR UPDATE TO authenticated USING (public.is_school_manager(school_id))
WITH CHECK (public.is_school_manager(school_id));

CREATE POLICY school_student_invoices_read ON public.school_student_invoices
FOR SELECT TO authenticated USING (public.school_can_view_invoice(id));

CREATE POLICY school_fee_payments_read ON public.school_fee_payments
FOR SELECT TO authenticated USING (public.school_can_view_payment(id));

CREATE POLICY school_finance_audit_read ON public.school_finance_audit_events
FOR SELECT TO authenticated
USING (
  public._is_extreme_admin()
  OR public.is_school_manager_or_admin(school_id)
  OR public.school_is_finance(school_id)
);

GRANT SELECT, INSERT, UPDATE ON public.school_fee_structures TO authenticated;
GRANT SELECT ON public.school_student_invoices TO authenticated;
GRANT SELECT ON public.school_fee_payments TO authenticated;
GRANT SELECT ON public.school_finance_audit_events TO authenticated;

DROP TRIGGER IF EXISTS school_invoice_ledger_protect ON public.school_student_invoices;
CREATE TRIGGER school_invoice_ledger_protect
BEFORE UPDATE ON public.school_student_invoices
FOR EACH ROW EXECUTE FUNCTION public.school_protect_invoice_ledger_fields();

DROP TRIGGER IF EXISTS school_fee_payment_recalculate_invoice ON public.school_fee_payments;
CREATE TRIGGER school_fee_payment_recalculate_invoice
AFTER INSERT OR UPDATE OF status ON public.school_fee_payments
FOR EACH ROW EXECUTE FUNCTION public.school_recalculate_invoice_guarded();

DROP TRIGGER IF EXISTS school_invoice_notify_parent ON public.school_student_invoices;
CREATE TRIGGER school_invoice_notify_parent
AFTER INSERT ON public.school_student_invoices
FOR EACH ROW EXECUTE FUNCTION public.school_notify_parent_invoice_created();

DROP TRIGGER IF EXISTS school_payment_notify_parent ON public.school_fee_payments;
CREATE TRIGGER school_payment_notify_parent
AFTER INSERT OR UPDATE OF status ON public.school_fee_payments
FOR EACH ROW EXECUTE FUNCTION public.school_notify_parent_payment_recorded();

DROP TRIGGER IF EXISTS school_fee_structure_audit ON public.school_fee_structures;
CREATE TRIGGER school_fee_structure_audit
AFTER INSERT OR UPDATE ON public.school_fee_structures
FOR EACH ROW EXECUTE FUNCTION public.school_record_finance_audit();

DROP TRIGGER IF EXISTS school_invoice_audit ON public.school_student_invoices;
CREATE TRIGGER school_invoice_audit
AFTER INSERT ON public.school_student_invoices
FOR EACH ROW EXECUTE FUNCTION public.school_record_finance_audit();

DROP TRIGGER IF EXISTS school_payment_audit ON public.school_fee_payments;
CREATE TRIGGER school_payment_audit
AFTER INSERT OR UPDATE OF status ON public.school_fee_payments
FOR EACH ROW EXECUTE FUNCTION public.school_record_finance_audit();

REVOKE ALL ON FUNCTION public.school_is_finance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_invoice(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_payment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_next_invoice_number(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_next_receipt_number(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_generate_student_invoices(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_record_fee_payment(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_reverse_fee_payment(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_recalculate_invoice_guarded() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_protect_invoice_ledger_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_is_manager(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_can_view_school_finance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_notify_parent_invoice_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_notify_parent_payment_recorded() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.school_record_finance_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.school_is_finance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_is_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_school_finance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_can_view_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_generate_student_invoices(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_record_fee_payment(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_reverse_fee_payment(uuid, text) TO authenticated;
