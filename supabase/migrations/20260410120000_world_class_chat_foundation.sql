-- World-class learning chat foundation tables
-- Compatible with existing chat_groups / group_messages / reports schema.

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
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  message_id uuid references public.group_messages(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_url text not null,
  file_type text not null,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

-- Existing deployments already have public.reports, ensure chat-report columns exist.
alter table public.reports add column if not exists chat_id uuid references public.chat_groups(id) on delete set null;
alter table public.reports add column if not exists message_id uuid references public.group_messages(id) on delete set null;
alter table public.reports add column if not exists reported_by uuid references auth.users(id) on delete set null;

update public.reports
set reported_by = reporter_id
where reported_by is null;

create index if not exists idx_chats_type_updated on public.chats(chat_type, updated_at desc);
create index if not exists idx_chat_members_user on public.chat_members(user_id, joined_at desc);
create index if not exists idx_attachments_group on public.attachments(group_id, created_at desc);
create index if not exists idx_reports_chat_message on public.reports(chat_id, message_id, created_at desc);

alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.attachments enable row level security;

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
    select 1 from public.chat_group_members cm
    where cm.group_id = attachments.group_id
      and cm.user_id = auth.uid()
  )
);

create policy "Members can upload attachments"
on public.attachments for insert
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.chat_group_members cm
    where cm.group_id = attachments.group_id
      and cm.user_id = auth.uid()
  )
);
