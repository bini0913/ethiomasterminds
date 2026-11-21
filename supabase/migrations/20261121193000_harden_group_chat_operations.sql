-- Harden group chat writes without changing existing rows or authentication behavior.
-- All mutations go through authenticated, server-owned transactions.

create unique index if not exists chat_group_members_group_user_key
  on public.chat_group_members (group_id, user_id);

-- Public/class groups may be discovered; private groups remain membership-visible only.
drop policy if exists "members can view group" on public.chat_groups;
create policy "members can view group"
on public.chat_groups
for select
to authenticated
using (
  group_type in ('public', 'class')
  or created_by = (select auth.uid())
  or exists (
    select 1
    from public.chat_group_members m
    where m.group_id = chat_groups.id
      and m.user_id = (select auth.uid())
  )
);

create or replace function public.create_chat_group(
  p_name text,
  p_description text default null,
  p_group_type text default 'private'
)
returns public.chat_groups
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_group public.chat_groups;
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_name is null or length(btrim(p_name)) = 0 or length(btrim(p_name)) > 120 then
    raise exception using errcode = '22023', message = 'Group name must be between 1 and 120 characters';
  end if;

  if p_group_type is null or p_group_type not in ('private', 'public', 'class', 'subject', 'group', 'room') then
    raise exception using errcode = '22023', message = 'Unsupported group type';
  end if;

  insert into public.chat_groups (name, description, group_type, created_by)
  values (btrim(p_name), nullif(btrim(p_description), ''), p_group_type, v_user)
  returning * into v_group;

  insert into public.chat_group_members (group_id, user_id, role)
  values (v_group.id, v_user, 'owner');

  return v_group;
end;
$function$;

create or replace function public.join_chat_group(p_group_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_type text;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select group_type into v_type
  from public.chat_groups
  where id = p_group_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Group not found';
  end if;

  if v_type not in ('public', 'class') then
    raise exception using errcode = '42501', message = 'This group is not open for joining';
  end if;

  insert into public.chat_group_members (group_id, user_id, role)
  values (p_group_id, v_user, 'member')
  on conflict (group_id, user_id) do nothing;

  return true;
end;
$function$;

create or replace function public.leave_chat_group(p_group_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_role text;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select role into v_role
  from public.chat_group_members
  where group_id = p_group_id and user_id = v_user;

  if not found then
    return false;
  end if;

  if v_role = 'owner' then
    raise exception using errcode = '42501', message = 'Group owners must transfer ownership before leaving';
  end if;

  delete from public.chat_group_members
  where group_id = p_group_id and user_id = v_user;

  return true;
end;
$function$;

create or replace function public.add_chat_group_member(
  p_group_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_role text;
begin
  if v_actor is null or p_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  select m.role into v_role
  from public.chat_group_members m
  where m.group_id = p_group_id and m.user_id = v_actor;

  if not found or v_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'Only group owners and admins can add members';
  end if;

  if not exists (select 1 from public.chat_groups g where g.id = p_group_id) then
    raise exception using errcode = 'P0002', message = 'Group not found';
  end if;

  insert into public.chat_group_members (group_id, user_id, role)
  values (p_group_id, p_user_id, 'member')
  on conflict (group_id, user_id) do nothing;

  return true;
end;
$function$;

create or replace function public.send_group_message(
  p_group_id uuid,
  p_content text,
  p_message_type text default 'text',
  p_reply_to_id uuid default null,
  p_attachment_url text default null
)
returns public.group_messages
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_message public.group_messages;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not exists (
    select 1 from public.chat_group_members m
    where m.group_id = p_group_id and m.user_id = v_user
  ) then
    raise exception using errcode = '42501', message = 'You must be a group member to send messages';
  end if;

  if p_content is null or length(btrim(p_content)) = 0 or length(p_content) > 4000 then
    raise exception using errcode = '22023', message = 'Message must be between 1 and 4000 characters';
  end if;

  if p_message_type is null or length(p_message_type) = 0 or length(p_message_type) > 32 then
    raise exception using errcode = '22023', message = 'Invalid message type';
  end if;

  if p_reply_to_id is not null and not exists (
    select 1 from public.group_messages r
    where r.id = p_reply_to_id and r.group_id = p_group_id
  ) then
    raise exception using errcode = '22023', message = 'Reply target is not in this group';
  end if;

  insert into public.group_messages (
    group_id, sender_id, content, message_type, reply_to_id, attachment_url
  )
  values (
    p_group_id, v_user, btrim(p_content), p_message_type, p_reply_to_id, p_attachment_url
  )
  returning * into v_message;

  update public.chat_groups
  set updated_at = now()
  where id = p_group_id;

  return v_message;
end;
$function$;

revoke all on function public.create_chat_group(text, text, text) from public;
revoke all on function public.join_chat_group(uuid) from public;
revoke all on function public.leave_chat_group(uuid) from public;
revoke all on function public.add_chat_group_member(uuid, uuid) from public;
revoke all on function public.send_group_message(uuid, text, text, uuid, text) from public;
grant execute on function public.create_chat_group(text, text, text) to authenticated;
grant execute on function public.join_chat_group(uuid) to authenticated;
grant execute on function public.leave_chat_group(uuid) to authenticated;
grant execute on function public.add_chat_group_member(uuid, uuid) to authenticated;
grant execute on function public.send_group_message(uuid, text, text, uuid, text) to authenticated;

revoke all on public.chat_groups from anon;
revoke all on public.chat_group_members from anon;
revoke all on public.group_messages from anon;
revoke insert, update, delete on public.chat_groups from authenticated;
revoke insert, update, delete on public.chat_group_members from authenticated;
revoke insert, update, delete on public.group_messages from authenticated;
grant select on public.chat_groups to authenticated;
grant select on public.chat_group_members to authenticated;
grant select on public.group_messages to authenticated;
