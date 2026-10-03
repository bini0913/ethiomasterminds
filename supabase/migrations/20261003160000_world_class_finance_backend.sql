-- World-class Finance Portal foundation: dedicated finance role,
-- explicit payment accounts, atomic ledger operations, reversals, transfers,
-- overdue synchronization and audited finance actions.

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.finance_payments
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.finance_accounts(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS finance_payments_account_idx
  ON public.finance_payments(account_id);

CREATE OR REPLACE FUNCTION public.finance_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('finance'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role, 'extreme_admin'::public.app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.finance_log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.finance_staff() THEN
    RAISE EXCEPTION 'Finance access denied';
  END IF;

  INSERT INTO public.finance_audit_log(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, COALESCE(p_details, '{}'::jsonb));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_sync_overdue_invoices()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.finance_staff() THEN
    RAISE EXCEPTION 'Finance access denied';
  END IF;

  UPDATE public.finance_invoices
  SET status = 'overdue', updated_at = now()
  WHERE status IN ('issued','partial')
    AND due_date IS NOT NULL
    AND due_date < current_date
    AND amount_paid < total;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_record_transaction(
  p_account_id uuid,
  p_category_id uuid,
  p_direction text,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS public.finance_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account public.finance_accounts;
  v_transaction public.finance_transactions;
BEGIN
  IF NOT public.finance_staff() THEN RAISE EXCEPTION 'Finance access denied'; END IF;
  IF p_direction NOT IN ('inflow','outflow') THEN RAISE EXCEPTION 'Invalid transaction direction'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF nullif(trim(p_description),'') IS NULL THEN RAISE EXCEPTION 'Description is required'; END IF;

  SELECT * INTO v_account
  FROM public.finance_accounts
  WHERE id = p_account_id AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Active finance account not found'; END IF;
  IF v_account.currency <> COALESCE(NULLIF(p_currency,''), v_account.currency) THEN
    RAISE EXCEPTION 'Transaction currency must match account currency';
  END IF;
  IF p_direction = 'outflow' AND v_account.current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient account balance';
  END IF;

  INSERT INTO public.finance_transactions(
    account_id, category_id, direction, amount, currency, description, occurred_at, created_by
  )
  VALUES (
    p_account_id, p_category_id, p_direction, p_amount, v_account.currency,
    trim(p_description), COALESCE(p_occurred_at, now()), auth.uid()
  )
  RETURNING * INTO v_transaction;

  UPDATE public.finance_accounts
  SET current_balance = current_balance + CASE WHEN p_direction='inflow' THEN p_amount ELSE -p_amount END
  WHERE id = p_account_id;

  INSERT INTO public.finance_audit_log(actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), 'record_transaction', 'transaction', v_transaction.id,
    jsonb_build_object('direction',p_direction,'amount',p_amount,'account_id',p_account_id)
  );

  RETURN v_transaction;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_description text,
  p_occurred_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_from public.finance_accounts;
  v_to public.finance_accounts;
  v_out public.finance_transactions;
  v_in public.finance_transactions;
BEGIN
  IF NOT public.finance_staff() THEN RAISE EXCEPTION 'Finance access denied'; END IF;
  IF p_from_account_id = p_to_account_id THEN RAISE EXCEPTION 'Choose two different accounts'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF nullif(trim(p_description),'') IS NULL THEN RAISE EXCEPTION 'Description is required'; END IF;

  SELECT * INTO v_from FROM public.finance_accounts WHERE id=p_from_account_id AND active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source account not found'; END IF;
  SELECT * INTO v_to FROM public.finance_accounts WHERE id=p_to_account_id AND active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destination account not found'; END IF;
  IF v_from.currency <> v_to.currency THEN RAISE EXCEPTION 'Transfers require matching currencies'; END IF;
  IF v_from.current_balance < p_amount THEN RAISE EXCEPTION 'Insufficient source balance'; END IF;

  INSERT INTO public.finance_transactions(account_id,direction,amount,currency,description,reference_type,created_by,occurred_at)
  VALUES(p_from_account_id,'outflow',p_amount,v_from.currency,trim(p_description),'transfer',auth.uid(),COALESCE(p_occurred_at,now()))
  RETURNING * INTO v_out;

  INSERT INTO public.finance_transactions(account_id,direction,amount,currency,description,reference_type,reference_id,created_by,occurred_at)
  VALUES(p_to_account_id,'inflow',p_amount,v_to.currency,trim(p_description),'transfer',v_out.id,auth.uid(),COALESCE(p_occurred_at,now()))
  RETURNING * INTO v_in;

  UPDATE public.finance_accounts SET current_balance=current_balance-p_amount WHERE id=p_from_account_id;
  UPDATE public.finance_accounts SET current_balance=current_balance+p_amount WHERE id=p_to_account_id;

  INSERT INTO public.finance_audit_log(actor_id,action,entity_type,entity_id,details)
  VALUES(auth.uid(),'transfer_between_accounts','transaction',v_out.id,
    jsonb_build_object('from_account_id',p_from_account_id,'to_account_id',p_to_account_id,'amount',p_amount,'inflow_transaction_id',v_in.id));

  RETURN jsonb_build_object('outflow',to_jsonb(v_out),'inflow',to_jsonb(v_in));
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_record_payment(
  p_invoice_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.finance_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invoice public.finance_invoices;
  v_payment public.finance_payments;
  v_account public.finance_accounts;
  v_new_paid numeric;
BEGIN
  IF NOT public.finance_staff() THEN RAISE EXCEPTION 'Finance access denied'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be positive'; END IF;
  IF p_method NOT IN ('cash','bank_transfer','mobile_money','card','other') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;

  SELECT * INTO v_invoice FROM public.finance_invoices WHERE id=p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_invoice.status='cancelled' THEN RAISE EXCEPTION 'Cancelled invoice cannot receive payments'; END IF;
  IF p_amount > (v_invoice.total-v_invoice.amount_paid) THEN RAISE EXCEPTION 'Payment exceeds invoice balance'; END IF;

  SELECT * INTO v_account
  FROM public.finance_accounts
  WHERE id=p_account_id AND active=true
    AND account_type IN ('cash','bank','mobile_money')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Select an active cash, bank or mobile-money account'; END IF;
  IF v_account.currency <> v_invoice.currency THEN RAISE EXCEPTION 'Payment account currency must match invoice currency'; END IF;

  INSERT INTO public.finance_payments(invoice_id,account_id,amount,method,reference,notes,received_by)
  VALUES(p_invoice_id,p_account_id,p_amount,p_method,p_reference,p_notes,auth.uid())
  RETURNING * INTO v_payment;

  v_new_paid := v_invoice.amount_paid+p_amount;

  UPDATE public.finance_invoices
  SET amount_paid=v_new_paid,
      status=CASE WHEN v_new_paid>=total THEN 'paid' ELSE 'partial' END,
      updated_at=now()
  WHERE id=p_invoice_id;

  UPDATE public.finance_accounts
  SET current_balance=current_balance+p_amount
  WHERE id=p_account_id;

  INSERT INTO public.finance_transactions(
    account_id,direction,amount,currency,description,reference_type,reference_id,created_by
  )
  VALUES(
    p_account_id,'inflow',p_amount,v_invoice.currency,
    'Invoice payment '||v_invoice.invoice_number,'invoice_payment',p_invoice_id,auth.uid()
  );

  INSERT INTO public.finance_audit_log(actor_id,action,entity_type,entity_id,details)
  VALUES(auth.uid(),'record_payment','invoice',p_invoice_id,
    jsonb_build_object('amount',p_amount,'method',p_method,'reference',p_reference,'account_id',p_account_id));

  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_reverse_transaction(
  p_transaction_id uuid,
  p_reason text
)
RETURNS public.finance_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_original public.finance_transactions;
  v_account public.finance_accounts;
  v_reversal public.finance_transactions;
BEGIN
  IF NOT public.finance_staff() THEN RAISE EXCEPTION 'Finance access denied'; END IF;
  IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'A reversal reason is required'; END IF;

  SELECT * INTO v_original FROM public.finance_transactions WHERE id=p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_original.status <> 'posted' THEN RAISE EXCEPTION 'Only posted transactions can be reversed'; END IF;
  IF v_original.reference_type = 'reversal' THEN RAISE EXCEPTION 'Reversal transaction cannot be reversed again'; END IF;

  SELECT * INTO v_account FROM public.finance_accounts WHERE id=v_original.account_id AND active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active finance account not found'; END IF;

  IF v_original.direction='inflow' AND v_account.current_balance < v_original.amount THEN
    RAISE EXCEPTION 'Account balance cannot support this reversal';
  END IF;

  INSERT INTO public.finance_transactions(
    account_id,category_id,direction,amount,currency,description,reference_type,reference_id,created_by
  )
  VALUES(
    v_original.account_id,v_original.category_id,
    CASE WHEN v_original.direction='inflow' THEN 'outflow' ELSE 'inflow' END,
    v_original.amount,v_original.currency,
    'Reversal: '||v_original.description,'reversal',v_original.id,auth.uid()
  )
  RETURNING * INTO v_reversal;

  UPDATE public.finance_accounts
  SET current_balance=current_balance+
    CASE WHEN v_original.direction='inflow' THEN -v_original.amount ELSE v_original.amount END
  WHERE id=v_original.account_id;

  UPDATE public.finance_transactions SET status='voided' WHERE id=v_original.id;

  INSERT INTO public.finance_audit_log(actor_id,action,entity_type,entity_id,details)
  VALUES(auth.uid(),'reverse_transaction','transaction',v_original.id,
    jsonb_build_object('reversal_id',v_reversal.id,'reason',p_reason));

  RETURN v_reversal;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_log_audit(text,text,uuid,jsonb) FROM public;
REVOKE ALL ON FUNCTION public.finance_sync_overdue_invoices() FROM public;
REVOKE ALL ON FUNCTION public.finance_record_transaction(uuid,uuid,text,numeric,text,text,timestamptz) FROM public;
REVOKE ALL ON FUNCTION public.finance_transfer(uuid,uuid,numeric,text,timestamptz) FROM public;
REVOKE ALL ON FUNCTION public.finance_record_payment(uuid,uuid,numeric,text,text,text) FROM public;
REVOKE ALL ON FUNCTION public.finance_reverse_transaction(uuid,text) FROM public;

GRANT EXECUTE ON FUNCTION public.finance_log_audit(text,text,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_sync_overdue_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_record_transaction(uuid,uuid,text,numeric,text,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_transfer(uuid,uuid,numeric,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_record_payment(uuid,uuid,numeric,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finance_reverse_transaction(uuid,text) TO authenticated;
