-- User blocking must apply at the database boundary, not only in the UI.
-- A block is private to the blocker and prevents direct interaction in either direction.

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_not_self check (blocker_id <> blocked_id),
  constraint user_blocks_unique_pair unique (blocker_id, blocked_id)
);

create index if not exists user_blocks_blocked_id_idx
  on public.user_blocks (blocked_id, blocker_id);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

drop policy if exists "Users can view their own blocks" on public.user_blocks;
create policy "Users can view their own blocks"
  on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

drop policy if exists "Users can create their own blocks" on public.user_blocks;
create policy "Users can create their own blocks"
  on public.user_blocks for insert to authenticated
  with check (
    blocker_id = (select auth.uid())
    and blocked_id <> (select auth.uid())
  );

drop policy if exists "Users can remove their own blocks" on public.user_blocks;
create policy "Users can remove their own blocks"
  on public.user_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- This helper only answers for the currently authenticated user, so it cannot
-- be used to enumerate whether two unrelated accounts have blocked each other.
create or replace function public.is_blocked_with(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and p_other_user_id is not null
    and exists (
      select 1
      from public.user_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p_other_user_id)
         or (b.blocker_id = p_other_user_id and b.blocked_id = auth.uid())
    );
$$;

revoke all on function public.is_blocked_with(uuid) from public, anon;
grant execute on function public.is_blocked_with(uuid) to authenticated;

-- Server-only variant for trusted Edge Functions and SECURITY DEFINER workflows.
create or replace function public.are_users_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select p_user_a is not null and p_user_b is not null
    and exists (
      select 1
      from public.user_blocks b
      where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
         or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
    );
$$;

revoke all on function public.are_users_blocked(uuid, uuid) from public, anon, authenticated;
grant execute on function public.are_users_blocked(uuid, uuid) to service_role;

create or replace function public.apply_user_block_side_effects()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  -- Remove existing friend and follower relationships in both directions.
  delete from public.friends
  where (user_id = new.blocker_id and friend_id = new.blocked_id)
     or (user_id = new.blocked_id and friend_id = new.blocker_id);

  delete from public.followers
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);

  -- Cancel pending multiplayer invitations and leave any direct call shared by the pair.
  update public.multiplayer_invites
     set status = 'declined', responded_at = now()
   where status = 'pending'
     and ((sender_id = new.blocker_id and receiver_id = new.blocked_id)
       or (sender_id = new.blocked_id and receiver_id = new.blocker_id));

  update public.study_call_participants
     set status = 'left', responded_at = now()
   where status in ('invited', 'accepted')
     and ((user_id = new.blocker_id and invited_by = new.blocked_id)
       or (user_id = new.blocked_id and invited_by = new.blocker_id));

  update public.study_call_rooms r
     set ended_at = coalesce(r.ended_at, now())
   where r.id in (
     select p.room_id
     from public.study_call_participants p
     where (p.user_id = new.blocker_id and p.invited_by = new.blocked_id)
        or (p.user_id = new.blocked_id and p.invited_by = new.blocker_id)
   )
   and not exists (
     select 1 from public.study_call_participants active
     where active.room_id = r.id and active.status = 'accepted'
   );

  return new;
end;
$$;

revoke all on function public.apply_user_block_side_effects() from public, anon, authenticated;
drop trigger if exists user_blocks_apply_side_effects on public.user_blocks;
create trigger user_blocks_apply_side_effects
  after insert on public.user_blocks
  for each row execute function public.apply_user_block_side_effects();

-- Friend requests and existing friendships are no longer visible or writable
-- when either participant has blocked the other.
drop policy if exists "involved users can view" on public.friends;
create policy "involved users can view"
  on public.friends for select to authenticated
  using (
    (user_id = (select auth.uid()) or friend_id = (select auth.uid()))
    and not public.is_blocked_with(case when user_id = (select auth.uid()) then friend_id else user_id end)
  );

drop policy if exists "user manages own friend request" on public.friends;
create policy "user manages own friend request"
  on public.friends for all to authenticated
  using (user_id = (select auth.uid()) and not public.is_blocked_with(friend_id))
  with check (user_id = (select auth.uid()) and not public.is_blocked_with(friend_id));

-- Follows cannot be created or viewed across a block.
drop policy if exists "involved users can view" on public.followers;
create policy "involved users can view"
  on public.followers for select to authenticated
  using (
    (follower_id = (select auth.uid()) or following_id = (select auth.uid()))
    and not public.is_blocked_with(case when follower_id = (select auth.uid()) then following_id else follower_id end)
  );

drop policy if exists "user manages own follow" on public.followers;
create policy "user manages own follow"
  on public.followers for all to authenticated
  using (follower_id = (select auth.uid()) and not public.is_blocked_with(following_id))
  with check (follower_id = (select auth.uid()) and not public.is_blocked_with(following_id));

