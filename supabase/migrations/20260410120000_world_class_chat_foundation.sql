-- World-class learning chat foundation tables
-- Adds compatibility tables requested by product spec while preserving existing chat_groups/group_messages.

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chat_type text not null check (chat_type in ('private', 'room', 'class', 'community')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_members (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'teacher', 'moderator', 'owner')),
  is_muted boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (chat_id, user_id)
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  message_id uuid,
  uploaded_by uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_url text not null,
  file_type text not null,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references public.chats(id) on delete cascade,
  message_id uuid,
  reported_by uuid references auth.users(id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_chats_type_updated on public.chats(chat_type, updated_at desc);
create index if not exists idx_chat_members_user on public.chat_members(user_id, joined_at desc);
create index if not exists idx_attachments_chat on public.attachments(chat_id, created_at desc);
create index if not exists idx_reports_status on public.reports(status, created_at desc);

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.attachments enable row level security;
alter table public.reports enable row level security;

create policy "Users can read chats where they are members"
on public.chats for select
using (
  exists (
    select 1 from public.chat_members cm
    where cm.chat_id = chats.id
      and cm.user_id = auth.uid()
  )
);

create policy "Users can create chats"
on public.chats for insert
with check (created_by = auth.uid());

create policy "Users can read member list for joined chats"
on public.chat_members for select
using (
  exists (
    select 1 from public.chat_members self
    where self.chat_id = chat_members.chat_id
      and self.user_id = auth.uid()
  )
);

create policy "Chat owners and teachers can manage members"
on public.chat_members for all
using (
  exists (
    select 1 from public.chat_members cm
    where cm.chat_id = chat_members.chat_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'teacher', 'moderator')
  )
)
with check (
  exists (
    select 1 from public.chat_members cm
    where cm.chat_id = chat_members.chat_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'teacher', 'moderator')
  )
);

create policy "Members can read attachments"
on public.attachments for select
using (
  exists (
    select 1 from public.chat_members cm
    where cm.chat_id = attachments.chat_id
      and cm.user_id = auth.uid()
  )
);

create policy "Members can upload attachments"
on public.attachments for insert
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.chat_members cm
    where cm.chat_id = attachments.chat_id
      and cm.user_id = auth.uid()
  )
);

create policy "Members can create reports"
on public.reports for insert
with check (
  reported_by = auth.uid()
  and exists (
    select 1 from public.chat_members cm
    where cm.chat_id = reports.chat_id
      and cm.user_id = auth.uid()
  )
);

create policy "Teachers and moderators can read reports"
on public.reports for select
using (
  exists (
    select 1 from public.chat_members cm
    where cm.chat_id = reports.chat_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'teacher', 'moderator')
  )
);
