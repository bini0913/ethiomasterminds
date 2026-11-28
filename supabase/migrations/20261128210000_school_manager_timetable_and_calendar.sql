-- School Manager Part 3: school timetable and calendar.
-- All writes are school-manager scoped, audited, and isolated by school.
create table if not exists public.school_timetable_slots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  academic_year_id uuid not null,
  section_id uuid not null,
  teacher_membership_id uuid,
  subject_name text not null check (char_length(trim(subject_name)) between 1 and 120),
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  room_label text,
  active boolean not null default true,
  notes text,
  created_by_membership_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_timetable_slots_time_check check (ends_at > starts_at),
  constraint school_timetable_slots_section_fk foreign key (section_id, school_id)
    references public.school_sections(id, school_id) on delete restrict,
  constraint school_timetable_slots_teacher_fk foreign key (teacher_membership_id, school_id)
    references public.school_memberships(id, school_id) on delete restrict,
  constraint school_timetable_slots_creator_fk foreign key (created_by_membership_id, school_id)
    references public.school_memberships(id, school_id) on delete restrict
);

create index if not exists school_timetable_slots_school_year_day_idx
  on public.school_timetable_slots (school_id, academic_year_id, weekday, starts_at)
  where active;
create index if not exists school_timetable_slots_section_idx
  on public.school_timetable_slots (school_id, section_id, weekday)
  where active;
create index if not exists school_timetable_slots_teacher_idx
  on public.school_timetable_slots (school_id, teacher_membership_id, weekday)
  where active and teacher_membership_id is not null;

create table if not exists public.school_calendar_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  academic_year_id uuid,
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text check (description is null or char_length(description) <= 5000),
  event_type text not null default 'school_event'
    check (event_type in ('school_event','exam','holiday','meeting','deadline','other')),
  audience_type text not null default 'school'
    check (audience_type in ('school','staff','parents','students','grade','section')),
  grade_label text,
  section_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  status text not null default 'scheduled'
    check (status in ('scheduled','cancelled')),
  created_by_membership_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_calendar_events_time_check check (ends_at > starts_at),
  constraint school_calendar_events_audience_check check (
    (audience_type = 'grade' and grade_label is not null and section_id is null)
    or (audience_type = 'section' and grade_label is not null and section_id is not null)
    or (audience_type in ('school','staff','parents','students') and section_id is null)
  ),
  constraint school_calendar_events_section_fk foreign key (section_id, school_id)
    references public.school_sections(id, school_id) on delete restrict,
  constraint school_calendar_events_creator_fk foreign key (created_by_membership_id, school_id)
    references public.school_memberships(id, school_id) on delete restrict
);

create index if not exists school_calendar_events_school_start_idx
  on public.school_calendar_events (school_id, starts_at desc);
create index if not exists school_calendar_events_year_idx
  on public.school_calendar_events (school_id, academic_year_id, starts_at);

create table if not exists public.school_operations_audit_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_membership_id uuid,
  entity_type text not null check (entity_type in ('timetable_slot','calendar_event')),
  entity_id uuid not null,
  action_type text not null check (action_type in ('created','updated','deleted')),
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now(),
  constraint school_operations_audit_actor_fk foreign key (actor_membership_id, school_id)
    references public.school_memberships(id, school_id) on delete set null
);
create index if not exists school_operations_audit_school_created_idx
  on public.school_operations_audit_events (school_id, created_at desc);

