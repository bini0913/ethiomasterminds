-- Finance portal: school finance operations, invoices, payments, budgets and audit trail
create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_type text not null check (account_type in ('cash','bank','mobile_money','receivable','other')),
  currency text not null default 'ETB',
  opening_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category_type text not null check (category_type in ('income','expense')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.finance_accounts(id) on delete restrict,
  category_id uuid references public.finance_categories(id) on delete set null,
  direction text not null check (direction in ('inflow','outflow')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'ETB',
  description text not null,
  reference_type text,
  reference_id uuid,
  status text not null default 'posted' check (status in ('posted','voided')),
  occurred_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.finance_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  student_id uuid not null references public.profiles(id) on delete restrict,
  description text not null,
  currency text not null default 'ETB',
  subtotal numeric(14,2) not null check (subtotal >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  total numeric(14,2) not null check (total >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  due_date date,
  status text not null default 'issued' check (status in ('draft','issued','partial','paid','overdue','cancelled')),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_paid <= total)
);

create table if not exists public.finance_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.finance_invoices(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  method text not null check (method in ('cash','bank_transfer','mobile_money','card','other')),
  reference text,
  notes text,
  paid_at timestamptz not null default now(),
  received_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.finance_categories(id) on delete set null,
  name text not null,
  period_start date not null,
  period_end date not null,
  amount numeric(14,2) not null check (amount >= 0),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.finance_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists finance_transactions_occurred_at_idx on public.finance_transactions(occurred_at desc);
create index if not exists finance_transactions_category_idx on public.finance_transactions(category_id);
create index if not exists finance_invoices_student_idx on public.finance_invoices(student_id);
create index if not exists finance_invoices_status_idx on public.finance_invoices(status);
create index if not exists finance_payments_invoice_idx on public.finance_payments(invoice_id);
create index if not exists finance_budgets_period_idx on public.finance_budgets(period_start, period_end);

create or replace function public.finance_staff() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin','manager')
  );
$$;

alter table public.finance_accounts enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_invoices enable row level security;
alter table public.finance_payments enable row level security;
alter table public.finance_budgets enable row level security;
alter table public.finance_audit_log enable row level security;

drop policy if exists finance_accounts_staff on public.finance_accounts;
create policy finance_accounts_staff on public.finance_accounts for all using (public.finance_staff()) with check (public.finance_staff());

drop policy if exists finance_categories_staff on public.finance_categories;
create policy finance_categories_staff on public.finance_categories for all using (public.finance_staff()) with check (public.finance_staff());

drop policy if exists finance_transactions_staff on public.finance_transactions;
create policy finance_transactions_staff on public.finance_transactions for all using (public.finance_staff()) with check (public.finance_staff());

drop policy if exists finance_invoices_staff on public.finance_invoices;
create policy finance_invoices_staff on public.finance_invoices for all using (public.finance_staff()) with check (public.finance_staff());

drop policy if exists finance_payments_staff on public.finance_payments;
create policy finance_payments_staff on public.finance_payments for all using (public.finance_staff()) with check (public.finance_staff());

drop policy if exists finance_budgets_staff on public.finance_budgets;
create policy finance_budgets_staff on public.finance_budgets for all using (public.finance_staff()) with check (public.finance_staff());

drop policy if exists finance_audit_staff on public.finance_audit_log;
create policy finance_audit_staff on public.finance_audit_log for select using (public.finance_staff());

create or replace function public.finance_set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists finance_accounts_updated_at on public.finance_accounts;
create trigger finance_accounts_updated_at before update on public.finance_accounts
for each row execute function public.finance_set_updated_at();

drop trigger if exists finance_invoices_updated_at on public.finance_invoices;
create trigger finance_invoices_updated_at before update on public.finance_invoices
for each row execute function public.finance_set_updated_at();

create or replace function public.finance_record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text default null,
  p_notes text default null
) returns public.finance_payments
language plpgsql security definer set search_path = public
as $$
declare
  v_invoice public.finance_invoices;
  v_payment public.finance_payments;
  v_cash_account uuid;
  v_new_paid numeric;
begin
  if not public.finance_staff() then raise exception 'Finance access denied'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;

  select * into v_invoice from public.finance_invoices where id = p_invoice_id for update;
  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.status = 'cancelled' then raise exception 'Cancelled invoice cannot receive payments'; end if;
  if p_amount > (v_invoice.total - v_invoice.amount_paid) then raise exception 'Payment exceeds invoice balance'; end if;

  select id into v_cash_account from public.finance_accounts
  where active = true and account_type in ('cash','bank','mobile_money')
  order by case account_type when 'cash' then 1 when 'bank' then 2 else 3 end
  limit 1;
  if v_cash_account is null then raise exception 'Create an active cash or bank finance account first'; end if;

  insert into public.finance_payments(invoice_id, amount, method, reference, notes, received_by)
  values (p_invoice_id, p_amount, p_method, p_reference, p_notes, auth.uid())
  returning * into v_payment;

  v_new_paid := v_invoice.amount_paid + p_amount;
  update public.finance_invoices
  set amount_paid = v_new_paid,
      status = case when v_new_paid >= total then 'paid' else 'partial' end
  where id = p_invoice_id;

  update public.finance_accounts
  set current_balance = current_balance + p_amount
  where id = v_cash_account;

  insert into public.finance_transactions(account_id, direction, amount, currency, description, reference_type, reference_id, created_by)
  values (v_cash_account, 'inflow', p_amount, v_invoice.currency,
          'Invoice payment ' || v_invoice.invoice_number, 'invoice_payment', p_invoice_id, auth.uid());

  insert into public.finance_audit_log(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'record_payment', 'invoice', p_invoice_id,
          jsonb_build_object('amount', p_amount, 'method', p_method, 'reference', p_reference));

  return v_payment;
end;
$$;

revoke all on function public.finance_record_payment(uuid,numeric,text,text,text) from public;
grant execute on function public.finance_record_payment(uuid,numeric,text,text,text) to authenticated;

insert into public.finance_categories(name, category_type)
values
  ('Tuition & Fees','income'),
  ('Registration','income'),
  ('Donations','income'),
  ('Other Income','income'),
  ('Salaries','expense'),
  ('Utilities','expense'),
  ('Learning Materials','expense'),
  ('Technology','expense'),
  ('Operations','expense'),
  ('Other Expense','expense')
on conflict (name) do nothing;

insert into public.finance_accounts(name, account_type, currency, opening_balance, current_balance)
select 'Main Cash', 'cash', 'ETB', 0, 0
where not exists (select 1 from public.finance_accounts where name = 'Main Cash');

grant select, insert, update on public.finance_accounts, public.finance_categories, public.finance_transactions,
  public.finance_invoices, public.finance_payments, public.finance_budgets, public.finance_audit_log to authenticated;
