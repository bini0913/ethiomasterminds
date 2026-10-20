-- Cross-portal school workflows: verified parent links, finance visibility, and notifications.
-- All RPCs are scoped to auth.uid(); parent-facing finance output is summary-only.
create or replace function public.get_parent_portal_overview()
returns table (
  student_id uuid,
  student_name text,
  grade text,
  pending_assignments bigint,
  recent_quizzes bigint,
  average_recent_score numeric,
  outstanding_amount numeric,
  open_invoices bigint,
  overdue_invoices bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized_students as (
    -- This app's current Parent View uses the child's account credentials; show that account's own summary.
    select auth.uid() as student_id
     where auth.uid() is not null and public.has_role(auth.uid(), 'student'::public.app_role)
    union
    -- Keep support for any already-linked parent records, without allowing arbitrary student lookups.
    select l.student_id
      from public.parent_links l
     where l.parent_id = auth.uid() and l.status = 'linked'
  )
  select
    p.id as student_id,
    coalesce(p.name, 'Student') as student_name,
    p.grade,
    (
      select count(*)
      from public.quiz_assignments qa
      where (qa.student_id = p.id or exists (
        select 1 from public.class_students cs
        where cs.class_id = qa.class_id and cs.student_id = p.id
      ))
      and not exists (
        select 1 from public.quiz_results qr
        where qr.student_id = p.id
          and qr.quiz_id = qa.quiz_id
          and qr.completed_at >= qa.created_at
      )
    ) as pending_assignments,
    (
      select count(*) from public.quiz_results qr
      where qr.student_id = p.id and qr.completed_at >= now() - interval '30 days'
    ) as recent_quizzes,
    (
      select round(avg(qr.score)::numeric, 1) from public.quiz_results qr
      where qr.student_id = p.id and qr.completed_at >= now() - interval '30 days'
    ) as average_recent_score,
    coalesce((
      select sum(greatest(fi.total - fi.amount_paid, 0))
      from public.finance_invoices fi
      where fi.student_id = p.id and fi.status in ('issued', 'partial', 'overdue')
    ), 0)::numeric as outstanding_amount,
    (
      select count(*) from public.finance_invoices fi
      where fi.student_id = p.id and fi.status in ('issued', 'partial', 'overdue')
    ) as open_invoices,
    (
      select count(*) from public.finance_invoices fi
      where fi.student_id = p.id and fi.status = 'overdue'
    ) as overdue_invoices
  from authorized_students a
  join public.profiles p on p.id = a.student_id
  order by p.name;
$$;

revoke all on function public.get_parent_portal_overview() from public;
grant execute on function public.get_parent_portal_overview() to authenticated;

create or replace function public.notify_linked_parents_for_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_due text;
begin
  select q.title into v_title from public.quizzes q where q.id = new.quiz_id;
  v_due := case when new.due_date is null then 'No due date was set.'
                else 'Due ' || to_char(new.due_date at time zone 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC.' end;

  with target_students as (
    select new.student_id as student_id where new.student_id is not null
    union
    select cs.student_id from public.class_students cs where cs.class_id = new.class_id
  ), recipients as (
    select t.student_id, t.student_id as parent_id from target_students t
    union
    select l.student_id, l.parent_id from public.parent_links l
    join target_students t on t.student_id = l.student_id
    where l.status = 'linked' and l.parent_id is not null
  )
  insert into public.parent_notifications (parent_id, student_id, notification_type, title, message, read)
  select distinct r.parent_id, r.student_id, 'assignment',
         'New learning assignment',
         coalesce(v_title, 'A new quiz') || ' was assigned. ' || v_due,
         false
    from recipients r;
  return new;
end;
$$;

drop trigger if exists notify_parents_after_quiz_assignment on public.quiz_assignments;
create trigger notify_parents_after_quiz_assignment
after insert on public.quiz_assignments
for each row execute function public.notify_linked_parents_for_assignment();

create or replace function public.notify_linked_parents_for_quiz_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  select q.title into v_title from public.quizzes q where q.id = new.quiz_id;
  insert into public.parent_notifications (parent_id, student_id, notification_type, title, message, read)
  select new.student_id, new.student_id, 'quiz_result',
         'New learning result',
         coalesce(v_title, 'A quiz') || ': score ' || coalesce(new.score, 0)::text ||
         '%. View the learning summary in Parent Portal.',
         false
  union all
  select l.parent_id, l.student_id, 'quiz_result',
         'New learning result',
         coalesce(v_title, 'A quiz') || ': score ' || coalesce(new.score, 0)::text ||
         '%. View the learning summary in Parent Portal.',
         false
    from public.parent_links l
   where l.student_id = new.student_id and l.status = 'linked' and l.parent_id is not null;
  return new;
end;
$$;

drop trigger if exists notify_parents_after_quiz_result on public.quiz_results;
create trigger notify_parents_after_quiz_result
after insert on public.quiz_results
for each row execute function public.notify_linked_parents_for_quiz_result();

create or replace function public.notify_linked_parents_for_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.parent_notifications (parent_id, student_id, notification_type, title, message, read)
  select new.student_id, new.student_id, 'invoice',
         'School invoice issued',
         'Invoice ' || new.invoice_number || ' is available. Outstanding balance: ' ||
         new.currency || ' ' || greatest(new.total - new.amount_paid, 0)::text || '.',
         false
  union all
  select l.parent_id, l.student_id, 'invoice',
         'School invoice issued',
         'Invoice ' || new.invoice_number || ' is available. Outstanding balance: ' ||
         new.currency || ' ' || greatest(new.total - new.amount_paid, 0)::text || '.',
         false
    from public.parent_links l
   where l.student_id = new.student_id and l.status = 'linked' and l.parent_id is not null;
  return new;
end;
$$;

drop trigger if exists notify_parents_after_invoice_created on public.finance_invoices;
create trigger notify_parents_after_invoice_created
after insert on public.finance_invoices
for each row execute function public.notify_linked_parents_for_invoice();

create or replace function public.notify_linked_parents_for_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.finance_invoices%rowtype;
begin
  select * into v_invoice from public.finance_invoices where id = new.invoice_id;
  if not found then return new; end if;

  insert into public.parent_notifications (parent_id, student_id, notification_type, title, message, read)
  select v_invoice.student_id, v_invoice.student_id, 'payment',
         'School payment recorded',
         'A payment of ' || v_invoice.currency || ' ' || new.amount::text ||
         ' was recorded for invoice ' || v_invoice.invoice_number || '.',
         false
  union all
  select l.parent_id, l.student_id, 'payment',
         'School payment recorded',
         'A payment of ' || v_invoice.currency || ' ' || new.amount::text ||
         ' was recorded for invoice ' || v_invoice.invoice_number || '.',
         false
    from public.parent_links l
   where l.student_id = v_invoice.student_id and l.status = 'linked' and l.parent_id is not null;
  return new;
end;
$$;

drop trigger if exists notify_parents_after_payment on public.finance_payments;
create trigger notify_parents_after_payment
after insert on public.finance_payments
for each row execute function public.notify_linked_parents_for_payment();

create or replace function public.notify_linked_parents_for_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  with target_students as (
    select ur.user_id as student_id
      from public.user_roles ur
     where new.target_type = 'all' and ur.role = 'student'::public.app_role
    union
    select cs.student_id
      from public.class_students cs
     where new.target_type = 'class' and cs.class_id = new.target_id
    union
    select cs.student_id
      from public.class_students cs
      join public.classes c on c.id = cs.class_id
     where new.target_type = 'students' and c.teacher_id = new.author_id
  ), recipients as (
    select t.student_id, t.student_id as parent_id from target_students t
    union
    select l.student_id, l.parent_id from public.parent_links l
    join target_students t on t.student_id = l.student_id
    where l.status = 'linked' and l.parent_id is not null
  )
  insert into public.parent_notifications (parent_id, student_id, notification_type, title, message, read)
  select distinct r.parent_id, r.student_id, 'teacher_announcement',
         coalesce(new.title, 'School announcement'),
         left(coalesce(new.content, ''), 1200),
         false
    from recipients r;
  return new;
end;
$$;

drop trigger if exists notify_parents_after_announcement on public.announcements;
create trigger notify_parents_after_announcement
after insert on public.announcements
for each row execute function public.notify_linked_parents_for_announcement();

-- Aggregate-only finance oversight for authorized staff; never return ledger rows.
create or replace function public.get_finance_oversight_summary()
returns table (
  open_invoices bigint,
  outstanding_amount numeric,
  overdue_invoices bigint,
  payments_last_30_days numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.finance_staff() then
    raise exception 'Not authorized to view finance oversight';
  end if;

  return query
  select
    count(*) filter (where fi.status in ('issued', 'partial', 'overdue'))::bigint,
    coalesce(sum(greatest(fi.total - fi.amount_paid, 0)) filter (where fi.status in ('issued', 'partial', 'overdue')), 0)::numeric,
    count(*) filter (where fi.status = 'overdue')::bigint,
    coalesce((
      select sum(fp.amount) from public.finance_payments fp
      where fp.paid_at >= now() - interval '30 days'
    ), 0)::numeric
  from public.finance_invoices fi;
end;
$$;

revoke all on function public.get_finance_oversight_summary() from public;
grant execute on function public.get_finance_oversight_summary() to authenticated;