create or replace function public.school_validate_timetable_slot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_section_year uuid;
begin
  if not public.is_school_manager_or_admin(new.school_id) then
    raise exception 'School Manager permission is required to manage the timetable';
  end if;

  select section.academic_year_id into v_section_year
  from public.school_sections section
  where section.id = new.section_id and section.school_id = new.school_id;

  if v_section_year is null or v_section_year <> new.academic_year_id then
    raise exception 'The selected section does not belong to this academic year';
  end if;

  if not exists (
    select 1 from public.school_academic_years year
    where year.id = new.academic_year_id and year.school_id = new.school_id
  ) then
    raise exception 'Academic year does not belong to this school';
  end if;

  if new.teacher_membership_id is not null then
    if not exists (
      select 1 from public.school_memberships teacher
      where teacher.id = new.teacher_membership_id
        and teacher.school_id = new.school_id
        and teacher.school_role = 'teacher'
        and teacher.status = 'active'
    ) then
      raise exception 'Select an active teacher from this school';
    end if;
    if not exists (
      select 1 from public.school_teacher_assignments assignment
      where assignment.school_id = new.school_id
        and assignment.teacher_membership_id = new.teacher_membership_id
        and assignment.section_id = new.section_id
        and (assignment.assignment_kind = 'homeroom' or lower(assignment.subject_name) = lower(new.subject_name))
    ) then
      raise exception 'The teacher must already be assigned to this section and subject';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.school_id::text), hashtext(new.academic_year_id::text || ':' || new.weekday::text));

  if new.active and exists (
    select 1 from public.school_timetable_slots existing
    where existing.school_id = new.school_id
      and existing.academic_year_id = new.academic_year_id
      and existing.weekday = new.weekday
      and existing.active
      and existing.id <> coalesce(new.id, gen_random_uuid())
      and (new.starts_at, new.ends_at) overlaps (existing.starts_at, existing.ends_at)
      and (
        existing.section_id = new.section_id
        or (new.teacher_membership_id is not null and existing.teacher_membership_id = new.teacher_membership_id)
        or (nullif(trim(new.room_label), '') is not null and lower(trim(existing.room_label)) = lower(trim(new.room_label)))
      )
  ) then
    raise exception 'Timetable conflict: section, teacher, or room is already booked during this period';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists school_timetable_slots_validate on public.school_timetable_slots;
create trigger school_timetable_slots_validate
before insert or update on public.school_timetable_slots
for each row execute function public.school_validate_timetable_slot();

create or replace function public.school_record_operations_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_school_id uuid;
  v_entity_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_entity_type text;
begin
  v_entity_type := case when tg_table_name = 'school_timetable_slots' then 'timetable_slot' else 'calendar_event' end;
  if tg_op = 'DELETE' then
    v_school_id := old.school_id; v_entity_id := old.id; v_before := to_jsonb(old); v_after := null;
  elsif tg_op = 'UPDATE' then
    v_school_id := new.school_id; v_entity_id := new.id; v_before := to_jsonb(old); v_after := to_jsonb(new);
  else
    v_school_id := new.school_id; v_entity_id := new.id; v_before := null; v_after := to_jsonb(new);
  end if;
  insert into public.school_operations_audit_events
    (school_id, actor_user_id, actor_membership_id, entity_type, entity_id, action_type, before_state, after_state)
  values
    (v_school_id, auth.uid(), public.school_my_membership_id(v_school_id), v_entity_type, v_entity_id,
     lower(tg_op), v_before, v_after);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists school_timetable_slots_audit on public.school_timetable_slots;
create trigger school_timetable_slots_audit
after insert or update or delete on public.school_timetable_slots
for each row execute function public.school_record_operations_audit();
drop trigger if exists school_calendar_events_audit on public.school_calendar_events;
create trigger school_calendar_events_audit
after insert or update or delete on public.school_calendar_events
for each row execute function public.school_record_operations_audit();

alter table public.school_timetable_slots enable row level security;
alter table public.school_calendar_events enable row level security;
alter table public.school_operations_audit_events enable row level security;

drop policy if exists school_timetable_slots_manager_all on public.school_timetable_slots;
create policy school_timetable_slots_manager_all on public.school_timetable_slots
for all to authenticated
using (public.is_school_manager_or_admin(school_id))
with check (public.is_school_manager_or_admin(school_id));

drop policy if exists school_calendar_events_manager_all on public.school_calendar_events;
create policy school_calendar_events_manager_all on public.school_calendar_events
for all to authenticated
using (public.is_school_manager_or_admin(school_id))
with check (public.is_school_manager_or_admin(school_id));

drop policy if exists school_operations_audit_manager_read on public.school_operations_audit_events;
create policy school_operations_audit_manager_read on public.school_operations_audit_events
for select to authenticated
using (public.is_school_manager_or_admin(school_id));

grant select, insert, update, delete on public.school_timetable_slots to authenticated;
grant select, insert, update, delete on public.school_calendar_events to authenticated;
grant select on public.school_operations_audit_events to authenticated;
