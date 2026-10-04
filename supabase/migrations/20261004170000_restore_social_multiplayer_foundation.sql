-- Restore production contracts used by friends, multiplayer, presence and social uploads.
-- This migration is intentionally additive and keeps the PR #262 security model intact.

-- ---------------------------------------------------------------------------
-- Presence: authenticated users need to be able to see who is online.
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated can view presence" on public.user_presence;
create policy "authenticated can view presence"
on public.user_presence
for select
to authenticated
using (true);

-- ---------------------------------------------------------------------------
-- Friend search + friend/message RPCs.
-- ---------------------------------------------------------------------------
drop function if exists public.find_student_by_username(text);
create or replace function public.find_student_by_username(_username text)
returns table(
  id uuid,
  name text,
  username text,
  avatar text,
  level integer,
  xp integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.username, p.avatar, p.level, p.xp
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  where ur.role = 'student'
    and (
      lower(coalesce(p.username, '')) like '%' || lower(trim(_username)) || '%'
      or lower(coalesce(p.name, '')) like '%' || lower(trim(_username)) || '%'
    )
  order by
    case when lower(coalesce(p.username, '')) = lower(trim(_username)) then 0 else 1 end,
    p.username
  limit 20;
$$;

create or replace function public.send_friend_request(p_target_user_id uuid)
returns public.friends
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_friend public.friends%rowtype;
  v_existing public.friends%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_target_user_id is null or p_target_user_id = v_uid then
    raise exception 'Invalid friend target';
  end if;

  select * into v_existing
  from public.friends
  where (user_id = v_uid and friend_id = p_target_user_id)
     or (user_id = p_target_user_id and friend_id = v_uid)
  limit 1
  for update;

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
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_friend public.friends%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_friend
  from public.friends
  where id = p_request_id
    and friend_id = v_uid
    and status = 'pending'
  for update;

  if not found then raise exception 'Friend request not found'; end if;

  if p_accept then
    update public.friends
    set status = 'accepted', updated_at = now()
    where id = p_request_id
    returning * into v_friend;
  else
    delete from public.friends where id = p_request_id returning * into v_friend;
  end if;

  return v_friend;
end;
$$;

create or replace function public.remove_friend(p_friendship_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  delete from public.friends
  where id = p_friendship_id
    and (user_id = v_uid or friend_id = v_uid);

  return found;
end;
$$;

create or replace function public.send_direct_message(p_receiver_id uuid, p_content text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_message public.messages%rowtype;
  v_content text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_receiver_id is null or p_receiver_id = v_uid then raise exception 'Invalid recipient'; end if;

  v_content := left(trim(coalesce(p_content, '')), 2000);
  if v_content = '' then raise exception 'Message cannot be empty'; end if;

  insert into public.messages(sender_id, receiver_id, content)
  values (v_uid, p_receiver_id, v_content)
  returning * into v_message;

  return v_message;
end;
$$;

create or replace function public.mark_direct_message_read(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  update public.messages
  set read = true
  where id = p_message_id and receiver_id = v_uid;

  return found;
end;
$$;

grant execute on function public.find_student_by_username(text) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.send_direct_message(uuid, text) to authenticated;
grant execute on function public.mark_direct_message_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Multiplayer room lifecycle RPCs.
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_expired_multiplayer_rooms()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
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
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.multiplayer_rooms%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_max_players < 2 or p_max_players > 32 then raise exception 'Invalid player limit'; end if;
  if p_question_count < 1 or p_question_count > 50 then raise exception 'Invalid question count'; end if;

  insert into public.multiplayer_rooms(
    name, host_id, max_players, subject, difficulty,
    question_count, password, status, game_mode
  )
  values (
    left(trim(coalesce(p_name, 'Room')), 80),
    v_uid,
    p_max_players,
    coalesce(nullif(trim(p_subject), ''), 'Mixed'),
    coalesce(nullif(trim(p_difficulty), ''), 'Medium'),
    p_question_count,
    nullif(p_password, ''),
    'waiting',
    'speed'
  )
  returning * into v_room;

  insert into public.room_players(room_id, user_id, is_ready)
  values (v_room.id, v_uid, true);

  return v_room;
end;
$$;

create or replace function public.multiplayer_join_room(
  p_room_id uuid,
  p_password text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.multiplayer_rooms%rowtype;
  v_count integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_room
  from public.multiplayer_rooms
  where id = p_room_id
  for update;

  if not found or v_room.status not in ('waiting', 'countdown', 'playing') then
    raise exception 'Room is no longer available';
  end if;

  if v_room.password is not null and v_room.password <> coalesce(p_password, '') then
    raise exception 'Incorrect password';
  end if;

  if exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = v_uid
  ) then
    return true;
  end if;

  select count(*) into v_count from public.room_players where room_id = p_room_id;
  if v_count >= v_room.max_players then raise exception 'Room is full'; end if;

  insert into public.room_players(room_id, user_id, is_ready)
  values (p_room_id, v_uid, false);

  return true;
end;
$$;

create or replace function public.multiplayer_leave_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_next uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select host_id into v_host
  from public.multiplayer_rooms
  where id = p_room_id
  for update;

  if not found then return false; end if;

  delete from public.room_players
  where room_id = p_room_id and user_id = v_uid;

  if not found then return false; end if;

  if v_host = v_uid then
    select user_id into v_next
    from public.room_players
    where room_id = p_room_id
    order by joined_at nulls last
    limit 1;

    if v_next is null then
      delete from public.multiplayer_rooms where id = p_room_id;
    else
      update public.multiplayer_rooms set host_id = v_next where id = p_room_id;
    end if;
  end if;

  return true;
end;
$$;

create or replace function public.multiplayer_ensure_membership(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_max integer;
  v_count integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select status, max_players into v_status, v_max
  from public.multiplayer_rooms
  where id = p_room_id
  for update;

  if not found then raise exception 'Room not found'; end if;
  if v_status not in ('waiting', 'countdown', 'playing') then raise exception 'Room is no longer active'; end if;

  if exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = v_uid
  ) then
    return true;
  end if;

  select count(*) into v_count from public.room_players where room_id = p_room_id;
  if v_count >= v_max then raise exception 'Room is full'; end if;

  insert into public.room_players(room_id, user_id, is_ready)
  values (p_room_id, v_uid, false);

  return true;
end;
$$;

create or replace function public.multiplayer_toggle_ready(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ready boolean;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select is_ready into v_ready
  from public.room_players
  where room_id = p_room_id and user_id = v_uid
  for update;

  if not found then raise exception 'You are not in this room'; end if;

  if exists (
    select 1 from public.multiplayer_rooms
    where id = p_room_id and status not in ('waiting', 'countdown')
  ) then
    raise exception 'Ready state cannot be changed after the game starts';
  end if;

  update public.room_players
  set is_ready = not coalesce(v_ready, false)
  where room_id = p_room_id and user_id = v_uid;

  return not coalesce(v_ready, false);
end;
$$;

create or replace function public.multiplayer_update_room(
  p_room_id uuid,
  p_subject text,
  p_difficulty text,
  p_game_mode text,
  p_question_count integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select host_id into v_host
  from public.multiplayer_rooms
  where id = p_room_id and status = 'waiting'
  for update;

  if not found then raise exception 'Room not found or already started'; end if;
  if v_host <> v_uid then raise exception 'Only the host can update room settings'; end if;
  if p_question_count is null or p_question_count < 1 or p_question_count > 50 then
    raise exception 'Question count must be between 1 and 50';
  end if;

  update public.multiplayer_rooms
  set subject = coalesce(nullif(trim(p_subject), ''), 'Mixed'),
      difficulty = coalesce(nullif(trim(p_difficulty), ''), 'Medium'),
      game_mode = coalesce(nullif(trim(p_game_mode), ''), game_mode),
      question_count = p_question_count
  where id = p_room_id;

  return true;
end;
$$;

create or replace function public.multiplayer_kick_player(p_room_id uuid, p_player_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select host_id into v_host from public.multiplayer_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_host <> v_uid then raise exception 'Only the host can remove players'; end if;
  if p_player_id = v_uid then raise exception 'Host cannot kick themselves'; end if;

  delete from public.room_players
  where room_id = p_room_id and user_id = p_player_id;

  return found;
end;
$$;

create or replace function public.multiplayer_send_room_message(p_room_id uuid, p_content text)
returns public.room_chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_message public.room_chat_messages%rowtype;
  v_content text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = v_uid
  ) then raise exception 'You are not in this room'; end if;

  v_content := left(trim(coalesce(p_content, '')), 80);
  if v_content = '' then raise exception 'Message cannot be empty'; end if;

  insert into public.room_chat_messages(room_id, user_id, content)
  values (p_room_id, v_uid, v_content)
  returning * into v_message;

  return v_message;
end;
$$;

-- ---------------------------------------------------------------------------
-- Multiplayer answer integrity: align RPC parameter names with the client.
-- ---------------------------------------------------------------------------
drop function if exists public.multiplayer_start_game(uuid);
create or replace function public.multiplayer_start_game(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.multiplayer_rooms%rowtype;
  v_players integer;
  v_question_count integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_room
  from public.multiplayer_rooms
  where id = p_room_id
  for update;

  if not found then raise exception 'Room not found'; end if;
  if v_room.host_id <> v_uid then raise exception 'Only the host can start the game'; end if;

  select count(*) into v_players from public.room_players where room_id = p_room_id;
  if v_players < 2 then raise exception 'At least 2 players are required'; end if;

  delete from public.room_answers where room_id = p_room_id;
  delete from public.room_questions where room_id = p_room_id;

  update public.room_players set score = 0 where room_id = p_room_id;

  v_question_count := greatest(1, least(coalesce(v_room.question_count, 10), 50));

  insert into public.room_questions(room_id, question_id, order_index)
  select p_room_id, q.id,
         row_number() over (order by random()) - 1
  from public.questions q
  join public.quizzes qz on qz.id = q.quiz_id
  where qz.is_approved = true
    and (v_room.subject is null or qz.subject = v_room.subject)
    and (v_room.difficulty is null or qz.difficulty = v_room.difficulty)
  order by random()
  limit v_question_count;

  if not exists (select 1 from public.room_questions where room_id = p_room_id) then
    raise exception 'No approved questions are available for this room';
  end if;

  insert into public.room_state(
    room_id,status,question_index,current_question_id,
    question_started_at,question_ends_at
  )
  values (p_room_id,'playing',0,null,null,null)
  on conflict (room_id) do update set
    status='playing',
    question_index=0,
    current_question_id=null,
    question_started_at=null,
    question_ends_at=null,
    updated_at=now();

  update public.multiplayer_rooms
  set status='playing', started_at=now(), finished_at=null, current_question=0
  where id=p_room_id;

  return true;
end;
$$;

drop function if exists public.multiplayer_next_question(uuid);
create or replace function public.multiplayer_next_question(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_state public.room_state%rowtype;
  v_next uuid;
  v_data jsonb;
  v_total integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select host_id into v_host from public.multiplayer_rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_host <> v_uid then raise exception 'Only the host can advance the question'; end if;

  select * into v_state from public.room_state where room_id = p_room_id for update;
  if not found then raise exception 'Room state not found'; end if;

  select count(*) into v_total from public.room_questions where room_id = p_room_id;
  if v_total = 0 then raise exception 'No questions configured for this room'; end if;

  if v_state.question_index >= v_total then
    update public.room_state set status='finished',updated_at=now() where room_id=p_room_id;
    update public.multiplayer_rooms set status='finished',finished_at=now() where id=p_room_id;
    return jsonb_build_object('status','finished');
  end if;

  select q.id
  into v_next
  from public.room_questions rq
  join public.questions q on q.id=rq.question_id
  where rq.room_id=p_room_id and rq.order_index=v_state.question_index;

  if v_next is null then raise exception 'Question sequence is invalid'; end if;

  select jsonb_build_object(
    'id',q.id,
    'question_text',q.question_text,
    'options',q.options,
    'points',coalesce(q.points,10)
  ) into v_data
  from public.questions q
  where q.id=v_next;

  update public.room_state
  set status='playing',
      current_question_id=v_next,
      question_started_at=now(),
      question_ends_at=now()+interval '30 seconds',
      question_index=v_state.question_index+1,
      updated_at=now()
  where room_id=p_room_id;

  update public.multiplayer_rooms
  set current_question=v_state.question_index+1
  where id=p_room_id;

  return jsonb_build_object(
    'status','playing',
    'question',v_data,
    'question_index',v_state.question_index+1,
    'total_questions',v_total
  );
end;
$$;

drop function if exists public.multiplayer_submit_answer(uuid,uuid,text,integer);
create unique index if not exists room_answers_room_user_question_key
on public.room_answers(room_id,user_id,question_id);

create or replace function public.multiplayer_submit_answer(
  p_room_id uuid,
  p_question_id uuid,
  p_answer text,
  p_time_used integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_state public.room_state%rowtype;
  v_correct text;
  v_ok boolean;
  v_points integer;
  v_base integer;
  v_time integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  if not exists (
    select 1 from public.room_players
    where room_id=p_room_id and user_id=v_uid
  ) then raise exception 'You are not in this room'; end if;

  select * into v_state from public.room_state where room_id=p_room_id;
  if v_state.room_id is null or v_state.status <> 'playing' then
    raise exception 'The game is not accepting answers';
  end if;

  if v_state.current_question_id is distinct from p_question_id then
    raise exception 'This question is not currently active';
  end if;

  if not exists (
    select 1 from public.room_questions
    where room_id=p_room_id and question_id=p_question_id
  ) then raise exception 'Question does not belong to this room'; end if;

  v_time := greatest(0, least(coalesce(p_time_used,30),30));
  if v_state.question_ends_at is not null and now() > v_state.question_ends_at then
    v_time := 30;
  end if;

  select correct_answer,coalesce(points,10)
  into v_correct,v_base
  from public.questions
  where id=p_question_id;

  if v_correct is null then raise exception 'Question answer key is unavailable'; end if;

  v_ok := (p_answer = v_correct);
  v_points := case
    when v_ok then v_base + greatest(0,(30-v_time)*2)
    else 0
  end;

  insert into public.room_answers(
    room_id,user_id,question_id,answer,time_used,is_correct,points
  )
  values(p_room_id,v_uid,p_question_id,p_answer,v_time,v_ok,v_points)
  on conflict (room_id,user_id,question_id) do nothing;

  update public.room_players
  set score=score+v_points
  where room_id=p_room_id and user_id=v_uid
    and not exists (
      select 1 from public.room_answers
      where room_id=p_room_id
        and user_id=v_uid
        and question_id=p_question_id
        and id <> (select max(id) from public.room_answers where room_id=p_room_id and user_id=v_uid and question_id=p_question_id)
    );

  return jsonb_build_object(
    'is_correct',v_ok,
    'points',v_points
  );
end;
$$;

-- Answer visibility is limited to room participants.
drop policy if exists "Anyone can view room answers" on public.room_answers;
drop policy if exists "Players can view room answers" on public.room_answers;
create policy "Players can view room answers"
on public.room_answers
for select
to authenticated
using (
  exists (
    select 1 from public.room_players rp
    where rp.room_id = room_answers.room_id
      and rp.user_id = auth.uid()
  )
);

grant execute on function public.cleanup_expired_multiplayer_rooms() to authenticated;
grant execute on function public.multiplayer_create_room(text,text,text,integer,integer,text) to authenticated;
grant execute on function public.multiplayer_join_room(uuid,text) to authenticated;
grant execute on function public.multiplayer_leave_room(uuid) to authenticated;
grant execute on function public.multiplayer_ensure_membership(uuid) to authenticated;
grant execute on function public.multiplayer_toggle_ready(uuid) to authenticated;
grant execute on function public.multiplayer_update_room(uuid,text,text,text,integer) to authenticated;
grant execute on function public.multiplayer_kick_player(uuid,uuid) to authenticated;
grant execute on function public.multiplayer_send_room_message(uuid,text) to authenticated;
grant execute on function public.multiplayer_start_game(uuid) to authenticated;
grant execute on function public.multiplayer_next_question(uuid) to authenticated;
grant execute on function public.multiplayer_submit_answer(uuid,uuid,text,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Social image bucket.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-images',
  'social-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Social images public read" on storage.objects;
create policy "Social images public read"
on storage.objects
for select
to public
using (bucket_id = 'social-images');

drop policy if exists "Social images authenticated upload" on storage.objects;
create policy "Social images authenticated upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'social-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "Social images owner update" on storage.objects;
create policy "Social images owner update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'social-images'
  and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'social-images'
  and owner_id = (select auth.uid()::text)
);

drop policy if exists "Social images owner delete" on storage.objects;
create policy "Social images owner delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'social-images'
  and owner_id = (select auth.uid()::text)
);
