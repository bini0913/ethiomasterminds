begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select ok(to_regclass('public.school_fee_structures') is not null, 'school fee structures table exists');
select ok(to_regclass('public.school_student_invoices') is not null, 'school student invoices table exists');
select ok(to_regclass('public.school_fee_payments') is not null, 'school fee payment ledger exists');
select ok(to_regclass('public.school_finance_audit_events') is not null, 'school finance audit log exists');

select ok((select relrowsecurity from pg_class where oid = 'public.school_fee_structures'::regclass), 'fee structures have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_student_invoices'::regclass), 'student invoices have RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.school_fee_payments'::regclass), 'fee payments have RLS enabled');
select ok(not has_table_privilege('authenticated', 'public.school_invoice_sequences', 'SELECT'), 'invoice sequences are private');
select ok(not has_table_privilege('authenticated', 'public.school_receipt_sequences', 'SELECT'), 'receipt sequences are private');

select ok(has_function_privilege('authenticated', 'public.school_generate_student_invoices(uuid,uuid)', 'execute'), 'School Finance can generate invoices through a guarded function');
select ok(has_function_privilege('authenticated', 'public.school_record_fee_payment(uuid,numeric,text,text)', 'execute'), 'School Finance can record payments through a guarded function');
select ok(has_function_privilege('authenticated', 'public.school_reverse_fee_payment(uuid,text)', 'execute'), 'School Finance can reverse a payment with a reason');

select ok(exists (select 1 from pg_trigger where tgname = 'school_invoice_ledger_protect' and tgrelid = 'public.school_student_invoices'::regclass and not tgisinternal), 'invoice totals cannot be edited outside the payment ledger');
select ok(exists (select 1 from pg_trigger where tgname = 'school_fee_payment_recalculate_invoice' and tgrelid = 'public.school_fee_payments'::regclass and not tgisinternal), 'confirmed and reversed payments recalculate invoice balances');
select ok(exists (select 1 from pg_trigger where tgname = 'school_invoice_notify_parent' and tgrelid = 'public.school_student_invoices'::regclass and not tgisinternal), 'parents receive new fee invoice notifications');
select ok(exists (select 1 from pg_trigger where tgname = 'school_payment_notify_parent' and tgrelid = 'public.school_fee_payments'::regclass and not tgisinternal), 'parents receive payment receipt notifications');

select * from finish();
rollback;
