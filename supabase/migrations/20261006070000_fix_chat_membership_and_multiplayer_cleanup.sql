-- Fix production backend errors observed after the Android/runtime stabilization.
-- 1) Avoid recursive RLS evaluation for chat group membership reads.
-- 2) Make multiplayer room cleanup delete dependent rows before rooms.

create or replace function public.is_chat_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_group_members m
    where m.group_id = p_group_id
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_chat_group_member(uuid) from public;
grant execute on function public.is_chat_group_member(uuid) to authenticated;

drop policy if exists "members can view roster" on public.chat_group_members;
create policy "members can view roster"
on public.chat_group_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_chat_group_member(group_id)
);

create or replace function public.cleanup_expired_multiplayer_rooms()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  with expired as (
    select id
    from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
    for update
  )
  delete from public.room_answers
  where room_id in (select id from expired);

  with expired as (
    select id
    from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
  )
  delete from public.room_questions
  where room_id in (select id from expired);

  with expired as (
    select id
    from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
  )
  delete from public.room_state
  where room_id in (select id from expired);

  with expired as (
    select id
    from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
  )
  delete from public.room_chat_messages
  where room_id in (select id from expired);

  with expired as (
    select id
    from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
  )
  delete from public.room_players
  where room_id in (select id from expired);

  with expired as (
    select id
    from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
  )
  delete from public.multiplayer_invites
  where room_id in (select id from expired);

  with deleted as (
    delete from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
    returning 1
  )
  select count(*) into v_deleted from deleted;

  return coalesce(v_deleted, 0);
end;
$$;

grant execute on function public.cleanup_expired_multiplayer_rooms() to authenticated;