-- Direct messages are hidden across a block. The send RPC below is the only
-- supported writer and independently enforces the same rule.
drop policy if exists "involved users can view messages" on public.messages;
create policy "involved users can view messages"
  on public.messages for select to authenticated
  using (
    (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and not public.is_blocked_with(case when sender_id = (select auth.uid()) then receiver_id else sender_id end)
  );

drop policy if exists "sender can update own message" on public.messages;
create policy "sender can update own message"
  on public.messages for update to authenticated
  using (
    (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and not public.is_blocked_with(case when sender_id = (select auth.uid()) then receiver_id else sender_id end)
  )
  with check (
    (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and not public.is_blocked_with(case when sender_id = (select auth.uid()) then receiver_id else sender_id end)
  );

-- Public/opted-in social posts and their comments respect blocks in either direction.
drop policy if exists "Authenticated users can view opted-in posts" on public.social_posts;
create policy "Authenticated users can view opted-in posts"
  on public.social_posts for select to authenticated
  using (
    (author_id = (select auth.uid()))
    or (
      not public.is_blocked_with(author_id)
      and coalesce((
        select p.is_public
        from public.profile_privacy_settings p
        where p.user_id = social_posts.author_id
      ), true)
    )
  );

drop policy if exists "authenticated can view visible post comments" on public.social_post_comments;
create policy "authenticated can view visible post comments"
  on public.social_post_comments for select to authenticated
  using (
    not public.is_blocked_with(user_id)
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_comments.post_id
        and (
          p.author_id = (select auth.uid())
          or (
            not public.is_blocked_with(p.author_id)
            and coalesce((
              select s.is_public
              from public.profile_privacy_settings s
              where s.user_id = p.author_id
            ), true)
          )
        )
    )
  );

drop policy if exists "users can comment on visible posts" on public.social_post_comments;
create policy "users can comment on visible posts"
  on public.social_post_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_comments.post_id
        and not public.is_blocked_with(p.author_id)
        and (
          p.author_id = (select auth.uid())
          or coalesce((
            select s.is_public
            from public.profile_privacy_settings s
            where s.user_id = p.author_id
          ), true)
        )
    )
  );

-- Multiplayer room chat and lobby content are filtered for blocked authors.
drop policy if exists "Room players can view room chat" on public.room_chat_messages;
drop policy if exists "room_chat_member_read" on public.room_chat_messages;
create policy "room_chat_member_read"
  on public.room_chat_messages for select to authenticated
  using (
    public.is_multiplayer_room_member(room_id)
    and not public.is_blocked_with(user_id)
  );

drop policy if exists "authenticated can view lobby" on public.lobby_messages;
create policy "authenticated can view lobby"
  on public.lobby_messages for select to authenticated
  using (not public.is_blocked_with(user_id));

drop policy if exists "authenticated can post lobby" on public.lobby_messages;
create policy "authenticated can post lobby"
  on public.lobby_messages for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Group messages remain available to group members, but messages from a blocked
-- participant are hidden from the blocked pair.
drop policy if exists "members can view group messages" on public.group_messages;
create policy "members can view group messages"
  on public.group_messages for select to authenticated
  using (
    not public.is_blocked_with(sender_id)
    and exists (
      select 1 from public.chat_group_members m
      where m.group_id = group_messages.group_id and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "members can send group messages" on public.group_messages;
create policy "members can send group messages"
  on public.group_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.chat_group_members m
      where m.group_id = group_messages.group_id and m.user_id = (select auth.uid())
    )
  );

-- Invites are filtered at the table boundary and protected in the creation RPC.
drop policy if exists "involved can view invite" on public.multiplayer_invites;
create policy "involved can view invite"
  on public.multiplayer_invites for select to authenticated
  using (
    (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and not public.is_blocked_with(case when sender_id = (select auth.uid()) then receiver_id else sender_id end)
  );

drop policy if exists "sender creates invite" on public.multiplayer_invites;
create policy "sender creates invite"
  on public.multiplayer_invites for insert to authenticated
  with check (sender_id = (select auth.uid()) and not public.is_blocked_with(receiver_id));

drop policy if exists "receiver responds to invite" on public.multiplayer_invites;
create policy "receiver responds to invite"
  on public.multiplayer_invites for update to authenticated
  using (
    (receiver_id = (select auth.uid()) or sender_id = (select auth.uid()))
    and not public.is_blocked_with(case when sender_id = (select auth.uid()) then receiver_id else sender_id end)
  )
  with check (
    (receiver_id = (select auth.uid()) or sender_id = (select auth.uid()))
    and not public.is_blocked_with(case when sender_id = (select auth.uid()) then receiver_id else sender_id end)
  );

-- Study call invitations cannot be created, accepted or used to join after a block.
drop policy if exists "participants can view own invitations" on public.study_call_participants;
create policy "participants can view own invitations"
  on public.study_call_participants for select to authenticated
  using (
    (auth.uid() = user_id or auth.uid() = invited_by)
    and not public.is_blocked_with(case when auth.uid() = user_id then invited_by else user_id end)
  );

drop policy if exists "users invite friends to own call" on public.study_call_participants;
create policy "users invite friends to own call"
  on public.study_call_participants for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and not public.is_blocked_with(user_id)
    and exists (
      select 1 from public.study_call_rooms r
      where r.id = study_call_participants.room_id and r.created_by = (select auth.uid())
    )
    and (
      user_id = (select auth.uid())
      or exists (
        select 1 from public.friends f
        where f.status = 'accepted'
          and (
            (f.user_id = (select auth.uid()) and f.friend_id = study_call_participants.user_id)
            or (f.friend_id = (select auth.uid()) and f.user_id = study_call_participants.user_id)
          )
      )
    )
  );

