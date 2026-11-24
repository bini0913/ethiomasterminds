-- Record explicit acceptance of the current community rules and enforce it
-- server-side before any user-generated community content can be created.

create table if not exists public.user_policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_key text not null,
  policy_version text not null,
  source text not null default 'in_app',
  accepted_at timestamptz not null default now(),
  constraint user_policy_acceptances_source_check
    check (source in ('in_app', 'terms_page', 'signup')),
  constraint user_policy_acceptances_unique
    unique (user_id, policy_key, policy_version)
);

create index if not exists user_policy_acceptances_lookup_idx
  on public.user_policy_acceptances (user_id, policy_key, policy_version);

alter table public.user_policy_acceptances enable row level security;
revoke all on public.user_policy_acceptances from anon, authenticated;
grant select, insert on public.user_policy_acceptances to authenticated;

drop policy if exists "Users can read their own policy acceptances" on public.user_policy_acceptances;
create policy "Users can read their own policy acceptances"
  on public.user_policy_acceptances for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can record their own policy acceptances" on public.user_policy_acceptances;
create policy "Users can record their own policy acceptances"
  on public.user_policy_acceptances for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and policy_key = 'community_terms'
    and policy_version = '2026-11-24'
    and source in ('in_app', 'terms_page', 'signup')
  );

create or replace function public.has_accepted_policy(p_policy_key text, p_policy_version text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.user_policy_acceptances a
      where a.user_id = auth.uid()
        and a.policy_key = p_policy_key
        and a.policy_version = p_policy_version
    );
$$;

revoke all on function public.has_accepted_policy(text, text) from public, anon;
grant execute on function public.has_accepted_policy(text, text) to authenticated;

-- Posts: separate create/update/delete policies so the older ALL policy cannot
-- bypass the explicit acceptance requirement.
drop policy if exists "author manages own post" on public.social_posts;
drop policy if exists "authenticated can create post" on public.social_posts;
create policy "authenticated can create post"
  on public.social_posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
  );

create policy "authors can update own posts"
  on public.social_posts for update to authenticated
  using (
    author_id = (select auth.uid())
    or has_role((select auth.uid()), 'admin'::app_role)
    or has_role((select auth.uid()), 'manager'::app_role)
  )
  with check (
    (
      author_id = (select auth.uid())
      and public.has_accepted_policy('community_terms', '2026-11-24')
    )
    or has_role((select auth.uid()), 'admin'::app_role)
    or has_role((select auth.uid()), 'manager'::app_role)
  );

create policy "authors can delete own posts"
  on public.social_posts for delete to authenticated
  using (
    author_id = (select auth.uid())
    or has_role((select auth.uid()), 'admin'::app_role)
    or has_role((select auth.uid()), 'manager'::app_role)
  );

-- Comments and edited comments also require current acceptance.
drop policy if exists "users can comment on visible posts" on public.social_post_comments;
create policy "users can comment on visible posts"
  on public.social_post_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
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

drop policy if exists "users can update own comments" on public.social_post_comments;
create policy "users can update own comments"
  on public.social_post_comments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
  );

-- Direct message, friend request, group, multiplayer and call RPCs are
-- SECURITY DEFINER and therefore enforce acceptance in their function bodies.
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
  if not public.has_accepted_policy('community_terms', '2026-11-24') then
    raise exception 'Please accept the current Terms of Use before using community features';
  end if;
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
  if not public.has_accepted_policy('community_terms', '2026-11-24') then
    raise exception 'Please accept the current Terms of Use before messaging';
  end if;
  if p_receiver_id is null or p_receiver_id = v_uid then raise exception 'Invalid recipient'; end if;
  if public.are_users_blocked(v_uid, p_receiver_id) then raise exception 'This user cannot be contacted'; end if;
  if trim(coalesce(p_content, '')) = '' then raise exception 'Message cannot be empty'; end if;
  insert into public.messages(sender_id, receiver_id, content)
  values (v_uid, p_receiver_id, left(trim(p_content), 2000))
  returning * into v_message;
  return v_message;
end;
$$;

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
set search_path = pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_message public.group_messages;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24') then
    raise exception using errcode = '42501', message = 'Please accept the current Terms of Use before messaging';
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

  insert into public.group_messages (group_id, sender_id, content, message_type, reply_to_id, attachment_url)
  values (p_group_id, v_user, btrim(p_content), p_message_type, p_reply_to_id, p_attachment_url)
  returning * into v_message;

  update public.chat_groups set updated_at = now() where id = p_group_id;
  return v_message;
end;
$$;

create or replace function public.create_chat_group(
  p_name text,
  p_description text default null,
  p_group_type text default 'private'
)
returns public.chat_groups
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_group public.chat_groups;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24') then
    raise exception using errcode = '42501', message = 'Please accept the current Terms of Use before creating a group';
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
$$;

