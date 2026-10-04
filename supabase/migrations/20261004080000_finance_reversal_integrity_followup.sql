-- Finance integrity follow-up:
-- Link invoice-payment ledger rows to the exact payment record and reconcile
-- both legs of internal transfers during reversals.

create or replace function public.finance_record_payment(
  p_invoice_id uuid,p_account_id uuid,p_amount numeric,p_method text,
  p_reference text default null,p_notes text default null
)
returns public.finance_payments
language plpgsql security definer set search_path = public
as $$
declare v_invoice public.finance_invoices; v_payment public.finance_payments; v_account public.finance_accounts; v_new_paid numeric;
begin
  if not public.finance_staff() then raise exception 'Finance access denied'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;
  if p_method not in ('cash','bank_transfer','mobile_money','card','other') then raise exception 'Invalid payment method'; end if;
  select * into v_invoice from public.finance_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.status='cancelled' then raise exception 'Cancelled invoice cannot receive payments'; end if;
  if p_amount > (v_invoice.total-v_invoice.amount_paid) then raise exception 'Payment exceeds invoice balance'; end if;
  select * into v_account from public.finance_accounts where id=p_account_id and active=true and account_type in ('cash','bank','mobile_money') for update;
  if not found then raise exception 'Select an active cash, bank or mobile-money account'; end if;
  if v_account.currency <> v_invoice.currency then raise exception 'Payment account currency must match invoice currency'; end if;
  insert into public.finance_payments(invoice_id,account_id,amount,method,reference,notes,received_by)
  values(p_invoice_id,p_account_id,p_amount,p_method,p_reference,p_notes,auth.uid()) returning * into v_payment;
  v_new_paid := v_invoice.amount_paid+p_amount;
  update public.finance_invoices set amount_paid=v_new_paid,status=case when v_new_paid>=total then 'paid' else 'partial' end,updated_at=now() where id=p_invoice_id;
  update public.finance_accounts set current_balance=current_balance+p_amount where id=p_account_id;
  insert into public.finance_transactions(account_id,direction,amount,currency,description,reference_type,reference_id,created_by)
  values(p_account_id,'inflow',p_amount,v_invoice.currency,'Invoice payment '||v_invoice.invoice_number,'invoice_payment',v_payment.id,auth.uid());
  perform public.finance_log_audit('record_payment','invoice',p_invoice_id,jsonb_build_object('amount',p_amount,'method',p_method,'reference',p_reference,'account_id',p_account_id,'payment_id',v_payment.id));
  return v_payment;
end;
$$;

create or replace function public.finance_reverse_transaction(p_transaction_id uuid,p_reason text)
returns public.finance_transactions
language plpgsql security definer set search_path = public
as $$
declare
  v_original public.finance_transactions;
  v_account public.finance_accounts;
  v_reversal public.finance_transactions;
  v_payment public.finance_payments;
  v_invoice public.finance_invoices;
  v_partner public.finance_transactions;
  v_partner_account public.finance_accounts;
  v_partner_reversal public.finance_transactions;