drop policy if exists "invitee responds to own call invitation" on public.study_call_participants;
create policy "invitee responds to own call invitation"
  on public.study_call_participants for update to authenticated
  using (user_id = (select auth.uid()) and not public.is_blocked_with(invited_by))
  with check (
    user_id = (select auth.uid())
    and not public.is_blocked_with(invited_by)
    and status = any (array['accepted'::text, 'declined'::text, 'left'::text])
  );

-- Harden SECURITY DEFINER RPCs: these bypass table RLS, so they must check blocks directly.
create or replace function public.send_friend_request(p_target_user_id uuid)
returns public.friends
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_friend public.friends%rowtype;
  v_existing public.friends%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_target_user_id is null or p_target_user_id = v_uid then raise exception 'Invalid friend target'; end if;
  if public.are_users_blocked(v_uid, p_target_user_id) then raise exception 'This user cannot be contacted'; end if;

  select * into v_existing from public.friends
   where (user_id = v_uid and friend_id = p_target_user_id)
      or (user_id = p_target_user_id and friend_id = v_uid)
   limit 1 for update;
  if found then
    if v_existing.status = 'accepted' then raise exception 'Already friends'; end if;
    raise exception 'Friend request already exists';
  end if;

  insert into public.friends(user_id, friend_id, status)
  values (v_uid, p_target_user_id, 'pending')
  returning * into v_friend;
  return v_friend;
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns public.friends
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_friend public.friends%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_friend from public.friends
   where id = p_request_id and friend_id = v_uid and status = 'pending'
   for update;
  if not found then raise exception 'Friend request not found'; end if;
  if public.are_users_blocked(v_uid, v_friend.user_id) then raise exception 'This user cannot be contacted'; end if;
  if p_accept then
    update public.friends set status = 'accepted', updated_at = now()
     where id = p_request_id returning * into v_friend;
  else
    delete from public.friends where id = p_request_id returning * into v_friend;
  end if;
  return v_friend;
end;
$$;

create or replace function public.send_direct_message(p_receiver_id uuid, p_content text)
returns public.messages
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_message public.messages%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_receiver_id is null or p_receiver_id = v_uid then raise exception 'Invalid recipient'; end if;
  if public.are_users_blocked(v_uid, p_receiver_id) then raise exception 'This user cannot be contacted'; end if;
  if trim(coalesce(p_content, '')) = '' then raise exception 'Message cannot be empty'; end if;
  insert into public.messages(sender_id, receiver_id, content)
  values (v_uid, p_receiver_id, left(trim(p_content), 2000))
  returning * into v_message;
  return v_message;
end;
$$;

create or replace function public.create_multiplayer_invite(_room_id uuid, _receiver_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_status text;
  v_max_players integer;
  v_player_count integer;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if _receiver_id is null or _receiver_id = v_uid then raise exception 'Invalid invite recipient'; end if;
  if public.are_users_blocked(v_uid, _receiver_id) then raise exception 'This user cannot be contacted'; end if;

  select host_id, status, max_players into v_host, v_status, v_max_players
    from public.multiplayer_rooms where id = _room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_host <> v_uid then raise exception 'Only the host can invite players'; end if;
  if v_status <> 'waiting' then raise exception 'Invites are only available while the room is waiting'; end if;

  select count(*)::integer into v_player_count from public.room_players where room_id = _room_id;
  if v_player_count >= coalesce(v_max_players, 8) then raise exception 'Room is full'; end if;
  if exists (select 1 from public.room_players where room_id = _room_id and user_id = _receiver_id) then
    raise exception 'Player is already in this room';
  end if;
  if exists (
    select 1 from public.multiplayer_invites
    where room_id = _room_id and receiver_id = _receiver_id
      and status = 'pending' and expires_at > now()
  ) then
    raise exception 'An active invite already exists for this player';
  end if;

  insert into public.multiplayer_invites (room_id, sender_id, receiver_id, status, expires_at)
  values (_room_id, v_uid, _receiver_id, 'pending', now() + interval '2 minutes')
  returning id into v_id;
  return v_id;
end;
$$;

-- Preserve the existing authenticated RPC contract.
revoke all on function public.send_friend_request(uuid) from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
revoke all on function public.send_direct_message(uuid, text) from public, anon;
grant execute on function public.send_direct_message(uuid, text) to authenticated;
revoke all on function public.create_multiplayer_invite(uuid, uuid) from public, anon;
grant execute on function public.create_multiplayer_invite(uuid, uuid) to authenticated;

comment on table public.user_blocks is 'Private user-controlled block relationships. Blocks suppress direct interaction in both directions.';
