-- Verifiable guardian approval and granular social controls for learners under 18.
-- A signup checkbox is not treated as proof of parental consent.

create table if not exists public.guardian_consent_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  guardian_email text not null,
  guardian_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','revoked','expired')),
  consent_version text not null default 'guardian-social-v1',
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  verified_at timestamptz
);

alter table public.guardian_consent_requests
  add column if not exists guardian_attested_at timestamptz,
  add column if not exists guardian_attestation_version text;

create unique index if not exists guardian_consent_one_pending_per_student
  on public.guardian_consent_requests(student_id) where status = 'pending';

create table if not exists public.guardian_social_controls (
  student_id uuid primary key references auth.users(id) on delete cascade,
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  allow_friends boolean not null default false,
  allow_direct_messages boolean not null default false,
  allow_group_chat boolean not null default false,
  allow_public_posts boolean not null default false,
  allow_multiplayer boolean not null default false,
  allow_study_calls boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guardian_consent_requests enable row level security;
alter table public.guardian_social_controls enable row level security;
revoke all on public.guardian_consent_requests from anon, authenticated;
revoke all on public.guardian_social_controls from anon, authenticated;

-- Reconcile old checkbox-only consent. None of those rows are treated as verified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_account_type text := lower(trim(coalesce(new.raw_user_meta_data ->> 'account_type', 'individual')));
  v_gender text := lower(trim(coalesce(new.raw_user_meta_data ->> 'gender', '')));
  v_age_text text := trim(coalesce(new.raw_user_meta_data ->> 'age', ''));
  v_age integer;
  v_avatar text := trim(coalesce(new.raw_user_meta_data ->> 'avatar', ''));
  v_grade_input text := upper(trim(coalesce(new.raw_user_meta_data ->> 'grade', '')));
  v_grade text;
  v_education_level text;
  v_guardian_email text := nullif(lower(trim(new.raw_user_meta_data ->> 'guardian_email')), '');
begin
  if v_gender not in ('male', 'female') then v_gender := null; end if;
  if v_age_text ~ '^[0-9]{1,3}$' then
    v_age := v_age_text::integer;
    if v_age < 3 or v_age > 120 then v_age := null; end if;
  end if;
  if v_avatar = '' or length(v_avatar) > 80 then v_avatar := 'avatar-1'; end if;

  if v_grade_input in ('K', 'KG', 'KINDERGARTEN') then
    v_grade := 'KG';
    v_education_level := 'early';
  elsif v_grade_input ~ '^(GRADE[[:space:]]*)?(1[0-2]|[1-9])$' then
    v_grade := coalesce(substring(v_grade_input from '(1[0-2]|[1-9])'), '');
    v_education_level := case
      when v_grade::integer <= 4 then 'early'
      when v_grade::integer <= 8 then 'middle'
      else 'upper'
    end;
  end if;

  if v_age is not null and v_age < 18 then
    if v_guardian_email is null or v_guardian_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'A valid parent or guardian email is required for learners under 18';
    end if;
  else
    v_guardian_email := null;
  end if;

  insert into public.profiles (
    id, name, username, gender, age, avatar, grade, education_level,
    guardian_consent, guardian_email, consent_at
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    v_gender, v_age, v_avatar, v_grade, v_education_level,
    false, v_guardian_email, null
  );

  if v_account_type = 'individual_parent' then
    insert into public.user_roles(user_id, role)
    values (new.id, 'parent'::public.app_role)
    on conflict (user_id, role) do nothing;
  elsif v_account_type <> 'school' then
    insert into public.user_roles(user_id, role)
    values (new.id, 'student'::public.app_role)
    on conflict (user_id, role) do nothing;
  end if;

  return new;
end;
$function$;

create or replace function public.validate_guardian_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.age is not null and new.age < 18 then
    if new.guardian_email is not null then
      new.guardian_email := lower(trim(new.guardian_email));
      if new.guardian_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception 'Enter a valid parent or guardian email';
      end if;
    end if;

    if coalesce(new.guardian_consent, false) then
      if not exists (
        select 1
        from public.guardian_consent_requests r
        where r.student_id = new.id
          and r.guardian_email = new.guardian_email
          and r.status = 'approved'
          and r.guardian_user_id is not null
          and r.verified_at is not null
      ) then
        -- Legacy checkbox-only consent is not trusted. Silently reset it so
        -- unrelated profile updates do not fail and social access stays off.
        new.guardian_consent := false;
        new.consent_at := null;
      else
        if new.consent_at is null then new.consent_at := now(); end if;
      end if;
    else
      new.consent_at := null;
    end if;
  else
    new.guardian_consent := false;
    new.guardian_email := null;
    new.consent_at := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_guardian_consent_guard on public.profiles;
create trigger profiles_guardian_consent_guard
  before insert or update of age, guardian_consent, guardian_email on public.profiles
  for each row execute function public.validate_guardian_consent();
revoke all on function public.validate_guardian_consent() from public, anon, authenticated;

-- Existing checkbox-only consent remains ineffective: get_my_social_access
-- requires a linked guardian_social_controls row, and guardian_allows checks
-- the same row. This avoids unsafe bulk profile updates during migration.

create or replace function public.update_my_guardian_email(p_guardian_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_email text := lower(trim(coalesce(p_guardian_email, '')));
  v_student_email text;
  v_updated integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid parent or guardian email';
  end if;
  select lower(email) into v_student_email from auth.users where id = auth.uid();
  if v_email = v_student_email then raise exception 'Use a parent or guardian email different from your own'; end if;

  update public.profiles
  set guardian_email = v_email, guardian_consent = false, consent_at = null
  where id = auth.uid() and age is not null and age < 18;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then raise exception 'Guardian email is only required for learner accounts under 18'; end if;

  update public.guardian_consent_requests
  set status = 'expired'
  where student_id = auth.uid() and status = 'pending';

  return true;
end;
$function$;

create or replace function public.request_guardian_consent()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_student_id uuid := auth.uid();
  v_age integer;
  v_guardian_email text;
  v_student_email text;
  v_request_id uuid;
begin
  if v_student_id is null then raise exception 'Authentication required'; end if;

  select age, lower(guardian_email) into v_age, v_guardian_email
  from public.profiles where id = v_student_id;
  if v_age is null or v_age >= 18 then
    raise exception 'Verified guardian approval is only required for learner accounts under 18';
  end if;
  if v_guardian_email is null or v_guardian_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Add a valid parent or guardian email first';
  end if;

  select lower(email) into v_student_email from auth.users where id = v_student_id;
  if v_guardian_email = v_student_email then
    raise exception 'Use a parent or guardian email different from your own';
  end if;

  if exists (select 1 from public.guardian_social_controls where student_id = v_student_id) then
    raise exception 'A guardian is already linked. Ask that guardian to update or revoke the controls.';
  end if;

  update public.guardian_consent_requests
  set status = 'expired'
  where student_id = v_student_id and status = 'pending' and expires_at <= now();

  select id into v_request_id
  from public.guardian_consent_requests
  where student_id = v_student_id and status = 'pending' and expires_at > now()
  order by requested_at desc
  limit 1;

  if v_request_id is not null then return v_request_id; end if;

  insert into public.guardian_consent_requests(student_id, guardian_email, status, expires_at)
  values (v_student_id, v_guardian_email, 'pending', now() + interval '7 days')
  returning id into v_request_id;

  return v_request_id;
end;
$function$;

create or replace function public.approve_guardian_consent(p_request_id uuid, p_is_adult_guardian boolean)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_request public.guardian_consent_requests%rowtype;
  v_email text;
  v_email_confirmed_at timestamptz;
  v_guardian_age integer;
begin
  if auth.uid() is null then raise exception 'Guardian sign-in required'; end if;
  if coalesce(p_is_adult_guardian, false) is not true then
    raise exception 'Confirm that you are an adult parent or legal guardian before approving';
  end if;

  select email, email_confirmed_at into v_email, v_email_confirmed_at
  from auth.users where id = auth.uid();
  if v_email_confirmed_at is null or lower(v_email) is null then
    raise exception 'Verify the guardian email before approving';
  end if;

  select * into v_request
  from public.guardian_consent_requests
  where id = p_request_id and status = 'pending' and expires_at > now()
  for update;
  if v_request.id is null then raise exception 'This guardian approval link is invalid or expired'; end if;
  if lower(v_email) <> v_request.guardian_email then
    raise exception 'Sign in with the exact guardian email address that received this request';
  end if;
  if auth.uid() = v_request.student_id then raise exception 'The learner cannot approve their own guardian request'; end if;

  select age into v_guardian_age from public.profiles where id = auth.uid();
  if v_guardian_age is not null and v_guardian_age < 18 then
    raise exception 'A verified adult guardian account is required';
  end if;
  if v_guardian_age is null
     and not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'parent'::public.app_role) then
    raise exception 'A verified adult guardian account is required';
  end if;

  update public.guardian_consent_requests
  set status = 'approved',
      guardian_user_id = auth.uid(),
      verified_at = now(),
      guardian_attested_at = now(),
      guardian_attestation_version = 'guardian-social-v1'
  where id = p_request_id;

  update public.profiles
  set guardian_consent = true, consent_at = now()
  where id = v_request.student_id and age is not null and age < 18
    and lower(guardian_email) = v_request.guardian_email;

  if not found then raise exception 'The learner profile no longer matches this request'; end if;

  insert into public.guardian_social_controls(student_id, guardian_user_id)
  values (v_request.student_id, auth.uid());

  return true;
end;
$function$;

create or replace function public.revoke_guardian_consent(p_student_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_deleted integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  delete from public.guardian_social_controls
  where student_id = p_student_id and guardian_user_id = auth.uid();
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then raise exception 'You are not the verified guardian for this learner'; end if;

  update public.guardian_consent_requests
  set status = 'revoked'
  where student_id = p_student_id and guardian_user_id = auth.uid() and status = 'approved';

  update public.profiles
  set guardian_consent = false, consent_at = null
  where id = p_student_id;

  return true;
end;
$function$;

create or replace function public.get_my_social_access()
returns table (
  age integer,
  guardian_consent boolean,
  guardian_email text,
  allow_friends boolean,
  allow_direct_messages boolean,
  allow_group_chat boolean,
  allow_public_posts boolean,
  allow_multiplayer boolean,
  allow_study_calls boolean
)
language sql
stable
security definer
set search_path = public
as $function$
  select p.age, (coalesce(p.guardian_consent, false) and c.student_id is not null), p.guardian_email,
         coalesce(c.allow_friends, false),
         coalesce(c.allow_direct_messages, false),
         coalesce(c.allow_group_chat, false),
         coalesce(c.allow_public_posts, false),
         coalesce(c.allow_multiplayer, false),
         coalesce(c.allow_study_calls, false)
  from public.profiles p
  left join public.guardian_social_controls c on c.student_id = p.id
  where p.id = auth.uid();
$function$;

create or replace function public.get_my_guardian_students()
returns table (
  student_id uuid,
  student_name text,
  username text,
  grade text,
  age integer,
  allow_friends boolean,
  allow_direct_messages boolean,
  allow_group_chat boolean,
  allow_public_posts boolean,
  allow_multiplayer boolean,
  allow_study_calls boolean
)
language sql
stable
security definer
set search_path = public
as $function$
  select c.student_id, p.name, p.username, p.grade, p.age,
         c.allow_friends, c.allow_direct_messages, c.allow_group_chat,
         c.allow_public_posts, c.allow_multiplayer, c.allow_study_calls
  from public.guardian_social_controls c
  join public.profiles p on p.id = c.student_id
  where c.guardian_user_id = auth.uid()
  order by p.name;
$function$;

create or replace function public.update_guardian_social_controls(
  p_student_id uuid,
  p_allow_friends boolean,
  p_allow_direct_messages boolean,
  p_allow_group_chat boolean,
  p_allow_public_posts boolean,
  p_allow_multiplayer boolean,
  p_allow_study_calls boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_updated integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.guardian_social_controls
  set allow_friends = coalesce(p_allow_friends, false),
      allow_direct_messages = coalesce(p_allow_direct_messages, false),
      allow_group_chat = coalesce(p_allow_group_chat, false),
      allow_public_posts = coalesce(p_allow_public_posts, false),
      allow_multiplayer = coalesce(p_allow_multiplayer, false),
      allow_study_calls = coalesce(p_allow_study_calls, false),
      updated_at = now()
  where student_id = p_student_id and guardian_user_id = auth.uid();
  get diagnostics v_updated = row_count;
  if v_updated = 0 then raise exception 'You are not the verified guardian for this learner'; end if;
  return true;
end;
$function$;

create or replace function app_private.guardian_allows(p_user_id uuid, p_feature text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_age integer;
  v_consent boolean;
  v_allowed boolean;
begin
  if p_user_id is null then return false; end if;
  select p.age, coalesce(p.guardian_consent, false)
  into v_age, v_consent
  from public.profiles p where p.id = p_user_id;

  if not found then return false; end if;
  if v_age is not null and v_age >= 18 then return true; end if;
  if v_age is null and exists (
    select 1 from public.user_roles r
    where r.user_id = p_user_id
      and r.role in ('teacher'::public.app_role,'admin'::public.app_role,'manager'::public.app_role,'finance'::public.app_role,'parent'::public.app_role,'super_admin'::public.app_role,'extreme_admin'::public.app_role)
  ) then
    return true;
  end if;
  if v_age is null or not v_consent then return false; end if;

  select case p_feature
    when 'friends' then c.allow_friends
    when 'direct_messages' then c.allow_direct_messages
    when 'group_chat' then c.allow_group_chat
    when 'public_posts' then c.allow_public_posts
    when 'multiplayer' then c.allow_multiplayer
    when 'study_calls' then c.allow_study_calls
    else false
  end into v_allowed
  from public.guardian_social_controls c
  where c.student_id = p_user_id;

  return coalesce(v_allowed, false);
end;
$function$;

revoke all on function app_private.guardian_allows(uuid,text) from public, anon;
grant execute on function app_private.guardian_allows(uuid,text) to authenticated;

create or replace function app_private.enforce_guardian_social_permission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_first_user uuid;
  v_second_user uuid;
  v_post_author uuid;
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_table_name = 'friends' then
    if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status <> 'accepted' then return new; end if;
    v_first_user := new.user_id; v_second_user := new.friend_id;
    if not app_private.guardian_allows(v_first_user, 'friends') or not app_private.guardian_allows(v_second_user, 'friends') then
      raise exception using errcode = '42501', message = 'Parent or guardian approval is required for friend connections';
    end if;
  elsif tg_table_name = 'followers' then
    v_first_user := new.follower_id; v_second_user := new.following_id;
    if not app_private.guardian_allows(v_first_user, 'friends') or not app_private.guardian_allows(v_second_user, 'friends') then
      raise exception using errcode = '42501', message = 'Parent or guardian approval is required for following';
    end if;
  elsif tg_table_name = 'messages' then
    v_first_user := new.sender_id; v_second_user := new.receiver_id;
    if not app_private.guardian_allows(v_first_user, 'direct_messages') or not app_private.guardian_allows(v_second_user, 'direct_messages') then
      raise exception using errcode = '42501', message = 'Direct messaging is not enabled by the parent or guardian';
    end if;
  elsif tg_table_name = 'social_posts' then
    if not app_private.guardian_allows(new.author_id, 'public_posts') then
      raise exception using errcode = '42501', message = 'Public posting is not enabled by the parent or guardian';
    end if;
  elsif tg_table_name = 'social_post_comments' then
    select author_id into v_post_author from public.social_posts where id = new.post_id;
    if not app_private.guardian_allows(new.user_id, 'public_posts')
       or not app_private.guardian_allows(v_post_author, 'public_posts') then
      raise exception using errcode = '42501', message = 'Commenting is not enabled for this interaction';
    end if;
  elsif tg_table_name in ('social_post_likes','social_post_reactions','saved_posts') then
    select author_id into v_post_author from public.social_posts where id = new.post_id;
    if not app_private.guardian_allows(new.user_id, 'public_posts')
       or not app_private.guardian_allows(v_post_author, 'public_posts') then
      raise exception using errcode = '42501', message = 'Social post interactions are not enabled for this account';
    end if;
  elsif tg_table_name = 'group_messages' then
    if not app_private.guardian_allows(new.sender_id, 'group_chat')
       or exists (
         select 1 from public.chat_group_members m
         where m.group_id = new.group_id
           and not app_private.guardian_allows(m.user_id, 'group_chat')
       ) then
      raise exception using errcode = '42501', message = 'Group chat is not enabled for every member by their parent or guardian';
    end if;
  elsif tg_table_name = 'chat_groups' then
    if not app_private.guardian_allows(new.created_by, 'group_chat') then
      raise exception using errcode = '42501', message = 'Creating group chats is not enabled by the parent or guardian';
    end if;
  elsif tg_table_name = 'chat_group_members' then
    if not app_private.guardian_allows(new.user_id, 'group_chat') then
      raise exception using errcode = '42501', message = 'Group chat is not enabled by the parent or guardian';
    end if;
  elsif tg_table_name = 'lobby_messages' then
    if not app_private.guardian_allows(new.user_id, 'multiplayer') then
      raise exception using errcode = '42501', message = 'Multiplayer chat is not enabled by the parent or guardian';
    end if;
  elsif tg_table_name = 'room_chat_messages' then
    if not app_private.guardian_allows(new.user_id, 'multiplayer') then
      raise exception using errcode = '42501', message = 'Multiplayer room chat is not enabled by the parent or guardian';
    end if;
  elsif tg_table_name = 'multiplayer_invites' then
    if tg_op = 'UPDATE' and new.status in ('declined','cancelled') then return new; end if;
    if not app_private.guardian_allows(new.sender_id, 'multiplayer')
       or not app_private.guardian_allows(new.receiver_id, 'multiplayer') then
      raise exception using errcode = '42501', message = 'Multiplayer invitations are not enabled by the parent or guardian';
    end if;
  elsif tg_table_name = 'study_call_rooms' then
    if not app_private.guardian_allows(new.created_by, 'study_calls') then
      raise exception using errcode = '42501', message = 'Study Mode calls are not enabled by the parent or guardian';
    end if;
  elsif tg_table_name = 'study_call_participants' then
    if tg_op = 'UPDATE' and new.status in ('declined','left') then return new; end if;
    if (new.invited_by is not null and not app_private.guardian_allows(new.invited_by, 'study_calls'))
       or not app_private.guardian_allows(new.user_id, 'study_calls') then
      raise exception using errcode = '42501', message = 'Study Mode calls are not enabled for both participants';
    end if;
  elsif tg_table_name in ('room_players','tournament_participants') then
    if not app_private.guardian_allows(new.user_id, 'multiplayer') then
      raise exception using errcode = '42501', message = 'Multiplayer is not enabled by the parent or guardian';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function app_private.enforce_guardian_social_permission() from public, anon, authenticated;

create or replace function app_private.revoke_child_consent_after_guardian_unlink()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  update public.profiles
  set guardian_consent = false, consent_at = null
  where id = old.student_id;

  update public.guardian_consent_requests
  set status = 'revoked', guardian_user_id = null
  where student_id = old.student_id and status = 'approved';

  return old;
end;
$function$;

revoke all on function app_private.revoke_child_consent_after_guardian_unlink() from public, anon, authenticated;
drop trigger if exists guardian_unlink_revokes_child_consent on public.guardian_social_controls;
create trigger guardian_unlink_revokes_child_consent
  after delete on public.guardian_social_controls
  for each row execute function app_private.revoke_child_consent_after_guardian_unlink();

-- Enforce guardian permissions at write time in addition to route-level UI gates.
drop trigger if exists guardian_check_friends on public.friends;
create trigger guardian_check_friends before insert or update of user_id, friend_id on public.friends
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_followers on public.followers;
create trigger guardian_check_followers before insert or update of follower_id, following_id on public.followers
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_messages on public.messages;
create trigger guardian_check_messages before insert on public.messages
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_social_posts on public.social_posts;
create trigger guardian_check_social_posts before insert or update on public.social_posts
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_social_comments on public.social_post_comments;
create trigger guardian_check_social_comments before insert or update on public.social_post_comments
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_social_likes on public.social_post_likes;
create trigger guardian_check_social_likes before insert on public.social_post_likes
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_social_reactions on public.social_post_reactions;
create trigger guardian_check_social_reactions before insert on public.social_post_reactions
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_saved_posts on public.saved_posts;
create trigger guardian_check_saved_posts before insert on public.saved_posts
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_group_messages on public.group_messages;
create trigger guardian_check_group_messages before insert on public.group_messages
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_chat_groups on public.chat_groups;
create trigger guardian_check_chat_groups before insert or update on public.chat_groups
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_chat_group_members on public.chat_group_members;
create trigger guardian_check_chat_group_members before insert or update on public.chat_group_members
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_lobby_messages on public.lobby_messages;
create trigger guardian_check_lobby_messages before insert on public.lobby_messages
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_room_chat on public.room_chat_messages;
create trigger guardian_check_room_chat before insert on public.room_chat_messages
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_multiplayer_invites on public.multiplayer_invites;
create trigger guardian_check_multiplayer_invites before insert or update on public.multiplayer_invites
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_study_call_rooms on public.study_call_rooms;
create trigger guardian_check_study_call_rooms before insert or update on public.study_call_rooms
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_study_call_participants on public.study_call_participants;
create trigger guardian_check_study_call_participants before insert or update on public.study_call_participants
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_room_players on public.room_players;
create trigger guardian_check_room_players before insert on public.room_players
  for each row execute function app_private.enforce_guardian_social_permission();
drop trigger if exists guardian_check_tournament_participants on public.tournament_participants;
create trigger guardian_check_tournament_participants before insert on public.tournament_participants
  for each row execute function app_private.enforce_guardian_social_permission();

-- Add guardian checks to existing read policies so old content is not exposed
-- after a guardian disables a feature.
drop policy if exists "involved users can view unblocked friendships" on public.friends;
create policy "involved users can view unblocked friendships"
  on public.friends for select to authenticated
  using (
    (user_id = (select auth.uid()) or friend_id = (select auth.uid()))
    and not app_private.is_user_blocked(user_id, friend_id)
    and app_private.guardian_allows(user_id, 'friends')
    and app_private.guardian_allows(friend_id, 'friends')
  );

drop policy if exists "users can view unblocked follows" on public.followers;
create policy "users can view unblocked follows"
  on public.followers for select to authenticated
  using (
    (follower_id = (select auth.uid()) or following_id = (select auth.uid()))
    and not app_private.is_user_blocked(follower_id, following_id)
    and app_private.guardian_allows(follower_id, 'friends')
    and app_private.guardian_allows(following_id, 'friends')
  );

drop policy if exists "users can view opted-in posts excluding blocked authors" on public.social_posts;
create policy "users can view opted-in posts excluding blocked authors"
  on public.social_posts for select to authenticated
  using (
    (
      moderation_status = 'visible'
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
    )
    and (
      author_id = (select auth.uid())
      or coalesce((select p.is_public from public.profile_privacy_settings p where p.user_id = social_posts.author_id), true)
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
    )
    and (
      author_id = (select auth.uid())
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
      or (
        not app_private.is_user_blocked(author_id, (select auth.uid()))
        and app_private.guardian_allows(author_id, 'public_posts')
      )
    )
  );

drop policy if exists "users can view visible comments excluding blocked authors" on public.social_post_comments;
create policy "users can view visible comments excluding blocked authors"
  on public.social_post_comments for select to authenticated
  using (
    (
      moderation_status = 'visible'
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
    )
    and (
      not app_private.is_user_blocked(user_id, (select auth.uid()))
      and app_private.guardian_allows(user_id, 'public_posts')
    )
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_comments.post_id
        and (
          p.author_id = (select auth.uid())
          or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true)
          or has_role((select auth.uid()), 'admin'::public.app_role)
          or has_role((select auth.uid()), 'manager'::public.app_role)
          or (select public._is_extreme_admin())
        )
    )
  );

drop policy if exists "involved users can view unblocked messages" on public.messages;
create policy "involved users can view unblocked messages"
  on public.messages for select to authenticated
  using (
    (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and moderation_status = 'visible'
    and not app_private.is_user_blocked(sender_id, receiver_id)
    and app_private.guardian_allows(sender_id, 'direct_messages')
    and app_private.guardian_allows(receiver_id, 'direct_messages')
  );

drop policy if exists "members can view group messages excluding blocked senders" on public.group_messages;
create policy "members can view group messages excluding blocked senders"
  on public.group_messages for select to authenticated
  using (
    exists (
      select 1 from public.chat_group_members m
      where m.group_id = group_messages.group_id
        and m.user_id = (select auth.uid())
    )
    and moderation_status = 'visible'
    and not app_private.is_user_blocked(sender_id, (select auth.uid()))
    and app_private.guardian_allows(sender_id, 'group_chat')
    and app_private.guardian_allows((select auth.uid()), 'group_chat')
  );

drop policy if exists "authenticated can view unblocked lobby messages" on public.lobby_messages;
create policy "authenticated can view unblocked lobby messages"
  on public.lobby_messages for select to authenticated
  using (
    moderation_status = 'visible'
    and not app_private.is_user_blocked(user_id, (select auth.uid()))
    and app_private.guardian_allows(user_id, 'multiplayer')
    and app_private.guardian_allows((select auth.uid()), 'multiplayer')
  );

drop policy if exists "room members can view unblocked room chat" on public.room_chat_messages;
create policy "room members can view unblocked room chat"
  on public.room_chat_messages for select to authenticated
  using (
    is_multiplayer_room_member(room_id)
    and moderation_status = 'visible'
    and not app_private.is_user_blocked(user_id, (select auth.uid()))
    and app_private.guardian_allows(user_id, 'multiplayer')
    and app_private.guardian_allows((select auth.uid()), 'multiplayer')
  );

drop policy if exists "users can view visible likes excluding blocked users" on public.social_post_likes;
create policy "users can view visible likes excluding blocked users"
  on public.social_post_likes for select to authenticated
  using (
    not app_private.is_user_blocked(user_id, (select auth.uid()))
    and app_private.guardian_allows(user_id, 'public_posts')
    and exists (select 1 from public.social_posts p where p.id = social_post_likes.post_id and p.moderation_status = 'visible' and app_private.guardian_allows(p.author_id, 'public_posts') and not app_private.is_user_blocked(p.author_id, (select auth.uid())))
  );

drop policy if exists "users can view visible reactions excluding blocked users" on public.social_post_reactions;
create policy "users can view visible reactions excluding blocked users"
  on public.social_post_reactions for select to authenticated
  using (
    not app_private.is_user_blocked(user_id, (select auth.uid()))
    and app_private.guardian_allows(user_id, 'public_posts')
    and exists (select 1 from public.social_posts p where p.id = social_post_reactions.post_id and p.moderation_status = 'visible' and app_private.guardian_allows(p.author_id, 'public_posts') and not app_private.is_user_blocked(p.author_id, (select auth.uid())))
  );

drop policy if exists "users can view own saved posts" on public.saved_posts;
create policy "users can view own saved posts"
  on public.saved_posts for select to authenticated
  using (
    user_id = (select auth.uid())
    and app_private.guardian_allows(user_id, 'public_posts')
  );

drop policy if exists "involved can view invite" on public.multiplayer_invites;
create policy "involved can view invite"
  on public.multiplayer_invites for select to authenticated
  using (
    (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and app_private.guardian_allows(sender_id, 'multiplayer')
    and app_private.guardian_allows(receiver_id, 'multiplayer')
  );

drop policy if exists "participants can view own invitations" on public.study_call_participants;
create policy "participants can view own invitations"
  on public.study_call_participants for select to authenticated
  using (
    (user_id = (select auth.uid()) or invited_by = (select auth.uid()))
    and app_private.guardian_allows(user_id, 'study_calls')
    and app_private.guardian_allows(invited_by, 'study_calls')
  );

drop policy if exists "room_players_member_or_public_lobby_read" on public.room_players;
create policy "room_players_member_or_public_lobby_read"
  on public.room_players for select to authenticated
  using (
    (is_multiplayer_room_member(room_id) or is_multiplayer_public_room(room_id))
    and app_private.guardian_allows(user_id, 'multiplayer')
    and app_private.guardian_allows((select auth.uid()), 'multiplayer')
  );

drop policy if exists "authenticated can view participants" on public.tournament_participants;
create policy "authenticated can view participants"
  on public.tournament_participants for select to authenticated
  using (
    app_private.guardian_allows(user_id, 'multiplayer')
    and app_private.guardian_allows((select auth.uid()), 'multiplayer')
  );


-- Replace remaining permissive group and call policies so a disabled feature
-- cannot be recovered through a direct table query or an old ALL policy.
drop policy if exists "users can create unblocked follows" on public.followers;
create policy "users can create guardian-enabled follows"
  on public.followers for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and not app_private.is_user_blocked(follower_id, following_id)
    and app_private.guardian_allows(follower_id, 'friends')
    and app_private.guardian_allows(following_id, 'friends')
  );
drop policy if exists "users can update own unblocked follows" on public.followers;
create policy "users can update guardian-enabled follows"
  on public.followers for update to authenticated
  using (
    follower_id = (select auth.uid())
    and not app_private.is_user_blocked(follower_id, following_id)
  )
  with check (
    follower_id = (select auth.uid())
    and not app_private.is_user_blocked(follower_id, following_id)
    and app_private.guardian_allows(follower_id, 'friends')
    and app_private.guardian_allows(following_id, 'friends')
  );

drop policy if exists "receiver responds to invite" on public.multiplayer_invites;
create policy "participants respond to guardian-enabled invites"
  on public.multiplayer_invites for update to authenticated
  using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
  with check (
    (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and (
      status in ('declined','cancelled')
      or (
        app_private.guardian_allows(sender_id, 'multiplayer')
        and app_private.guardian_allows(receiver_id, 'multiplayer')
      )
    )
  );

drop policy if exists "invitee responds to own call invitation" on public.study_call_participants;
create policy "invitees respond within guardian call controls"
  on public.study_call_participants for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and status = any (array['accepted'::text,'declined'::text,'left'::text])
    and (
      status in ('declined','left')
      or (
        app_private.guardian_allows(user_id, 'study_calls')
        and (invited_by is null or app_private.guardian_allows(invited_by, 'study_calls'))
      )
    )
  );

drop policy if exists "user updates own entry" on public.tournament_participants;
create policy "users update guardian-enabled tournament entry"
  on public.tournament_participants for update to authenticated
  using (user_id = (select auth.uid()) or has_role((select auth.uid()), 'admin'::public.app_role))
  with check (
    (
      user_id = (select auth.uid())
      and app_private.guardian_allows(user_id, 'multiplayer')
    )
    or has_role((select auth.uid()), 'admin'::public.app_role)
  );

drop policy if exists "creator manages group" on public.chat_groups;
drop policy if exists "members can view group" on public.chat_groups;
create policy "members view guardian-enabled groups"
  on public.chat_groups for select to authenticated
  using (
    (
      group_type = any (array['public'::text,'class'::text])
      or created_by = (select auth.uid())
      or exists (
        select 1 from public.chat_group_members m
        where m.group_id = chat_groups.id and m.user_id = (select auth.uid())
      )
    )
    and (
      app_private.guardian_allows(created_by, 'group_chat')
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
    )
    and (
      app_private.guardian_allows((select auth.uid()), 'group_chat')
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
    )
  );
create policy "creators and moderators update groups"
  on public.chat_groups for update to authenticated
  using (
    (created_by = (select auth.uid()) and app_private.guardian_allows(created_by, 'group_chat'))
    or has_role((select auth.uid()), 'admin'::public.app_role)
    or has_role((select auth.uid()), 'manager'::public.app_role)
    or (select public._is_extreme_admin())
  )
  with check (
    (created_by = (select auth.uid()) and app_private.guardian_allows(created_by, 'group_chat'))
    or has_role((select auth.uid()), 'admin'::public.app_role)
    or has_role((select auth.uid()), 'manager'::public.app_role)
    or (select public._is_extreme_admin())
  );
create policy "creators and moderators delete groups"
  on public.chat_groups for delete to authenticated
  using (
    created_by = (select auth.uid())
    or has_role((select auth.uid()), 'admin'::public.app_role)
    or has_role((select auth.uid()), 'manager'::public.app_role)
    or (select public._is_extreme_admin())
  );

drop policy if exists "group admin manages members" on public.chat_group_members;
drop policy if exists "members can view roster" on public.chat_group_members;
create policy "members view guardian-enabled roster"
  on public.chat_group_members for select to authenticated
  using (
    (user_id = (select auth.uid()) or is_chat_group_member(group_id))
    and app_private.guardian_allows(user_id, 'group_chat')
    and app_private.guardian_allows((select auth.uid()), 'group_chat')
  );
create policy "group creators add guardian-enabled members"
  on public.chat_group_members for insert to authenticated
  with check (
    is_chat_group_creator(group_id)
    and app_private.guardian_allows(user_id, 'group_chat')
  );
create policy "group creators update guardian-enabled members"
  on public.chat_group_members for update to authenticated
  using (user_id = (select auth.uid()) or is_chat_group_creator(group_id))
  with check (
    (user_id = (select auth.uid()) or is_chat_group_creator(group_id))
    and app_private.guardian_allows(user_id, 'group_chat')
  );
create policy "members leave or creators remove members"
  on public.chat_group_members for delete to authenticated
  using (user_id = (select auth.uid()) or is_chat_group_creator(group_id));

drop policy if exists "study call participants can view their rooms" on public.study_call_rooms;
drop policy if exists "users can view own created study call rooms" on public.study_call_rooms;
create policy "participants view guardian-enabled study call rooms"
  on public.study_call_rooms for select to authenticated
  using (
    (
      created_by = (select auth.uid())
      and app_private.guardian_allows(created_by, 'study_calls')
    )
    or exists (
      select 1 from public.study_call_participants p
      where p.room_id = study_call_rooms.id
        and p.user_id = (select auth.uid())
        and app_private.guardian_allows(p.user_id, 'study_calls')
        and (p.invited_by is null or app_private.guardian_allows(p.invited_by, 'study_calls'))
    )
  );

-- Public RPCs used by the learner gate and verified guardian controls.
revoke all on function public.update_my_guardian_email(text) from public, anon;
grant execute on function public.update_my_guardian_email(text) to authenticated;
revoke all on function public.request_guardian_consent() from public, anon;
grant execute on function public.request_guardian_consent() to authenticated;
revoke all on function public.approve_guardian_consent(uuid,boolean) from public, anon;
grant execute on function public.approve_guardian_consent(uuid,boolean) to authenticated;
revoke all on function public.revoke_guardian_consent(uuid) from public, anon;
grant execute on function public.revoke_guardian_consent(uuid) to authenticated;
revoke all on function public.get_my_social_access() from public, anon;
grant execute on function public.get_my_social_access() to authenticated;
revoke all on function public.get_my_guardian_students() from public, anon;
grant execute on function public.get_my_guardian_students() to authenticated;
revoke all on function public.update_guardian_social_controls(uuid,boolean,boolean,boolean,boolean,boolean,boolean) from public, anon;
grant execute on function public.update_guardian_social_controls(uuid,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;
