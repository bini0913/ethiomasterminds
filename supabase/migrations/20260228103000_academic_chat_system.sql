-- Master Minds Academic Chat System
-- Core schema for direct/group/study/class/ai conversations with moderation and realtime hooks.

create extension if not exists pgcrypto;

create type public.conversation_type as enum ('direct', 'group', 'study_room', 'class', 'ai');
create type public.conversation_member_role as enum ('member', 'moderator', 'admin');
create type public.chat_message_type as enum ('text', 'image', 'file', 'flashcard', 'quiz', 'ai_reply');

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null,
  name text,
  grade_restriction int2[] default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_archived boolean not null default false
);

create table if not exists public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.conversation_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  message_type public.chat_message_type not null default 'text',
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  reply_to uuid references public.messages(id) on delete set null,
  is_edited boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.message_reads (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists public.typing_status (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messages(id) on delete cascade,
  flagged_reason text not null,
  severity text not null,
  action_taken text,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversation_members_user on public.conversation_members(user_id, joined_at desc);
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at desc);
create index if not exists idx_message_reads_user on public.message_reads(user_id, read_at desc);
create index if not exists idx_moderation_severity on public.moderation_logs(severity, created_at desc);
create index if not exists idx_typing_status on public.typing_status(conversation_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger conversations_touch_updated_at
before update on public.conversations
for each row execute function public.touch_updated_at();

create trigger typing_touch_updated_at
before update on public.typing_status
for each row execute function public.touch_updated_at();

create or replace function public.user_role(_user_id uuid)
returns text
language sql
stable
as $$
  select coalesce((select role::text from public.user_roles where user_id = _user_id limit 1), 'student');
$$;

create or replace function public.allow_chat_access(_conversation_id uuid, _user_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  restricted_grades int2[];
  current_grade int;
  member_exists boolean;
begin
  select exists(
    select 1 from public.conversation_members cm
    where cm.conversation_id = _conversation_id and cm.user_id = _user_id
  ) into member_exists;

  if not member_exists then
    return false;
  end if;

  select grade_restriction into restricted_grades
  from public.conversations where id = _conversation_id;

  if restricted_grades is null or array_length(restricted_grades, 1) is null then
    return true;
  end if;

  select nullif(regexp_replace(grade, '[^0-9]', '', 'g'), '')::int
    into current_grade
  from public.profiles where id = _user_id;

  return current_grade = any(restricted_grades);
end;
$$;

create or replace function public.moderate_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lower_content text;
  severity text := 'low';
  reason text;
  action text := 'allow';
  stricter_filter boolean := false;
  sender_grade int;
begin
  lower_content := lower(new.content);

  select nullif(regexp_replace(grade, '[^0-9]', '', 'g'), '')::int
    into sender_grade
  from public.profiles
  where id = new.sender_id;

  stricter_filter := coalesce(sender_grade between 1 and 8, false);

  if lower_content ~ '(bully|kill yourself|hate you|stupid)' then
    reason := 'bullying_or_toxicity';
    severity := case when stricter_filter then 'high' else 'medium' end;
  elsif lower_content ~ '(buy now|free money|http://|https://)' then
    reason := 'spam_or_link';
    severity := 'medium';
  elsif lower_content ~ '(exam answer leak|cheat sheet|send exam paper)' then
    reason := 'cheating_attempt';
    severity := 'high';
  elsif stricter_filter and lower_content ~ '(damn|hell)' then
    reason := 'language_policy_junior';
    severity := 'medium';
  end if;

  if reason is not null then
    if severity = 'high' then
      new.is_deleted := true;
      action := 'auto_deleted';
    else
      action := 'warned';
    end if;

    insert into public.moderation_logs (message_id, flagged_reason, severity, action_taken)
    values (new.id, reason, severity, action);
  end if;

  return new;
end;
$$;

drop trigger if exists messages_moderation_trigger on public.messages;
create trigger messages_moderation_trigger
before insert on public.messages
for each row execute function public.moderate_chat_message();

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.typing_status enable row level security;
alter table public.moderation_logs enable row level security;

create policy "Members can view conversations"
on public.conversations for select
using (exists (
  select 1 from public.conversation_members cm
  where cm.conversation_id = id and cm.user_id = auth.uid()
));

create policy "Members can create conversations"
on public.conversations for insert
with check (created_by = auth.uid());

create policy "Members can update own conversations"
on public.conversations for update
using (
  created_by = auth.uid()
  or public.user_role(auth.uid()) in ('admin', 'teacher')
);

create policy "Members can read memberships"
on public.conversation_members for select
using (exists (
  select 1 from public.conversation_members self
  where self.conversation_id = conversation_members.conversation_id
    and self.user_id = auth.uid()
));

create policy "Conversation admins can manage memberships"
on public.conversation_members for all
using (
  public.user_role(auth.uid()) = 'admin'
  or exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_members.conversation_id
      and cm.user_id = auth.uid()
      and cm.role in ('admin', 'moderator')
  )
)
with check (
  public.user_role(auth.uid()) = 'admin'
  or exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_members.conversation_id
      and cm.user_id = auth.uid()
      and cm.role in ('admin', 'moderator')
  )
);

create policy "Members can read messages"
on public.messages for select
using (public.allow_chat_access(conversation_id, auth.uid()));

create policy "Members can write messages"
on public.messages for insert
with check (
  sender_id = auth.uid()
  and public.allow_chat_access(conversation_id, auth.uid())
);

create policy "Members can update own messages"
on public.messages for update
using (sender_id = auth.uid() and public.allow_chat_access(conversation_id, auth.uid()));

create policy "Members can read receipts"
on public.message_reads for select
using (exists (
  select 1 from public.messages m
  where m.id = message_reads.message_id
    and public.allow_chat_access(m.conversation_id, auth.uid())
));

create policy "Members can insert receipts"
on public.message_reads for insert
with check (user_id = auth.uid());

create policy "Members can manage typing state"
on public.typing_status for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Admins and teachers can view moderation"
on public.moderation_logs for select
using (public.user_role(auth.uid()) in ('admin', 'teacher'));

create policy "Admins can manage moderation logs"
on public.moderation_logs for update
using (public.user_role(auth.uid()) = 'admin');

do $$
begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.conversation_members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.typing_status; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.message_reads; exception when duplicate_object then null; end;
end $$;
