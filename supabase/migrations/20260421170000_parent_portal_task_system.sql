-- Parent Portal task management + login mode support

alter table public.profiles
  add column if not exists login_mode text not null default 'student';

alter table public.profiles
  drop constraint if exists profiles_login_mode_check;

alter table public.profiles
  add constraint profiles_login_mode_check
  check (login_mode in ('student', 'parent'));

create table if not exists public.parent_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  deadline date,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_by text not null default 'parent',
  is_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_parent_tasks_student_created_at on public.parent_tasks(student_id, created_at desc);
create index if not exists idx_parent_tasks_student_status on public.parent_tasks(student_id, status);

create trigger update_parent_tasks_updated_at
before update on public.parent_tasks
for each row
execute function public.update_updated_at_column();

alter table public.parent_tasks enable row level security;

create policy if not exists "students_manage_own_parent_tasks"
on public.parent_tasks
for all
using (student_id = auth.uid())
with check (student_id = auth.uid());

do $$
begin
  begin
    alter publication supabase_realtime add table public.parent_tasks;
  exception
    when duplicate_object then null;
  end;
end $$;