create or replace function public.create_study_call_invite(_friend_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller_id uuid := auth.uid();
  new_room_id uuid;
begin
  if caller_id is null then raise exception 'Sign in required' using errcode = '28000'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24') then
    raise exception 'Please accept the current Terms of Use before starting a Study Mode call';
  end if;
  if _friend_id is null or _friend_id = caller_id then raise exception 'Choose a different friend'; end if;
  if public.are_users_blocked(caller_id, _friend_id) then raise exception 'This user cannot be contacted'; end if;
  if not exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and ((f.user_id = caller_id and f.friend_id = _friend_id) or (f.friend_id = caller_id and f.user_id = _friend_id))
  ) then raise exception 'You can only call an accepted friend'; end if;
  insert into public.study_call_rooms (created_by) values (caller_id) returning id into new_room_id;
  insert into public.study_call_participants (room_id,user_id,invited_by,status,responded_at)
  values (new_room_id,caller_id,caller_id,'accepted',now()),(new_room_id,_friend_id,caller_id,'invited',null);
  return new_room_id;
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
  if not public.has_accepted_policy('community_terms', '2026-11-24') then
    raise exception 'Please accept the current Terms of Use before sending multiplayer invites';
  end if;
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

create or replace function public.create_study_competition(p_name text)
returns public.study_competitions
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_competition public.study_competitions;
  v_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24') then
    raise exception 'Please accept the current Terms of Use before creating a study competition';
  end if;
  if length(v_name) < 3 or length(v_name) > 80 then
    raise exception 'Competition name must be between 3 and 80 characters';
  end if;
  insert into public.study_competitions (name, created_by, start_time, end_time, status)
  values (v_name, auth.uid(), now(), now() + interval '24 hours', 'active')
  returning * into v_competition;
  insert into public.study_participants (competition_id, user_id, total_study_time)
  values (v_competition.id, auth.uid(), 0)
  on conflict (competition_id, user_id) do nothing;
  return v_competition;
end;
$$;

create or replace function public.multiplayer_create_room(
  p_name text,
  p_subject text,
  p_difficulty text,
  p_question_count integer,
  p_max_players integer,
  p_password text default null
)
returns public.multiplayer_rooms
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_uid uuid := (select auth.uid());
  v_room public.multiplayer_rooms%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24') then
    raise exception 'Please accept the current Terms of Use before creating a multiplayer room';
  end if;
  if p_max_players is null or p_max_players < 2 or p_max_players > 8 then
    raise exception 'Player limit must be between 2 and 8';
  end if;
  if p_question_count is null or p_question_count < 1 or p_question_count > 50 then
    raise exception 'Question count must be between 1 and 50';
  end if;
  if octet_length(coalesce(p_password, '')) > 256 then
    raise exception 'Room password is too long';
  end if;

  insert into public.multiplayer_rooms (
    name, host_id, max_players, subject, difficulty,
    question_count, has_password, status, game_mode
  )
  values (
    left(trim(coalesce(p_name, 'Room')), 80),
    v_uid,
    p_max_players,
    coalesce(nullif(trim(p_subject), ''), 'Mixed'),
    coalesce(nullif(trim(p_difficulty), ''), 'Medium'),
    p_question_count,
    nullif(trim(coalesce(p_password, '')), '') is not null,
    'waiting',
    'speed'
  )
  returning * into v_room;

  if nullif(trim(coalesce(p_password, '')), '') is not null then
    insert into public.multiplayer_room_secrets (room_id, password_hash)
    values (v_room.id, extensions.crypt(encode(extensions.digest(p_password, 'sha256'), 'hex'), extensions.gen_salt('bf')));
  end if;

  insert into public.room_players (room_id, user_id, is_ready)
  values (v_room.id, v_uid, true);
  return v_room;
end;
$$;

-- Remaining direct table writes are gated too, including image uploads.
drop policy if exists "members can send group messages" on public.group_messages;
create policy "members can send group messages"
  on public.group_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and exists (
      select 1 from public.chat_group_members m
      where m.group_id = group_messages.group_id and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "authenticated can post lobby" on public.lobby_messages;
create policy "authenticated can post lobby"
  on public.lobby_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
  );

drop policy if exists "Social images authenticated upload" on storage.objects;
create policy "Social images authenticated upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'social-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_accepted_policy('community_terms', '2026-11-24')
  );

drop policy if exists "users invite friends to own call" on public.study_call_participants;
create policy "users invite friends to own call"
  on public.study_call_participants for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
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

drop policy if exists "sender creates invite" on public.multiplayer_invites;
create policy "sender creates invite"
  on public.multiplayer_invites for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and not public.is_blocked_with(receiver_id)
    and public.has_accepted_policy('community_terms', '2026-11-24')
  );

-- Preserve the current authenticated RPC contracts.
revoke all on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
revoke all on function public.send_direct_message(uuid, text) from public, anon;
grant execute on function public.send_direct_message(uuid, text) to authenticated;
revoke all on function public.send_group_message(uuid, text, text, uuid, text) from public, anon;
grant execute on function public.send_group_message(uuid, text, text, uuid, text) to authenticated;
revoke all on function public.create_chat_group(text, text, text) from public, anon;
grant execute on function public.create_chat_group(text, text, text) to authenticated;
revoke all on function public.create_study_call_invite(uuid) from public, anon;
grant execute on function public.create_study_call_invite(uuid) to authenticated;
revoke all on function public.create_multiplayer_invite(uuid, uuid) from public, anon;
grant execute on function public.create_multiplayer_invite(uuid, uuid) to authenticated;
revoke all on function public.create_study_competition(text) from public, anon;
grant execute on function public.create_study_competition(text) to authenticated;
revoke all on function public.multiplayer_create_room(text, text, text, integer, integer, text) from public, anon;
grant execute on function public.multiplayer_create_room(text, text, text, integer, integer, text) to authenticated;

comment on table public.user_policy_acceptances is 'Immutable, versioned record of a user's acceptance of service policies.';
