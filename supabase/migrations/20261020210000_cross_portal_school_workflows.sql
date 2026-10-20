-- Cross-portal school workflows: verified parent links, finance visibility, and notifications.
-- All RPCs are scoped to auth.uid(); parent-facing finance output is summary-only.

create or replace function public.create_parent_link_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_role(v_user, 'student'::public.app_role) then
    raise exception 'Only student accounts can create a parent link code';
  end if;

  update public.parent_links
     set status = 'expired'
   where student_id = v_user and status = 'pending';

  v_code := 'MM-' || substr(replace(upper(gen_random_uuid()::text), '-', ''), 1, 10);
  insert into public.parent_links (student_id, parent_id, link_code, status)
  values (v_user, null, v_code, 'pending');

  return v_code;
end;
$$;

revoke all on function public.create_parent_link_code() from public;
grant execute on function public.create_parent_link_code() to authenticated;

create or replace function public.claim_parent_link_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent uuid := auth.uid();
  v_link public.parent_links%rowtype;
  v_student_name text;
  v_grade text;
begin
  if v_parent is null then
    raise exception 'Authentication required';
  end if;
  if nullif(trim(p_code), '') is null then
    raise exception 'Enter a parent link code';
  end if;

  select * into v_link
    from public.parent_links
   where upper(link_code) = upper(trim(p_code))
     and status = 'pending'
     and parent_id is null
     and student_id <> v_parent
   order by created_at desc
   limit 1
   for update;

  if not found then
    raise exception 'That code is invalid, expired, or already used';
  end if;

  if exists (
    select 1 from public.parent_links
     where parent_id = v_parent
       and student_id = v_link.student_id
       and status = 'linked'
  ) then
    raise exception 'This child is already linked to your account';
  end if;

  update public.parent_links
     set parent_id = v_parent, status = 'linked', linked_at = now()
   where id = v_link.id;

  select name, grade into v_student_name, v_grade
    from public.profiles where id = v_link.student_id;

  insert into public.parent_notifications (parent_id, student_id, notification_type, title, message, read)
  values (v_parent, v_link.student_id, 'portal_link', 'Child account connected',
          coalesce(v_student_name, 'Your child') || ' is now connected to your Parent Portal.', false);

  return jsonb_build_object('student_id', v_link.student_id, 'name', v_student_name, 'grade', v_grade);
end;
$$;

revoke all on function public.claim_parent_link_code(text) from public;
grant execute on function public.claim_parent_link_code(text) to authenticated;

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
  select
    l.student_id,
    coalesce(p.name, 'Student') as student_name,
    p.grade,
    (
      select count(*)
      from public.quiz_assignments qa
      where (qa.student_id = l.student_id or exists (
        select 1 from public.class_students cs
        where cs.class_id = qa.class_id and cs.student_id = l.student_id
      ))
      and not exists (
        select 1 from public.quiz_results qr
        where qr.student_id = l.student_id
          and qr.quiz_id = qa.quiz_id
          and qr.completed_at >= qa.created_at
      )
    ) as pending_assignments,
    (
      select count(*) from public.quiz_results qr
      where qr.student_id = l.student_id
        and qr.completed_at >= now() - interval '30 days'
    ) as recent_quizzes,
    (
      select round(avg(qr.score)::numeric, 1) from public.quiz_results qr
      where qr.student_id = l.student_id
        and qr.completed_at >= now() - interval '30 days'
    ) as average_recent_score,
    coalesce((
      select sum(greatest(fi.total - fi.amount_paid, 0))
      from public.finance_invoices fi
      where fi.student_id = l.student_id
        and fi.status in ('issued', 'partial', 'overdue')
    ), 0)::numeric as outstanding_amount,
    (
      select count(*) from public.finance_invoices fi
      where fi.student_id = l.student_id
        and fi.status in ('issued', 'partial', 'overdue')
    ) as open_invoices,
    (
      select count(*) from public.finance_invoices fi
      where fi.student_id = l.student_id and fi.status = 'overdue'
    ) as overdue_invoices
  from public.parent_links l
  join public.profiles p on p.id = l.student_id
  where l.parent_id = auth.uid()
    and l.status = 'linked'
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

  insert into public.parent_notifications (parent_id, student_id, notification_type, title, message, read)
  select distinct l.parent_id, l.student_id, 'assignment',
         'New learning assignment',
         coalesce(v_title, 'A new quiz') || ' was assigned to your child. ' || v_due,
         false
    from public.parent_links l
   where l.status = 'linked'
     and l.parent_id is not null
     and (
       (new.student_id is not null and l.student_id = new.student_id)
       or exists (
         select 1 from public.class_students cs
         where cs.class_id = new.class_id and cs.student_id = l.student_id
       )
     );
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