begin
  if not public.finance_staff() then raise exception 'Finance access denied'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A reversal reason is required'; end if;
  select * into v_original from public.finance_transactions where id=p_transaction_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if v_original.status <> 'posted' then raise exception 'Only posted transactions can be reversed'; end if;
  if v_original.reference_type='reversal' then raise exception 'Reversal transaction cannot be reversed again'; end if;
  select * into v_account from public.finance_accounts where id=v_original.account_id and active=true for update;
  if not found then raise exception 'Active finance account not found'; end if;

  if v_original.reference_type='invoice_payment' then
    select * into v_payment from public.finance_payments where id=v_original.reference_id for update;
    if not found then raise exception 'Linked payment record not found'; end if;
    select * into v_invoice from public.finance_invoices where id=v_payment.invoice_id for update;
    if not found then raise exception 'Linked invoice not found'; end if;
    if v_account.current_balance < v_original.amount then raise exception 'Account balance cannot support this reversal'; end if;
    update public.finance_payments set notes=concat_ws(E'\n',notes,'Reversed: '||trim(p_reason)) where id=v_payment.id;
    update public.finance_invoices set amount_paid=greatest(0,amount_paid-v_original.amount),status=case when status='cancelled' then status when greatest(0,amount_paid-v_original.amount)=0 then 'issued' else 'partial' end,updated_at=now() where id=v_invoice.id;
    insert into public.finance_transactions(account_id,category_id,direction,amount,currency,description,reference_type,reference_id,created_by)
    values(v_original.account_id,v_original.category_id,'outflow',v_original.amount,v_original.currency,'Reversal: '||v_original.description,'reversal',v_original.id,auth.uid()) returning * into v_reversal;
    update public.finance_accounts set current_balance=current_balance-v_original.amount where id=v_original.account_id;

  elsif v_original.reference_type='transfer' then
    select * into v_partner from public.finance_transactions
    where reference_type='transfer' and (id=v_original.reference_id or reference_id=v_original.id) and id<>v_original.id and status='posted'
    order by created_at desc limit 1 for update;
    if v_partner.id is null then raise exception 'Linked transfer leg not found'; end if;
    select * into v_partner_account from public.finance_accounts where id=v_partner.account_id and active=true for update;
    if not found then raise exception 'Linked transfer account not found'; end if;
    if v_original.direction='inflow' and v_account.current_balance < v_original.amount then raise exception 'Account balance cannot support this reversal'; end if;
    if v_partner.direction='inflow' and v_partner_account.current_balance < v_partner.amount then raise exception 'Linked transfer account cannot support this reversal'; end if;

    insert into public.finance_transactions(account_id,category_id,direction,amount,currency,description,reference_type,reference_id,created_by)
    values(v_original.account_id,v_original.category_id,case when v_original.direction='inflow' then 'outflow' else 'inflow' end,v_original.amount,v_original.currency,'Reversal: '||v_original.description,'reversal',v_original.id,auth.uid()) returning * into v_reversal;
    insert into public.finance_transactions(account_id,category_id,direction,amount,currency,description,reference_type,reference_id,created_by)
    values(v_partner.account_id,v_partner.category_id,case when v_partner.direction='inflow' then 'outflow' else 'inflow' end,v_partner.amount,v_partner.currency,'Reversal: '||v_partner.description,'reversal',v_partner.id,auth.uid()) returning * into v_partner_reversal;
    update public.finance_accounts set current_balance=current_balance+case when v_original.direction='inflow' then -v_original.amount else v_original.amount end where id=v_original.account_id;
    update public.finance_accounts set current_balance=current_balance+case when v_partner.direction='inflow' then -v_partner.amount else v_partner.amount end where id=v_partner.account_id;
    update public.finance_transactions set status='voided' where id in(v_original.id,v_partner.id);

  else
    if v_original.direction='inflow' and v_account.current_balance < v_original.amount then raise exception 'Account balance cannot support this reversal'; end if;
    insert into public.finance_transactions(account_id,category_id,direction,amount,currency,description,reference_type,reference_id,created_by)
    values(v_original.account_id,v_original.category_id,case when v_original.direction='inflow' then 'outflow' else 'inflow' end,v_original.amount,v_original.currency,'Reversal: '||v_original.description,'reversal',v_original.id,auth.uid()) returning * into v_reversal;
    update public.finance_accounts set current_balance=current_balance+case when v_original.direction='inflow' then -v_original.amount else v_original.amount end where id=v_original.account_id;
  end if;

  update public.finance_transactions set status='voided' where id=v_original.id;
  perform public.finance_log_audit('reverse_transaction','transaction',v_original.id,jsonb_build_object('reversal_id',v_reversal.id,'reason',p_reason,'reference_type',v_original.reference_type));
  return v_reversal;
end;
$$;

revoke all on function public.finance_record_payment(uuid,uuid,numeric,text,text,text) from public;
revoke all on function public.finance_reverse_transaction(uuid,text) from public;
grant execute on function public.finance_record_payment(uuid,uuid,numeric,text,text,text) to authenticated;
grant execute on function public.finance_reverse_transaction(uuid,text) to authenticated;
