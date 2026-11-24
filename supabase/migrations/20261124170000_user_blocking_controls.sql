-- User blocking controls for direct social interactions.
-- Keep the block list private to the account that created each block.

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_pkey primary key (blocker_id, blocked_user_id),
  constraint user_blocks_no_self check (blocker_id <> blocked_user_id)
);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

drop policy if exists "Users can view their own blocks" on public.user_blocks;
create policy "Users can view their own blocks"
  on public.user_blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);

drop policy if exists "Users can create their own blocks" on public.user_blocks;
create policy "Users can create their own blocks"
  on public.user_blocks for insert to authenticated
  with check (
    (select auth.uid()) = blocker_id
    and blocked_user_id <> (select auth.uid())
  );

drop policy if exists "Users can remove their own blocks" on public.user_blocks;
create policy "Users can remove their own blocks"
  on public.user_blocks for delete to authenticated
  using ((select auth.uid()) = blocker_id);

create or replace function app_private.is_user_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_user_a is null or p_user_b is null then
    return false;
  end if;

  -- This helper is only useful to a participant in the pair. It must not
  -- become a way to probe whether two unrelated accounts have blocked each other.
  if v_uid <> p_user_a and v_uid <> p_user_b then
    return false;
  end if;

  return exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = p_user_a and b.blocked_user_id = p_user_b)
       or (b.blocker_id = p_user_b and b.blocked_user_id = p_user_a)
  );
end;
$function$;

revoke all on function app_private.is_user_blocked(uuid, uuid) from public, anon;
grant execute on function app_private.is_user_blocked(uuid, uuid) to authenticated;

create or replace function app_private.reject_blocked_social_interaction()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_first_user uuid;
  v_second_user uuid;
begin
  if tg_table_name = 'friends' then
    v_first_user := new.user_id;
    v_second_user := new.friend_id;
  elsif tg_table_name = 'messages' then
    v_first_user := new.sender_id;
    v_second_user := new.receiver_id;
  elsif tg_table_name = 'multiplayer_invites' then
    v_first_user := new.sender_id;
    v_second_user := new.receiver_id;
  elsif tg_table_name = 'study_call_participants' then
    v_first_user := new.invited_by;
    v_second_user := new.user_id;
  else
    return new;
  end if;

  if app_private.is_user_blocked(v_first_user, v_second_user) then
    raise exception using
      errcode = '42501',
      message = 'This interaction is unavailable because one of the users has blocked the other';
  end if;

  return new;
end;
$function$;

revoke all on function app_private.reject_blocked_social_interaction() from public, anon, authenticated;

drop trigger if exists reject_blocked_friend_interaction on public.friends;
create trigger reject_blocked_friend_interaction
  before insert or update of user_id, friend_id on public.friends
  for each row execute function app_private.reject_blocked_social_interaction();

drop trigger if exists reject_blocked_direct_message on public.messages;
create trigger reject_blocked_direct_message
  before insert on public.messages
  for each row execute function app_private.reject_blocked_social_interaction();

drop trigger if exists reject_blocked_multiplayer_invite on public.multiplayer_invites;
create trigger reject_blocked_multiplayer_invite
  before insert on public.multiplayer_invites
  for each row execute function app_private.reject_blocked_social_interaction();

drop trigger if exists reject_blocked_study_call_invite on public.study_call_participants;
create trigger reject_blocked_study_call_invite
  before insert on public.study_call_participants
  for each row execute function app_private.reject_blocked_social_interaction();

create or replace function app_private.cleanup_blocked_friendship()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  delete from public.friends f
  where (f.user_id = new.blocker_id and f.friend_id = new.blocked_user_id)
     or (f.user_id = new.blocked_user_id and f.friend_id = new.blocker_id);
  return new;
end;
$function$;

revoke all on function app_private.cleanup_blocked_friendship() from public, anon, authenticated;

drop trigger if exists remove_friendship_when_blocked on public.user_blocks;
create trigger remove_friendship_when_blocked
  after insert on public.user_blocks
  for each row execute function app_private.cleanup_blocked_friendship();

-- Remove permissive ALL policy so blocked friendship rows cannot leak through
-- its SELECT branch. Friend writes continue through the existing security-definer RPCs.
drop policy if exists "user manages own friend request" on public.friends;
drop policy if exists "involved users can view" on public.friends;
create policy "involved users can view unblocked friendships"
  on public.friends for select to authenticated
  using (
    (user_id = (select auth.uid()) or friend_id = (select auth.uid()))
    and not app_private.is_user_blocked(user_id, friend_id)
  );

drop policy if exists "involved users can view messages" on public.messages;
create policy "involved users can view unblocked messages"
  on public.messages for select to authenticated
  using (
    (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and not app_private.is_user_blocked(sender_id, receiver_id)
  );

drop policy if exists "members can view group messages" on public.group_messages;
create policy "members can view group messages excluding blocked senders"
  on public.group_messages for select to authenticated
  using (
    exists (
      select 1 from public.chat_group_members m
      where m.group_id = group_messages.group_id
        and m.user_id = (select auth.uid())
    )
    and not app_private.is_user_blocked(sender_id, (select auth.uid()))
  );

create index if not exists user_blocks_blocked_user_idx
  on public.user_blocks (blocked_user_id, blocker_id);
