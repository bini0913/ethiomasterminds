-- Verified guardian approval and parent-managed social controls for minor learner accounts.
alter table public.profiles
  add column if not exists guardian_consent_status text not null default 'not_required',
  add column if not exists guardian_user_id uuid references auth.users(id) on delete set null;

alter table public.profiles
  drop constraint if exists profiles_guardian_consent_status_check;
alter table public.profiles
  add constraint profiles_guardian_consent_status_check
  check (guardian_consent_status in ('not_required', 'pending', 'verified', 'rejected', 'revoked'));

-- Account restrictions apply to every role-based portal and feature gate.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
      from public.user_roles ur
      join public.profiles p on p.id = ur.user_id
     where ur.user_id = _user_id
       and ur.role = _role
       and coalesce(p.account_status, 'active') = 'active'
  );
$$;

alter table public.profile_privacy_settings
  add column if not exists allow_friend_requests boolean not null default true,
  add column if not exists allow_messages boolean not null default true;

create table if not exists public.guardian_consent_requests (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references auth.users(id) on delete cascade,
  guardian_email text not null,
  guardian_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'revoked')),
  parent_attested boolean not null default false,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists guardian_consent_one_pending_per_child
  on public.guardian_consent_requests (child_id)
  where status = 'pending';
create index if not exists guardian_consent_guardian_email_idx
  on public.guardian_consent_requests (lower(guardian_email), status);
create index if not exists guardian_consent_guardian_user_idx
  on public.guardian_consent_requests (guardian_user_id, status);

create table if not exists public.guardian_child_controls (
  child_id uuid primary key references auth.users(id) on delete cascade,
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  social_enabled boolean not null default false,
  friend_requests_enabled boolean not null default false,
  direct_messages_enabled boolean not null default false,
  multiplayer_enabled boolean not null default false,
  calls_enabled boolean not null default false,
  profile_public boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.guardian_consent_requests enable row level security;
alter table public.guardian_child_controls enable row level security;
revoke all on public.guardian_consent_requests from anon, authenticated;
revoke all on public.guardian_child_controls from anon, authenticated;

-- Do not trust the signup checkbox. Every minor starts pending and unapproved.
create or replace function public.validate_guardian_consent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_child_email text;
begin
  if new.age is not null and new.age < 18 then
    new.guardian_email := nullif(lower(trim(coalesce(new.guardian_email, ''))), '');
    if new.guardian_email is not null then
      select lower(u.email) into v_child_email from auth.users u where u.id = new.id;
      if new.guardian_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
         or new.guardian_email = v_child_email then
        raise exception 'A separate, valid parent or guardian email is required';
      end if;
    end if;

    if coalesce(new.guardian_consent, false) and new.guardian_user_id is null then
      -- If the linked guardian account is deleted, revoke consent rather than
      -- blocking deletion of the guardian account or leaving stale approval.
      new.guardian_consent := false;
      new.guardian_consent_status := 'revoked';
      new.consent_at := null;
    elsif coalesce(new.guardian_consent, false) then
      if new.guardian_consent_status <> 'verified'
         or new.consent_at is null
         or not exists (
           select 1 from public.guardian_consent_requests r
           where r.child_id = new.id
             and r.guardian_user_id = new.guardian_user_id
             and r.status = 'approved'
             and r.parent_attested = true
         ) then
        raise exception 'Guardian consent can only be set by the verified guardian approval workflow';
      end if;
    else
      new.guardian_consent := false;
      new.consent_at := null;
      new.guardian_user_id := null;
      if new.guardian_consent_status not in ('pending', 'rejected', 'revoked') then
        new.guardian_consent_status := 'pending';
      end if;
    end if;
  else
    new.guardian_consent := false;
    new.guardian_email := null;
    new.consent_at := null;
    new.guardian_user_id := null;
    new.guardian_consent_status := 'not_required';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guardian_consent_guard on public.profiles;
create trigger profiles_guardian_consent_guard
  before insert or update of age, guardian_consent, guardian_email, guardian_consent_status, guardian_user_id, consent_at
  on public.profiles
  for each row execute function public.validate_guardian_consent();
revoke all on function public.validate_guardian_consent() from public, anon, authenticated;

create or replace function public.apply_minor_private_defaults()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.age is not null and new.age < 18 then
    insert into public.profile_privacy_settings(user_id, is_public, allow_friend_requests, allow_messages, updated_at)
    values (
      new.id,
      false,
      false,
      false,
      now()
    )
    on conflict (user_id) do update set
      is_public = false,
      allow_friend_requests = false,
      allow_messages = false,
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_minor_private_defaults on public.profiles;
create trigger profiles_minor_private_defaults
  after insert or update of age, guardian_consent, guardian_consent_status, guardian_user_id
  on public.profiles
  for each row execute function public.apply_minor_private_defaults();
revoke all on function public.apply_minor_private_defaults() from public, anon, authenticated;

-- Replace the Auth trigger so a child signup creates a pending request, never
-- a verified consent record. The guardian request ID is supplied by the app.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
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
  v_guardian_request_id uuid;
begin
  if v_gender not in ('male', 'female') then v_gender := null; end if;
  if v_age_text ~ '^[0-9]{1,3}$' then
    v_age := v_age_text::integer;
    if v_age < 3 or v_age > 120 then v_age := null; end if;
  end if;
  if v_avatar = '' or length(v_avatar) > 80 then v_avatar := 'avatar-1'; end if;

  if v_grade_input in ('K', 'KG', 'KINDERGARTEN') then
    v_grade := 'KG'; v_education_level := 'early';
  elsif v_grade_input ~ '^(GRADE[[:space:]]*)?(1[0-2]|[1-9])$' then
    v_grade := coalesce(substring(v_grade_input from '(1[0-2]|[1-9])'), '');
    v_education_level := case when v_grade::integer <= 4 then 'early' when v_grade::integer <= 8 then 'middle' else 'upper' end;
  end if;

  if v_age is not null and v_age < 18 then
    if v_guardian_email is null
       or v_guardian_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       or v_guardian_email = lower(new.email) then
      raise exception 'A separate, valid parent or guardian email is required for learners under 18';
    end if;
    if coalesce(new.raw_user_meta_data ->> 'guardian_consent_request_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      v_guardian_request_id := (new.raw_user_meta_data ->> 'guardian_consent_request_id')::uuid;
    else
      v_guardian_request_id := gen_random_uuid();
    end if;
  else
    v_guardian_email := null;
  end if;

  insert into public.profiles (
    id, name, username, gender, age, avatar, grade, education_level,
    guardian_consent, guardian_email, consent_at, guardian_consent_status
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    v_gender, v_age, v_avatar, v_grade, v_education_level,
    false, v_guardian_email, null,
    case when v_age is not null and v_age < 18 then 'pending' else 'not_required' end
  );

  if v_age is not null and v_age < 18 then
    insert into public.guardian_consent_requests(id, child_id, guardian_email)
    values (v_guardian_request_id, new.id, v_guardian_email);
  end if;

  if v_account_type = 'individual_parent' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'parent'::public.app_role)
    on conflict (user_id, role) do nothing;
  elsif v_account_type <> 'school' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'student'::public.app_role)
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

-- Existing checkbox-based consent was not verifiable. Reset it to pending.
update public.profiles
   set guardian_consent = false,
       consent_at = null,
       guardian_user_id = null,
       guardian_consent_status = case when age is not null and age < 18 then 'pending' else 'not_required' end
 where (age is not null and age < 18 and (guardian_consent = true or guardian_consent_status <> 'pending'))
    or (age is null or age >= 18) and guardian_consent_status <> 'not_required';

insert into public.guardian_consent_requests(child_id, guardian_email)
select p.id, lower(trim(p.guardian_email))
  from public.profiles p
  join auth.users u on u.id = p.id
 where p.age is not null and p.age < 18
   and p.guardian_email is not null
   and lower(trim(p.guardian_email)) <> lower(u.email)
   and not exists (
     select 1 from public.guardian_consent_requests r
     where r.child_id = p.id and r.status = 'pending'
   );

create or replace function public.create_guardian_consent_request(p_guardian_email text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_child_id uuid := auth.uid();
  v_child_email text;
  v_guardian_email text := nullif(lower(trim(coalesce(p_guardian_email, ''))), '');
  v_request_id uuid;
begin
  if v_child_id is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if v_guardian_email is null or v_guardian_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid parent or guardian email';
  end if;
  select lower(u.email) into v_child_email from auth.users u where u.id = v_child_id;
  if v_guardian_email = v_child_email then raise exception 'Use a separate parent or guardian email'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_child_id and p.age is not null and p.age < 18) then
    raise exception 'Guardian approval is only required for learner accounts under 18';
  end if;

  update public.guardian_consent_requests
     set status = 'rejected', reviewed_at = now()
   where child_id = v_child_id and status = 'pending' and lower(guardian_email) <> v_guardian_email;

  select r.id into v_request_id
    from public.guardian_consent_requests r
   where r.child_id = v_child_id and lower(r.guardian_email) = v_guardian_email and r.status = 'pending'
   order by r.created_at desc limit 1;

  if v_request_id is null then
    insert into public.guardian_consent_requests(child_id, guardian_email)
    values (v_child_id, v_guardian_email)
    returning id into v_request_id;
  end if;

  update public.profiles
     set guardian_email = v_guardian_email,
         guardian_consent = false,
         guardian_consent_status = 'pending',
         guardian_user_id = null,
         consent_at = null
   where id = v_child_id;
  return v_request_id;
end;
$$;

create or replace function public.set_my_age_and_guardian(p_age integer, p_guardian_email text default null)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_guardian_email text := nullif(lower(trim(coalesce(p_guardian_email, ''))), '');
  v_request_id uuid;
begin
  if v_user_id is null or not public.has_role(v_user_id, 'student'::public.app_role) then
    raise exception using errcode = '42501', message = 'Learner account required';
  end if;
  if p_age is null or p_age < 3 or p_age > 120 then raise exception 'Enter a valid age'; end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_user_id;

  if p_age < 18 then
    if v_guardian_email is null
       or v_guardian_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+
returns table (
  request_id uuid,
  child_name text,
  child_username text,
  child_grade text,
  child_age integer,
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.has_role(v_user_id, 'parent'::public.app_role) then
    raise exception using errcode = '42501', message = 'A signed-in parent account is required';
  end if;
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
    from auth.users u where u.id = v_user_id;
  if v_confirmed is null then raise exception 'Confirm the parent email before reviewing this request'; end if;

  return query
  select r.id, p.name, p.username, p.grade, p.age, r.created_at
    from public.guardian_consent_requests r
    join public.profiles p on p.id = r.child_id
   where r.id = p_request_id
     and r.status = 'pending'
     and lower(r.guardian_email) = v_email;
  if not found then raise exception 'No pending guardian request matches this verified parent email'; end if;
end;
$$;

create or replace function public.approve_guardian_consent(p_request_id uuid, p_parent_attestation boolean)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_parent_id uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_request public.guardian_consent_requests%rowtype;
begin
  if v_parent_id is null or not public.has_role(v_parent_id, 'parent'::public.app_role) then
    raise exception using errcode = '42501', message = 'A signed-in parent account is required';
  end if;
  if p_parent_attestation is not true then raise exception 'Parent or guardian confirmation is required'; end if;
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_parent_id;
  if v_confirmed is null then raise exception 'Confirm the parent email before approving'; end if;

  select * into v_request from public.guardian_consent_requests
   where id = p_request_id and status = 'pending' for update;
  if not found then raise exception 'Guardian request is no longer pending'; end if;
  if lower(v_request.guardian_email) <> v_email or v_request.child_id = v_parent_id then
    raise exception 'This approval link does not match the verified guardian email';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_request.child_id and p.age is not null and p.age < 18) then
    raise exception 'The linked learner is not an under-18 account';
  end if;

  update public.guardian_consent_requests
     set status = 'approved', guardian_user_id = v_parent_id, parent_attested = true, reviewed_at = now()
   where id = p_request_id;

  update public.profiles
     set guardian_consent = true,
         guardian_consent_status = 'verified',
         guardian_user_id = v_parent_id,
         consent_at = now()
   where id = v_request.child_id;

  insert into public.guardian_child_controls(child_id, guardian_user_id)
  values (v_request.child_id, v_parent_id)
  on conflict (child_id) do update set guardian_user_id = excluded.guardian_user_id;
end;
$$;

create or replace function public.reject_guardian_consent(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_parent_id uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_request public.guardian_consent_requests%rowtype;
begin
  if v_parent_id is null or not public.has_role(v_parent_id, 'parent'::public.app_role) then
    raise exception using errcode = '42501', message = 'A signed-in parent account is required';
  end if;
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_parent_id;
  if v_confirmed is null then raise exception 'Confirm the parent email before responding'; end if;
  select * into v_request from public.guardian_consent_requests where id = p_request_id and status = 'pending' for update;
  if not found or lower(v_request.guardian_email) <> v_email then raise exception 'No matching pending request was found'; end if;

  update public.guardian_consent_requests set status = 'rejected', guardian_user_id = v_parent_id, reviewed_at = now()
   where id = p_request_id;
  update public.profiles set guardian_consent = false, guardian_consent_status = 'rejected',
    guardian_user_id = null, consent_at = null where id = v_request.child_id;
end;
$$;

create or replace function public.list_guardian_children()
returns table (
  child_id uuid,
  child_name text,
  child_username text,
  child_grade text,
  child_age integer,
  social_enabled boolean,
  friend_requests_enabled boolean,
  direct_messages_enabled boolean,
  multiplayer_enabled boolean,
  calls_enabled boolean,
  profile_public boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_parent_id uuid := auth.uid();
  v_email_confirmed timestamptz;
begin
  if v_parent_id is null or not public.has_role(v_parent_id, 'parent'::public.app_role) then
    raise exception using errcode = '42501', message = 'Parent account required';
  end if;
  select u.email_confirmed_at into v_email_confirmed from auth.users u where u.id = v_parent_id;
  if v_email_confirmed is null then raise exception 'Confirm the parent email first'; end if;

  return query
  select p.id, p.name, p.username, p.grade, p.age,
         coalesce(c.social_enabled, false),
         coalesce(c.friend_requests_enabled, false),
         coalesce(c.direct_messages_enabled, false),
         coalesce(c.multiplayer_enabled, false),
         coalesce(c.calls_enabled, false),
         coalesce(c.profile_public, false)
    from public.profiles p
    left join public.guardian_child_controls c on c.child_id = p.id
   where p.guardian_user_id = v_parent_id
     and p.guardian_consent_status = 'verified'
   order by p.name;
end;
$$;

create or replace function public.update_guardian_child_controls(
  p_child_id uuid,
  p_social_enabled boolean,
  p_friend_requests_enabled boolean,
  p_direct_messages_enabled boolean,
  p_multiplayer_enabled boolean,
  p_calls_enabled boolean,
  p_profile_public boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_parent_id uuid := auth.uid();
begin
  if v_parent_id is null or not public.has_role(v_parent_id, 'parent'::public.app_role) then
    raise exception using errcode = '42501', message = 'Parent account required';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_child_id and p.guardian_user_id = v_parent_id and p.guardian_consent_status = 'verified'
  ) then raise exception 'This learner is not linked to your parent account'; end if;

  insert into public.guardian_child_controls(
    child_id, guardian_user_id, social_enabled, friend_requests_enabled,
    direct_messages_enabled, multiplayer_enabled, calls_enabled, profile_public, updated_at
  ) values (
    p_child_id, v_parent_id, coalesce(p_social_enabled, false), coalesce(p_friend_requests_enabled, false),
    coalesce(p_direct_messages_enabled, false), coalesce(p_multiplayer_enabled, false),
    coalesce(p_calls_enabled, false), coalesce(p_profile_public, false), now()
  )
  on conflict (child_id) do update set
    guardian_user_id = excluded.guardian_user_id,
    social_enabled = excluded.social_enabled,
    friend_requests_enabled = excluded.friend_requests_enabled,
    direct_messages_enabled = excluded.direct_messages_enabled,
    multiplayer_enabled = excluded.multiplayer_enabled,
    calls_enabled = excluded.calls_enabled,
    profile_public = excluded.profile_public,
    updated_at = now();

  if not (coalesce(p_social_enabled, false) and coalesce(p_friend_requests_enabled, false)) then
    delete from public.friends
     where status = 'pending' and (user_id = p_child_id or friend_id = p_child_id);
  end if;
  if not (coalesce(p_social_enabled, false) and coalesce(p_calls_enabled, false)) then
    update public.study_call_participants
       set status = 'left', responded_at = now()
     where user_id = p_child_id and status in ('invited', 'accepted');
    update public.study_call_rooms r
       set ended_at = coalesce(r.ended_at, now())
     where exists (
       select 1 from public.study_call_participants p
       where p.room_id = r.id and p.user_id = p_child_id
     )
       and not exists (
         select 1 from public.study_call_participants p
         where p.room_id = r.id and p.status = 'accepted'
       );
  end if;
  if not (coalesce(p_social_enabled, false) and coalesce(p_multiplayer_enabled, false)) then
    update public.multiplayer_invites
       set status = 'declined'
     where status = 'pending' and (sender_id = p_child_id or receiver_id = p_child_id);
  end if;

  insert into public.profile_privacy_settings(user_id, is_public, allow_friend_requests, allow_messages, updated_at)
  values (
    p_child_id,
    coalesce(p_social_enabled, false) and coalesce(p_profile_public, false),
    coalesce(p_social_enabled, false) and coalesce(p_friend_requests_enabled, false),
    coalesce(p_social_enabled, false) and coalesce(p_direct_messages_enabled, false),
    now()
  )
  on conflict (user_id) do update set
    is_public = excluded.is_public,
    allow_friend_requests = excluded.allow_friend_requests,
    allow_messages = excluded.allow_messages,
    updated_at = now();
end;
$$;

create or replace function public.revoke_guardian_consent(p_child_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_parent_id uuid := auth.uid();
begin
  if v_parent_id is null or not public.has_role(v_parent_id, 'parent'::public.app_role) then
    raise exception using errcode = '42501', message = 'Parent account required';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_child_id and p.guardian_user_id = v_parent_id) then
    raise exception 'This learner is not linked to your parent account';
  end if;

  update public.guardian_consent_requests
     set status = 'revoked', reviewed_at = now()
   where child_id = p_child_id and guardian_user_id = v_parent_id and status = 'approved';
  update public.profiles
     set guardian_consent = false, guardian_consent_status = 'revoked',
         guardian_user_id = null, consent_at = null
   where id = p_child_id;
  delete from public.guardian_child_controls where child_id = p_child_id;
  delete from public.friends where status = 'pending' and (user_id = p_child_id or friend_id = p_child_id);
  update public.study_call_participants set status = 'left', responded_at = now()
   where user_id = p_child_id and status in ('invited', 'accepted');
  update public.multiplayer_invites set status = 'declined'
   where status = 'pending' and (sender_id = p_child_id or receiver_id = p_child_id);
  update public.profile_privacy_settings
     set is_public = false, allow_friend_requests = false, allow_messages = false, updated_at = now()
   where user_id = p_child_id;
end;
$$;

create or replace function public.is_user_feature_enabled(p_user_id uuid, p_feature text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_age integer;
  v_status text;
  v_consent boolean;
  v_account_status text;
  v_enabled boolean;
begin
  if p_user_id is null then return false; end if;
  select p.age, p.guardian_consent_status, p.guardian_consent, p.account_status
    into v_age, v_status, v_consent, v_account_status
    from public.profiles p where p.id = p_user_id;
  if not found or coalesce(v_account_status, 'active') <> 'active' then return false; end if;

  if v_age is not null and v_age >= 18 then return true; end if;
  if v_age is null then
    return public.has_role(p_user_id, 'parent'::public.app_role)
      or public.has_role(p_user_id, 'teacher'::public.app_role)
      or public.has_role(p_user_id, 'manager'::public.app_role)
      or public.has_role(p_user_id, 'admin'::public.app_role)
      or public.has_role(p_user_id, 'finance'::public.app_role)
      or public.has_role(p_user_id, 'super_admin'::public.app_role)
      or public.has_role(p_user_id, 'extreme_admin'::public.app_role)
      or exists (
        select 1 from public.school_memberships sm
        where sm.user_id = p_user_id
          and sm.status = 'active'
          and sm.school_role in ('teacher', 'manager')
      );
  end if;
  if v_age < 18 and (not coalesce(v_consent, false) or v_status <> 'verified') then return false; end if;

  select case p_feature
    when 'social' then c.social_enabled
    when 'friend_requests' then c.friend_requests_enabled
    when 'direct_messages' then c.direct_messages_enabled
    when 'multiplayer' then c.multiplayer_enabled
    when 'calls' then c.calls_enabled
    else false
  end into v_enabled
  from public.guardian_child_controls c
  where c.child_id = p_user_id and c.guardian_user_id = (
    select p.guardian_user_id from public.profiles p where p.id = p_user_id
  );
  return coalesce(v_enabled, false);
end;
$$;

revoke all on function public.is_user_feature_enabled(uuid, text) from public, anon, authenticated;

create or replace function public.is_current_user_feature_enabled(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select public.is_user_feature_enabled(auth.uid(), p_feature);
$$;

revoke all on function public.is_current_user_feature_enabled(text) from public, anon;
grant execute on function public.is_current_user_feature_enabled(text) to authenticated;

-- Replace social RPCs with parent-controlled feature checks in addition to terms and blocks.
create or replace function public.send_friend_request(p_target_user_id uuid)
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
  if not public.has_accepted_policy('community_terms', '2026-11-24') then raise exception 'Please accept the current Terms of Use'; end if;
  if not public.is_user_feature_enabled(v_uid, 'friend_requests')
     or not public.is_user_feature_enabled(p_target_user_id, 'friend_requests') then
    raise exception 'Friend requests are disabled by the parent or guardian settings';
  end if;
  if p_target_user_id is null or p_target_user_id = v_uid then raise exception 'Invalid friend target'; end if;
  if public.are_users_blocked(v_uid, p_target_user_id) then raise exception 'This user cannot be contacted'; end if;
  if exists (
    select 1 from public.friends f
    where (f.user_id = v_uid and f.friend_id = p_target_user_id)
       or (f.user_id = p_target_user_id and f.friend_id = v_uid)
  ) then raise exception 'A friend request or friendship already exists'; end if;
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
   where id = p_request_id and friend_id = v_uid and status = 'pending' for update;
  if not found then raise exception 'Friend request not found'; end if;
  if public.are_users_blocked(v_uid, v_friend.user_id) then raise exception 'This user cannot be contacted'; end if;
  if not public.is_user_feature_enabled(v_uid, 'friend_requests')
     or not public.is_user_feature_enabled(v_friend.user_id, 'friend_requests') then
    raise exception 'Friend requests are disabled by parent or guardian settings';
  end if;
  if p_accept then
    if not public.has_accepted_policy('community_terms', '2026-11-24')
       or not public.is_user_feature_enabled(v_uid, 'friend_requests')
       or not public.is_user_feature_enabled(v_friend.user_id, 'friend_requests') then
      raise exception 'Friend requests are disabled by parent or guardian settings';
    end if;
    update public.friends set status = 'accepted', updated_at = now() where id = p_request_id returning * into v_friend;
  else
    -- Declining a request remains available even when a parent has disabled friend requests.
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
  if not public.has_accepted_policy('community_terms', '2026-11-24') then raise exception 'Please accept the current Terms of Use before messaging'; end if;
  if not public.is_user_feature_enabled(v_uid, 'direct_messages')
     or not public.is_user_feature_enabled(p_receiver_id, 'direct_messages') then
    raise exception 'Direct messages are disabled by parent or guardian settings';
  end if;
  if p_receiver_id is null or p_receiver_id = v_uid then raise exception 'Invalid recipient'; end if;
  if public.are_users_blocked(v_uid, p_receiver_id) then raise exception 'This user cannot be contacted'; end if;
  if not exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and ((f.user_id = v_uid and f.friend_id = p_receiver_id) or (f.friend_id = v_uid and f.user_id = p_receiver_id))
  ) then raise exception 'You can only message an accepted friend'; end if;
  if trim(coalesce(p_content, '')) = '' then raise exception 'Message cannot be empty'; end if;
  insert into public.messages(sender_id, receiver_id, content)
  values (v_uid, p_receiver_id, left(trim(p_content), 2000))
  returning * into v_message;
  return v_message;
end;
$$;

create or replace function public.send_group_message(
  p_group_id uuid, p_content text, p_message_type text default 'text',
  p_reply_to_id uuid default null, p_attachment_url text default null
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
  if v_user is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24') then raise exception using errcode = '42501', message = 'Please accept the current Terms of Use'; end if;
  if not public.is_user_feature_enabled(v_user, 'direct_messages') then raise exception 'Group messaging is disabled by parent or guardian settings'; end if;
  if not exists (select 1 from public.chat_group_members m where m.group_id = p_group_id and m.user_id = v_user) then
    raise exception using errcode = '42501', message = 'You must be a group member to send messages';
  end if;
  if p_content is null or length(btrim(p_content)) = 0 or length(p_content) > 4000 then
    raise exception using errcode = '22023', message = 'Message must be between 1 and 4000 characters';
  end if;
  if p_message_type is null or length(p_message_type) = 0 or length(p_message_type) > 32 then
    raise exception using errcode = '22023', message = 'Invalid message type';
  end if;
  if p_reply_to_id is not null and not exists (select 1 from public.group_messages r where r.id = p_reply_to_id and r.group_id = p_group_id) then
    raise exception using errcode = '22023', message = 'Reply target is not in this group';
  end if;
  insert into public.group_messages(group_id, sender_id, content, message_type, reply_to_id, attachment_url)
  values (p_group_id, v_user, btrim(p_content), p_message_type, p_reply_to_id, p_attachment_url)
  returning * into v_message;
  update public.chat_groups set updated_at = now() where id = p_group_id;
  return v_message;
end;
$$;

create or replace function public.create_chat_group(p_name text, p_description text default null, p_group_type text default 'private')
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
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(v_user, 'social') then
    raise exception using errcode = '42501', message = 'Community groups are not enabled for this account';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 or length(btrim(p_name)) > 120 then raise exception using errcode = '22023', message = 'Group name must be between 1 and 120 characters'; end if;
  if p_group_type is null or p_group_type not in ('private', 'public', 'class', 'subject', 'group', 'room') then raise exception using errcode = '22023', message = 'Unsupported group type'; end if;
  insert into public.chat_groups(name, description, group_type, created_by)
  values (btrim(p_name), nullif(btrim(p_description), ''), p_group_type, v_user)
  returning * into v_group;
  insert into public.chat_group_members(group_id, user_id, role) values (v_group.id, v_user, 'owner');
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
  v_caller uuid := auth.uid();
  v_room uuid;
begin
  if v_caller is null then raise exception 'Sign in required' using errcode = '28000'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24') then raise exception 'Please accept the current Terms of Use'; end if;
  if not public.is_user_feature_enabled(v_caller, 'calls')
     or not public.is_user_feature_enabled(_friend_id, 'calls') then
    raise exception 'Study Mode calls are disabled by parent or guardian settings';
  end if;
  if _friend_id is null or _friend_id = v_caller then raise exception 'Choose a different friend'; end if;
  if public.are_users_blocked(v_caller, _friend_id) then raise exception 'This user cannot be contacted'; end if;
  if not exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and ((f.user_id = v_caller and f.friend_id = _friend_id) or (f.friend_id = v_caller and f.user_id = _friend_id))
  ) then raise exception 'You can only call an accepted friend'; end if;
  insert into public.study_call_rooms(created_by) values (v_caller) returning id into v_room;
  insert into public.study_call_participants(room_id, user_id, invited_by, status, responded_at)
  values (v_room, v_caller, v_caller, 'accepted', now()), (v_room, _friend_id, v_caller, 'invited', null);
  return v_room;
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
  if not public.has_accepted_policy('community_terms', '2026-11-24') then raise exception 'Please accept the current Terms of Use'; end if;
  if not public.is_user_feature_enabled(v_uid, 'multiplayer')
     or not public.is_user_feature_enabled(_receiver_id, 'multiplayer') then
    raise exception 'Multiplayer invitations are disabled by parent or guardian settings';
  end if;
  if _receiver_id is null or _receiver_id = v_uid then raise exception 'Invalid invite recipient'; end if;
  if public.are_users_blocked(v_uid, _receiver_id) then raise exception 'This user cannot be contacted'; end if;
  select host_id, status, max_players into v_host, v_status, v_max_players from public.multiplayer_rooms where id = _room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_host <> v_uid then raise exception 'Only the host can invite players'; end if;
  if v_status <> 'waiting' then raise exception 'Invites are only available while the room is waiting'; end if;
  select count(*)::integer into v_player_count from public.room_players where room_id = _room_id;
  if v_player_count >= coalesce(v_max_players, 8) then raise exception 'Room is full'; end if;
  if exists (select 1 from public.room_players where room_id = _room_id and user_id = _receiver_id) then raise exception 'Player is already in this room'; end if;
  if exists (select 1 from public.multiplayer_invites where room_id = _room_id and receiver_id = _receiver_id and status = 'pending' and expires_at > now()) then
    raise exception 'An active invite already exists for this player';
  end if;
  insert into public.multiplayer_invites(room_id, sender_id, receiver_id, status, expires_at)
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
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(v_user, 'multiplayer') then
    raise exception 'Study competitions are disabled by parent or guardian settings';
  end if;
  if length(v_name) < 3 or length(v_name) > 80 then raise exception 'Competition name must be between 3 and 80 characters'; end if;
  insert into public.study_competitions(name, created_by, start_time, end_time, status)
  values (v_name, v_user, now(), now() + interval '24 hours', 'active')
  returning * into v_competition;
  insert into public.study_participants(competition_id, user_id, total_study_time)
  values (v_competition.id, v_user, 0)
  on conflict (competition_id, user_id) do nothing;
  return v_competition;
end;
$$;

create or replace function public.multiplayer_create_room(
  p_name text, p_subject text, p_difficulty text, p_question_count integer, p_max_players integer, p_password text default null
)
returns public.multiplayer_rooms
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.multiplayer_rooms%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(v_uid, 'multiplayer') then
    raise exception 'Multiplayer is disabled by parent or guardian settings';
  end if;
  if p_max_players is null or p_max_players < 2 or p_max_players > 8 then raise exception 'Player limit must be between 2 and 8'; end if;
  if p_question_count is null or p_question_count < 1 or p_question_count > 50 then raise exception 'Question count must be between 1 and 50'; end if;
  if octet_length(coalesce(p_password, '')) > 256 then raise exception 'Room password is too long'; end if;
  insert into public.multiplayer_rooms(name, host_id, max_players, subject, difficulty, question_count, has_password, status, game_mode)
  values (
    left(trim(coalesce(p_name, 'Room')), 80), v_uid, p_max_players,
    coalesce(nullif(trim(p_subject), ''), 'Mixed'),
    coalesce(nullif(trim(p_difficulty), ''), 'Medium'),
    p_question_count,
    nullif(trim(coalesce(p_password, '')), '') is not null,
    'waiting', 'speed'
  ) returning * into v_room;
  if nullif(trim(coalesce(p_password, '')), '') is not null then
    insert into public.multiplayer_room_secrets(room_id, password_hash)
    values (v_room.id, extensions.crypt(encode(extensions.digest(p_password, 'sha256'), 'hex'), extensions.gen_salt('bf')));
  end if;
  insert into public.room_players(room_id, user_id, is_ready) values (v_room.id, v_uid, true);
  return v_room;
end;
$$;

-- RLS also checks the current user's parent-approved feature flags.
drop policy if exists "involved users can view" on public.friends;
create policy "involved users can view"
  on public.friends for select to authenticated
  using (
    public.is_current_user_feature_enabled('friend_requests')
    and (user_id = (select auth.uid()) or friend_id = (select auth.uid()))
    and not public.is_blocked_with(case when user_id = (select auth.uid()) then friend_id else user_id end)
  );

drop policy if exists "involved users can view" on public.followers;
create policy "involved users can view"
  on public.followers for select to authenticated
  using (
    public.is_current_user_feature_enabled('social')
    and (follower_id = (select auth.uid()) or following_id = (select auth.uid()))
    and not public.is_blocked_with(case when follower_id = (select auth.uid()) then following_id else follower_id end)
  );

drop policy if exists "involved users can view messages" on public.messages;
create policy "involved users can view messages"
  on public.messages for select to authenticated
  using (
    public.is_current_user_feature_enabled('direct_messages')
    and (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and not public.is_blocked_with(case when sender_id = (select auth.uid()) then receiver_id else sender_id end)
  );

drop policy if exists "Authenticated users can view opted-in posts" on public.social_posts;
create policy "Authenticated users can view opted-in posts"
  on public.social_posts for select to authenticated
  using (
    public.is_current_user_feature_enabled('social')
    and (
      author_id = (select auth.uid())
      or (
        not public.is_blocked_with(author_id)
        and coalesce((select p.is_public from public.profile_privacy_settings p where p.user_id = social_posts.author_id), true)
      )
    )
  );

drop policy if exists "authenticated can create post" on public.social_posts;
create policy "authenticated can create post"
  on public.social_posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('social')
  );

drop policy if exists "authenticated can view visible post comments" on public.social_post_comments;
create policy "authenticated can view visible post comments"
  on public.social_post_comments for select to authenticated
  using (
    public.is_current_user_feature_enabled('social')
    and not public.is_blocked_with(user_id)
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_comments.post_id
        and (p.author_id = (select auth.uid()) or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true))
    )
  );

drop policy if exists "users can comment on visible posts" on public.social_post_comments;
create policy "users can comment on visible posts"
  on public.social_post_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('social')
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_comments.post_id and not public.is_blocked_with(p.author_id)
    )
  );

drop policy if exists "members can view group messages" on public.group_messages;
create policy "members can view group messages"
  on public.group_messages for select to authenticated
  using (
    public.is_current_user_feature_enabled('direct_messages')
    and not public.is_blocked_with(sender_id)
    and exists (select 1 from public.chat_group_members m where m.group_id = group_messages.group_id and m.user_id = (select auth.uid()))
  );

drop policy if exists "members can send group messages" on public.group_messages;
create policy "members can send group messages"
  on public.group_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('direct_messages')
    and exists (select 1 from public.chat_group_members m where m.group_id = group_messages.group_id and m.user_id = (select auth.uid()))
  );

drop policy if exists "authenticated can view lobby" on public.lobby_messages;
create policy "authenticated can view lobby"
  on public.lobby_messages for select to authenticated
  using (public.is_current_user_feature_enabled('social') and not public.is_blocked_with(user_id));

drop policy if exists "authenticated can post lobby" on public.lobby_messages;
create policy "authenticated can post lobby"
  on public.lobby_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('social')
  );

drop policy if exists "Room players can view room chat" on public.room_chat_messages;
drop policy if exists "room_chat_member_read" on public.room_chat_messages;
create policy "room_chat_member_read"
  on public.room_chat_messages for select to authenticated
  using (
    public.is_current_user_feature_enabled('social')
    and public.is_multiplayer_room_member(room_id)
    and not public.is_blocked_with(user_id)
  );

drop policy if exists "participants can view own invitations" on public.study_call_participants;
create policy "participants can view own invitations"
  on public.study_call_participants for select to authenticated
  using (
    public.is_current_user_feature_enabled('calls')
    and (auth.uid() = user_id or auth.uid() = invited_by)
    and not public.is_blocked_with(case when auth.uid() = user_id then invited_by else user_id end)
  );

drop policy if exists "users invite friends to own call" on public.study_call_participants;
create policy "users invite friends to own call"
  on public.study_call_participants for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('calls')
    and not public.is_blocked_with(user_id)
    and exists (select 1 from public.study_call_rooms r where r.id = study_call_participants.room_id and r.created_by = (select auth.uid()))
  );

drop policy if exists "involved can view invite" on public.multiplayer_invites;
create policy "involved can view invite"
  on public.multiplayer_invites for select to authenticated
  using (
    public.is_current_user_feature_enabled('multiplayer')
    and (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and not public.is_blocked_with(case when sender_id = (select auth.uid()) then receiver_id else sender_id end)
  );

drop policy if exists "sender creates invite" on public.multiplayer_invites;
create policy "sender creates invite"
  on public.multiplayer_invites for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('multiplayer')
    and not public.is_blocked_with(receiver_id)
  );

-- Enforce guardian settings for direct table writes as well as RPC callers.
create or replace function public.enforce_guardian_relationship_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not public.has_accepted_policy('community_terms', '2026-11-24') then
    raise exception 'Accept the current community terms before creating social relationships';
  end if;
  if tg_table_name = 'friends' then
    if tg_op = 'INSERT' and new.user_id <> auth.uid() then
      raise exception 'You can only send a friend request from your own account';
    end if;
    if not public.is_user_feature_enabled(new.user_id, 'friend_requests')
       or not public.is_user_feature_enabled(new.friend_id, 'friend_requests') then
      raise exception 'Friend requests are disabled by parent or guardian settings';
    end if;
    if public.are_users_blocked(new.user_id, new.friend_id) then
      raise exception 'This user cannot be contacted';
    end if;
    if tg_op = 'UPDATE' and new.status in ('accepted', 'pending') and new.friend_id <> auth.uid() and new.user_id <> auth.uid() then
      raise exception 'Only a participant can update this friendship';
    end if;
  elsif tg_table_name = 'followers' then
    if new.follower_id <> auth.uid() then raise exception 'You can only follow from your own account'; end if;
    if not public.is_user_feature_enabled(new.follower_id, 'social')
       or not public.is_user_feature_enabled(new.following_id, 'social') then
      raise exception 'Social features are disabled by parent or guardian settings';
    end if;
    if public.are_users_blocked(new.follower_id, new.following_id) then
      raise exception 'This user cannot be contacted';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_friend_relationship_guard on public.friends;
create trigger guardian_friend_relationship_guard
  before insert or update on public.friends
  for each row execute function public.enforce_guardian_relationship_permissions();
drop trigger if exists guardian_follow_relationship_guard on public.followers;
create trigger guardian_follow_relationship_guard
  before insert or update on public.followers
  for each row execute function public.enforce_guardian_relationship_permissions();
revoke all on function public.enforce_guardian_relationship_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_message_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.sender_id <> auth.uid() then raise exception 'You can only send messages from your own account'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.sender_id, 'direct_messages')
     or not public.is_user_feature_enabled(new.receiver_id, 'direct_messages') then
    raise exception 'Direct messaging is disabled by parent or guardian settings';
  end if;
  if public.are_users_blocked(new.sender_id, new.receiver_id) then raise exception 'This user cannot be contacted'; end if;
  if not exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and ((f.user_id = new.sender_id and f.friend_id = new.receiver_id)
        or (f.friend_id = new.sender_id and f.user_id = new.receiver_id))
  ) then raise exception 'You can only message an accepted friend'; end if;
  return new;
end;
$$;

drop trigger if exists guardian_direct_message_guard on public.messages;
create trigger guardian_direct_message_guard
  before insert on public.messages
  for each row execute function public.enforce_guardian_message_permissions();
revoke all on function public.enforce_guardian_message_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_call_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.invited_by <> auth.uid() then raise exception 'You can only invite from your own account'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.invited_by, 'calls')
     or not public.is_user_feature_enabled(new.user_id, 'calls') then
    raise exception 'Study Mode calls are disabled by parent or guardian settings';
  end if;
  if public.are_users_blocked(new.invited_by, new.user_id) then raise exception 'This user cannot be contacted'; end if;
  if new.user_id <> new.invited_by and not exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and ((f.user_id = new.invited_by and f.friend_id = new.user_id)
        or (f.friend_id = new.invited_by and f.user_id = new.user_id))
  ) then raise exception 'Study Mode calls are limited to accepted friends'; end if;
  return new;
end;
$$;

drop trigger if exists guardian_call_participant_guard on public.study_call_participants;
create trigger guardian_call_participant_guard
  before insert on public.study_call_participants
  for each row execute function public.enforce_guardian_call_permissions();
revoke all on function public.enforce_guardian_call_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_multiplayer_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $
declare
  v_sender_age integer;
  v_receiver_age integer;
begin
  if new.sender_id <> auth.uid() then raise exception 'You can only invite from your own account'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.sender_id, 'multiplayer')
     or not public.is_user_feature_enabled(new.receiver_id, 'multiplayer') then
    raise exception 'Multiplayer invitations are disabled by parent or guardian settings';
  end if;
  if public.are_users_blocked(new.sender_id, new.receiver_id) then raise exception 'This user cannot be contacted'; end if;
  select age into v_sender_age from public.profiles where id = new.sender_id;
  select age into v_receiver_age from public.profiles where id = new.receiver_id;
  if ((v_sender_age is not null and v_sender_age < 18)
      or (v_receiver_age is not null and v_receiver_age < 18))
     and not exists (
       select 1 from public.friends f
        where f.status = 'accepted'
          and ((f.user_id = new.sender_id and f.friend_id = new.receiver_id)
            or (f.friend_id = new.sender_id and f.user_id = new.receiver_id))
     )
     and not exists (
       select 1
         from public.school_memberships sender_membership
         join public.school_memberships receiver_membership
           on receiver_membership.school_id = sender_membership.school_id
        where sender_membership.user_id = new.sender_id
          and receiver_membership.user_id = new.receiver_id
          and sender_membership.status = 'active'
          and receiver_membership.status = 'active'
          and sender_membership.school_role in ('teacher', 'manager')
     ) then
    raise exception 'Learners under 18 can invite accepted friends or authorised school staff only';
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_multiplayer_invite_guard on public.multiplayer_invites;
create trigger guardian_multiplayer_invite_guard
  before insert on public.multiplayer_invites
  for each row execute function public.enforce_guardian_multiplayer_permissions();
revoke all on function public.enforce_guardian_multiplayer_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_multiplayer_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $
declare
  v_sender_age integer;
  v_receiver_age integer;
begin
  if new.sender_id <> old.sender_id
     or new.receiver_id <> old.receiver_id
     or new.room_id <> old.room_id then
    raise exception 'Invitation participants and room cannot be changed';
  end if;
  if new.status = 'accepted' then
    if new.receiver_id <> auth.uid() then
      raise exception 'Only the invited recipient can accept this invitation';
    end if;
    if not public.is_user_feature_enabled(auth.uid(), 'multiplayer')
       or not public.is_user_feature_enabled(new.sender_id, 'multiplayer')
       or not public.is_user_feature_enabled(new.receiver_id, 'multiplayer')
       or public.are_users_blocked(new.sender_id, new.receiver_id) then
      raise exception 'This multiplayer invitation is no longer available';
    end if;
    select age into v_sender_age from public.profiles where id = new.sender_id;
    select age into v_receiver_age from public.profiles where id = new.receiver_id;
    if ((v_sender_age is not null and v_sender_age < 18)
        or (v_receiver_age is not null and v_receiver_age < 18))
       and not exists (
         select 1 from public.friends f
          where f.status = 'accepted'
            and ((f.user_id = new.sender_id and f.friend_id = new.receiver_id)
              or (f.friend_id = new.sender_id and f.user_id = new.receiver_id))
       )
       and not exists (
         select 1
           from public.school_memberships sender_membership
           join public.school_memberships receiver_membership
             on receiver_membership.school_id = sender_membership.school_id
          where sender_membership.user_id = new.sender_id
            and receiver_membership.user_id = new.receiver_id
            and sender_membership.status = 'active'
            and receiver_membership.status = 'active'
            and sender_membership.school_role in ('teacher', 'manager')
       ) then
      raise exception 'Under-18 multiplayer invitations require an accepted friend or authorised school staff connection';
    end if;
  end if;
  return new;
end;
$;

drop trigger if exists guardian_multiplayer_invite_update_guard on public.multiplayer_invites;
create trigger guardian_multiplayer_invite_update_guard
  before update on public.multiplayer_invites
  for each row execute function public.enforce_guardian_multiplayer_update_permissions();
revoke all on function public.enforce_guardian_multiplayer_update_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_call_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.status = 'accepted' then
    if new.user_id <> auth.uid() then raise exception 'Only the invited learner can accept this call'; end if;
    if not public.is_user_feature_enabled(new.user_id, 'calls')
       or not public.is_user_feature_enabled(new.invited_by, 'calls')
       or public.are_users_blocked(new.invited_by, new.user_id) then
      raise exception 'This Study Mode call is no longer available';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_call_participant_update_guard on public.study_call_participants;
create trigger guardian_call_participant_update_guard
  before update on public.study_call_participants
  for each row execute function public.enforce_guardian_call_update_permissions();
revoke all on function public.enforce_guardian_call_update_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_group_membership_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then return new; end if;
  if new.user_id = auth.uid() then
    if not public.has_accepted_policy('community_terms', '2026-11-24')
       or not public.is_user_feature_enabled(auth.uid(), 'social') then
      raise exception 'Community group access is disabled by parent or guardian settings';
    end if;
  elsif not (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    or public.has_role(auth.uid(), 'manager'::public.app_role)
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'extreme_admin'::public.app_role)
  ) then
    raise exception 'You cannot add another account to a community group';
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_group_membership_guard on public.chat_group_members;
create trigger guardian_group_membership_guard
  before insert on public.chat_group_members
  for each row execute function public.enforce_guardian_group_membership_permissions();
revoke all on function public.enforce_guardian_group_membership_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_room_player_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_age integer;
  v_host_id uuid;
begin
  if new.user_id <> auth.uid() then raise exception 'You can only join a room as your own account'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.user_id, 'multiplayer') then
    raise exception 'Multiplayer is disabled by parent or guardian settings';
  end if;

  select age into v_age from public.profiles where id = new.user_id;
  select host_id into v_host_id from public.multiplayer_rooms where id = new.room_id;
  if v_age is not null and v_age < 18 and v_host_id is distinct from new.user_id
     and not exists (
       select 1 from public.friends f
        where f.status = 'accepted'
          and ((f.user_id = new.user_id and f.friend_id = v_host_id)
            or (f.friend_id = new.user_id and f.user_id = v_host_id))
     )
     and not exists (
       select 1
         from public.school_memberships learner_membership
         join public.school_memberships staff_membership
           on staff_membership.school_id = learner_membership.school_id
        where learner_membership.user_id = new.user_id
          and staff_membership.user_id = v_host_id
          and learner_membership.status = 'active'
          and staff_membership.status = 'active'
          and staff_membership.school_role in ('teacher', 'manager')
     ) then
    raise exception 'Learners under 18 can join rooms hosted by accepted friends or authorised school staff only';
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_room_player_guard on public.room_players;
create trigger guardian_room_player_guard
  before insert on public.room_players
  for each row execute function public.enforce_guardian_room_player_permissions();
revoke all on function public.enforce_guardian_room_player_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_room_chat_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.user_id <> auth.uid() then raise exception 'You can only send room chat from your own account'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.user_id, 'multiplayer')
     or not public.is_user_feature_enabled(new.user_id, 'social') then
    raise exception 'Room chat is disabled by parent or guardian settings';
  end if;
  if not public.is_multiplayer_room_member(new.room_id) then raise exception 'You must be a room member to send chat'; end if;
  return new;
end;
$$;

drop trigger if exists guardian_room_chat_guard on public.room_chat_messages;
create trigger guardian_room_chat_guard
  before insert on public.room_chat_messages
  for each row execute function public.enforce_guardian_room_chat_permissions();
revoke all on function public.enforce_guardian_room_chat_permissions() from public, anon, authenticated;

drop policy if exists "group admin manages members" on public.chat_group_members;
drop policy if exists "members can view roster" on public.chat_group_members;
create policy "members can view roster"
  on public.chat_group_members for select to authenticated
  using (
    public.is_current_user_feature_enabled('direct_messages')
    and ((user_id = (select auth.uid())) or is_chat_group_member(group_id))
  );

drop policy if exists "room_players_member_or_public_lobby_read" on public.room_players;
create policy "room_players_member_or_public_lobby_read"
  on public.room_players for select to authenticated
  using (
    public.is_current_user_feature_enabled('multiplayer')
    and (is_multiplayer_room_member(room_id) or is_multiplayer_public_room(room_id))
  );

create or replace function public.enforce_guardian_competition_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.user_id <> auth.uid()
     or not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.user_id, 'multiplayer') then
    raise exception 'Study competitions are disabled by parent or guardian settings';
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_study_participant_guard on public.study_participants;
create trigger guardian_study_participant_guard
  before insert on public.study_participants
  for each row execute function public.enforce_guardian_competition_permissions();
drop trigger if exists guardian_tournament_participant_guard on public.tournament_participants;
create trigger guardian_tournament_participant_guard
  before insert on public.tournament_participants
  for each row execute function public.enforce_guardian_competition_permissions();
revoke all on function public.enforce_guardian_competition_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_group_membership_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_is_school_staff boolean;
begin
  if auth.uid() is null then return new; end if;
  if new.user_id = auth.uid() then
    if not public.has_accepted_policy('community_terms', '2026-11-24')
       or not public.is_user_feature_enabled(auth.uid(), 'social') then
      raise exception 'Community group access is disabled by parent or guardian settings';
    end if;
    return new;
  end if;

  v_is_school_staff :=
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    or public.has_role(auth.uid(), 'manager'::public.app_role)
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'super_admin'::public.app_role)
    or public.has_role(auth.uid(), 'extreme_admin'::public.app_role)
    or exists (
      select 1 from public.school_memberships sm
      where sm.user_id = auth.uid()
        and sm.status = 'active'
        and sm.school_role in ('teacher', 'manager')
    );

  if not v_is_school_staff and not public.is_chat_group_creator(new.group_id) then
    raise exception 'You cannot add another account to a community group';
  end if;
  if not v_is_school_staff and not public.is_user_feature_enabled(new.user_id, 'social') then
    raise exception 'The invited learner has community features disabled by their parent or guardian';
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_group_membership_guard on public.chat_group_members;
create trigger guardian_group_membership_guard
  before insert on public.chat_group_members
  for each row execute function public.enforce_guardian_group_membership_permissions();
revoke all on function public.enforce_guardian_group_membership_permissions() from public, anon, authenticated;

-- Public lobby chat is not available to under-18 accounts. They can use
-- parent-enabled friend messaging and school-managed groups instead.
create or replace function public.can_view_lobby_author(p_author_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_viewer_id uuid := auth.uid();
  v_age integer;
begin
  if v_viewer_id is null or p_author_id is null then return false; end if;
  if not public.is_current_user_feature_enabled('social')
     or not public.is_user_feature_enabled(p_author_id, 'social')
     or public.are_users_blocked(v_viewer_id, p_author_id) then
    return false;
  end if;
  if p_author_id = v_viewer_id then return true; end if;

  select age into v_age from public.profiles where id = v_viewer_id;
  if (v_age is not null and v_age >= 18)
     or public.has_role(v_viewer_id, 'parent'::public.app_role)
     or public.has_role(v_viewer_id, 'teacher'::public.app_role)
     or public.has_role(v_viewer_id, 'manager'::public.app_role)
     or public.has_role(v_viewer_id, 'super_admin'::public.app_role)
     or public.has_role(v_viewer_id, 'extreme_admin'::public.app_role)
     or exists (
       select 1 from public.school_memberships sm
       where sm.user_id = v_viewer_id
         and sm.status = 'active'
         and sm.school_role in ('teacher', 'manager')
     ) then
    return true;
  end if;

  return exists (
    select 1 from public.friends f
     where f.status = 'accepted'
       and ((f.user_id = v_viewer_id and f.friend_id = p_author_id)
         or (f.friend_id = v_viewer_id and f.user_id = p_author_id))
  ) or exists (
    select 1
      from public.school_memberships viewer_membership
      join public.school_memberships author_membership
        on author_membership.school_id = viewer_membership.school_id
     where viewer_membership.user_id = v_viewer_id
       and author_membership.user_id = p_author_id
       and viewer_membership.status = 'active'
       and author_membership.status = 'active'
       and author_membership.school_role in ('teacher', 'manager')
  );
end;
$$;

revoke all on function public.can_view_lobby_author(uuid) from public, anon;
grant execute on function public.can_view_lobby_author(uuid) to authenticated;

drop policy if exists "authenticated can view lobby" on public.lobby_messages;
create policy "authenticated can view lobby"
  on public.lobby_messages for select to authenticated
  using (public.can_view_lobby_author(user_id));

create or replace function public.enforce_guardian_lobby_chat_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_age integer;
begin
  if new.user_id <> auth.uid() then raise exception 'You can only post as your own account'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.user_id, 'social') then
    raise exception 'Social features are disabled by parent or guardian settings';
  end if;
  select age into v_age from public.profiles where id = new.user_id;
  if (v_age is null or v_age < 18)
     and not public.has_role(new.user_id, 'parent'::public.app_role)
     and not public.has_role(new.user_id, 'teacher'::public.app_role)
     and not public.has_role(new.user_id, 'manager'::public.app_role)
     and not public.has_role(new.user_id, 'super_admin'::public.app_role)
     and not public.has_role(new.user_id, 'extreme_admin'::public.app_role)
     and not exists (
       select 1 from public.school_memberships sm
       where sm.user_id = new.user_id
         and sm.status = 'active'
         and sm.school_role in ('teacher', 'manager')
     ) then
    raise exception 'Public lobby chat is disabled for learner accounts under 18';
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_lobby_chat_guard on public.lobby_messages;
create trigger guardian_lobby_chat_guard
  before insert on public.lobby_messages
  for each row execute function public.enforce_guardian_lobby_chat_permissions();
revoke all on function public.enforce_guardian_lobby_chat_permissions() from public, anon, authenticated;

-- Direct social interactions are subject to the same consent and feature gates.
drop policy if exists "users can like visible posts" on public.social_post_likes;
create policy "users can like visible posts"
  on public.social_post_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('social')
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_likes.post_id and not public.is_blocked_with(p.author_id)
    )
  );

drop policy if exists "users can react to visible posts" on public.social_post_reactions;
create policy "users can react to visible posts"
  on public.social_post_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('social')
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_reactions.post_id and not public.is_blocked_with(p.author_id)
    )
  );

drop policy if exists "insert own rows" on public.saved_posts;
drop policy if exists "users can save visible posts" on public.saved_posts;
create policy "users can save visible posts"
  on public.saved_posts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_current_user_feature_enabled('social')
    and exists (
      select 1 from public.social_posts p
      where p.id = saved_posts.post_id
        and (p.author_id = (select auth.uid()) or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true))
    )
  );

drop policy if exists "users can view own saved posts" on public.saved_posts;
create policy "users can view own saved posts"
  on public.saved_posts for select to authenticated
  using (user_id = (select auth.uid()) and public.is_current_user_feature_enabled('social'));

drop policy if exists "authors can update own posts" on public.social_posts;
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
      and public.is_current_user_feature_enabled('social')
    )
    or has_role((select auth.uid()), 'admin'::app_role)
    or has_role((select auth.uid()), 'manager'::app_role)
  );

drop policy if exists "users can update own comments" on public.social_post_comments;
create policy "users can update own comments"
  on public.social_post_comments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('social')
  );

-- Parent revocation removes access to social feeds by making the child's profile private.
comment on table public.guardian_child_controls is 'Parent-managed feature permissions for verified minor accounts; all community features default off.';

       or v_guardian_email = v_email then
      raise exception 'A separate, valid parent or guardian email is required for learners under 18';
    end if;
    update public.profiles
       set age = p_age, guardian_email = v_guardian_email, guardian_consent = false,
           guardian_consent_status = 'pending', guardian_user_id = null, consent_at = null
     where id = v_user_id;
    select r.id into v_request_id
      from public.guardian_consent_requests r
     where r.child_id = v_user_id and r.status = 'pending' and lower(r.guardian_email) = v_guardian_email
     order by r.created_at desc limit 1;
    if v_request_id is null then
      update public.guardian_consent_requests set status = 'rejected', reviewed_at = now()
       where child_id = v_user_id and status = 'pending';
      insert into public.guardian_consent_requests(child_id, guardian_email)
      values (v_user_id, v_guardian_email) returning id into v_request_id;
    end if;
    return v_request_id;
  end if;

  update public.profiles
     set age = p_age, guardian_email = null, guardian_consent = false,
         guardian_consent_status = 'not_required', guardian_user_id = null, consent_at = null
   where id = v_user_id;
  return null;
end;
$$;

revoke all on function public.set_my_age_and_guardian(integer, text) from public, anon;
grant execute on function public.set_my_age_and_guardian(integer, text) to authenticated;

create or replace function public.get_guardian_consent_request(p_request_id uuid)
returns table (
  request_id uuid,
  child_name text,
  child_username text,
  child_grade text,
  child_age integer,
  requested_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.has_role(v_user_id, 'parent'::public.app_role) then
    raise exception using errcode = '42501', message = 'A signed-in parent account is required';
  end if;
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
    from auth.users u where u.id = v_user_id;
  if v_confirmed is null then raise exception 'Confirm the parent email before reviewing this request'; end if;

  return query
  select r.id, p.name, p.username, p.grade, p.age, r.created_at
    from public.guardian_consent_requests r
    join public.profiles p on p.id = r.child_id
   where r.id = p_request_id
     and r.status = 'pending'
     and lower(r.guardian_email) = v_email;
  if not found then raise exception 'No pending guardian request matches this verified parent email'; end if;
end;
$$;

create or replace function public.approve_guardian_consent(p_request_id uuid, p_parent_attestation boolean)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_parent_id uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_request public.guardian_consent_requests%rowtype;
begin
  if v_parent_id is null or not public.has_role(v_parent_id, 'parent'::public.app_role) then
    raise exception using errcode = '42501', message = 'A signed-in parent account is required';
  end if;
  if p_parent_attestation is not true then raise exception 'Parent or guardian confirmation is required'; end if;
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_parent_id;
  if v_confirmed is null then raise exception 'Confirm the parent email before approving'; end if;

  select * into v_request from public.guardian_consent_requests
   where id = p_request_id and status = 'pending' for update;
  if not found then raise exception 'Guardian request is no longer pending'; end if;
  if lower(v_request.guardian_email) <> v_email or v_request.child_id = v_parent_id then
    raise exception 'This approval link does not match the verified guardian email';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_request.child_id and p.age is not null and p.age < 18) then
    raise exception 'The linked learner is not an under-18 account';
  end if;

  update public.guardian_consent_requests
     set status = 'approved', guardian_user_id = v_parent_id, parent_attested = true, reviewed_at = now()
   where id = p_request_id;

  update public.profiles
     set guardian_consent = true,
         guardian_consent_status = 'verified',
         guardian_user_id = v_parent_id,
         consent_at = now()
   where id = v_request.child_id;

  insert into public.guardian_child_controls(child_id, guardian_user_id)
  values (v_request.child_id, v_parent_id)
  on conflict (child_id) do update set guardian_user_id = excluded.guardian_user_id;
end;
$$;

create or replace function public.reject_guardian_consent(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_parent_id uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_request public.guardian_consent_requests%rowtype;
begin
  if v_parent_id is null or not public.has_role(v_parent_id, 'parent'::public.app_role) then
    raise exception using errcode = '42501', message = 'A signed-in parent account is required';
  end if;
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_parent_id;
  if v_confirmed is null then raise exception 'Confirm the parent email before responding'; end if;
  select * into v_request from public.guardian_consent_requests where id = p_request_id and status = 'pending' for update;
  if not found or lower(v_request.guardian_email) <> v_email then raise exception 'No matching pending request was found'; end if;

  update public.guardian_consent_requests set status = 'rejected', guardian_user_id = v_parent_id, reviewed_at = now()
   where id = p_request_id;
  update public.profiles set guardian_consent = false, guardian_consent_status = 'rejected',
    guardian_user_id = null, consent_at = null where id = v_request.child_id;
end;
$$;

create or replace function public.list_guardian_children()
returns table (
  child_id uuid,
  child_name text,
  child_username text,
  child_grade text,
  child_age integer,
  social_enabled boolean,
  friend_requests_enabled boolean,
  direct_messages_enabled boolean,
  multiplayer_enabled boolean,
  calls_enabled boolean,
  profile_public boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_parent_id uuid := auth.uid();
  v_email_confirmed timestamptz;
begin
  if v_parent_id is null or not public.has_role(v_parent_id, 'parent'::public.app_role) then
    raise exception using errcode = '42501', message = 'Parent account required';
  end if;
  select u.email_confirmed_at into v_email_confirmed from auth.users u where u.id = v_parent_id;
  if v_email_confirmed is null then raise exception 'Confirm the parent email first'; end if;

  return query
  select p.id, p.name, p.username, p.grade, p.age,
         coalesce(c.social_enabled, false),
         coalesce(c.friend_requests_enabled, false),
         coalesce(c.direct_messages_enabled, false),
         coalesce(c.multiplayer_enabled, false),
         coalesce(c.calls_enabled, false),
         coalesce(c.profile_public, false)
    from public.profiles p
    left join public.guardian_child_controls c on c.child_id = p.id
   where p.guardian_user_id = v_parent_id
     and p.guardian_consent_status = 'verified'
   order by p.name;
end;
$$;

create or replace function public.update_guardian_child_controls(
  p_child_id uuid,
  p_social_enabled boolean,
  p_friend_requests_enabled boolean,
  p_direct_messages_enabled boolean,
  p_multiplayer_enabled boolean,
  p_calls_enabled boolean,
  p_profile_public boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_parent_id uuid := auth.uid();
begin
  if v_parent_id is null or not public.has_role(v_parent_id, 'parent'::public.app_role) then
    raise exception using errcode = '42501', message = 'Parent account required';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_child_id and p.guardian_user_id = v_parent_id and p.guardian_consent_status = 'verified'
  ) then raise exception 'This learner is not linked to your parent account'; end if;

  insert into public.guardian_child_controls(
    child_id, guardian_user_id, social_enabled, friend_requests_enabled,
    direct_messages_enabled, multiplayer_enabled, calls_enabled, profile_public, updated_at
  ) values (
    p_child_id, v_parent_id, coalesce(p_social_enabled, false), coalesce(p_friend_requests_enabled, false),
    coalesce(p_direct_messages_enabled, false), coalesce(p_multiplayer_enabled, false),
    coalesce(p_calls_enabled, false), coalesce(p_profile_public, false), now()
  )
  on conflict (child_id) do update set
    guardian_user_id = excluded.guardian_user_id,
    social_enabled = excluded.social_enabled,
    friend_requests_enabled = excluded.friend_requests_enabled,
    direct_messages_enabled = excluded.direct_messages_enabled,
    multiplayer_enabled = excluded.multiplayer_enabled,
    calls_enabled = excluded.calls_enabled,
    profile_public = excluded.profile_public,
    updated_at = now();

  if not (coalesce(p_social_enabled, false) and coalesce(p_friend_requests_enabled, false)) then
    delete from public.friends
     where status = 'pending' and (user_id = p_child_id or friend_id = p_child_id);
  end if;
  if not (coalesce(p_social_enabled, false) and coalesce(p_calls_enabled, false)) then
    update public.study_call_participants
       set status = 'left', responded_at = now()
     where user_id = p_child_id and status in ('invited', 'accepted');
    update public.study_call_rooms r
       set ended_at = coalesce(r.ended_at, now())
     where exists (
       select 1 from public.study_call_participants p
       where p.room_id = r.id and p.user_id = p_child_id
     )
       and not exists (
         select 1 from public.study_call_participants p
         where p.room_id = r.id and p.status = 'accepted'
       );
  end if;
  if not (coalesce(p_social_enabled, false) and coalesce(p_multiplayer_enabled, false)) then
    update public.multiplayer_invites
       set status = 'declined'
     where status = 'pending' and (sender_id = p_child_id or receiver_id = p_child_id);
  end if;

  insert into public.profile_privacy_settings(user_id, is_public, allow_friend_requests, allow_messages, updated_at)
  values (
    p_child_id,
    coalesce(p_social_enabled, false) and coalesce(p_profile_public, false),
    coalesce(p_social_enabled, false) and coalesce(p_friend_requests_enabled, false),
    coalesce(p_social_enabled, false) and coalesce(p_direct_messages_enabled, false),
    now()
  )
  on conflict (user_id) do update set
    is_public = excluded.is_public,
    allow_friend_requests = excluded.allow_friend_requests,
    allow_messages = excluded.allow_messages,
    updated_at = now();
end;
$$;

create or replace function public.revoke_guardian_consent(p_child_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_parent_id uuid := auth.uid();
begin
  if v_parent_id is null or not public.has_role(v_parent_id, 'parent'::public.app_role) then
    raise exception using errcode = '42501', message = 'Parent account required';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_child_id and p.guardian_user_id = v_parent_id) then
    raise exception 'This learner is not linked to your parent account';
  end if;

  update public.guardian_consent_requests
     set status = 'revoked', reviewed_at = now()
   where child_id = p_child_id and guardian_user_id = v_parent_id and status = 'approved';
  update public.profiles
     set guardian_consent = false, guardian_consent_status = 'revoked',
         guardian_user_id = null, consent_at = null
   where id = p_child_id;
  delete from public.guardian_child_controls where child_id = p_child_id;
  delete from public.friends where status = 'pending' and (user_id = p_child_id or friend_id = p_child_id);
  update public.study_call_participants set status = 'left', responded_at = now()
   where user_id = p_child_id and status in ('invited', 'accepted');
  update public.multiplayer_invites set status = 'declined'
   where status = 'pending' and (sender_id = p_child_id or receiver_id = p_child_id);
  update public.profile_privacy_settings
     set is_public = false, allow_friend_requests = false, allow_messages = false, updated_at = now()
   where user_id = p_child_id;
end;
$$;

create or replace function public.is_user_feature_enabled(p_user_id uuid, p_feature text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_age integer;
  v_status text;
  v_consent boolean;
  v_enabled boolean;
begin
  if p_user_id is null then return false; end if;
  select p.age, p.guardian_consent_status, p.guardian_consent
    into v_age, v_status, v_consent
    from public.profiles p where p.id = p_user_id;
  if not found then return false; end if;

  if v_age is not null and v_age >= 18 then return true; end if;
  if v_age is null then
    return public.has_role(p_user_id, 'parent'::public.app_role)
      or public.has_role(p_user_id, 'teacher'::public.app_role)
      or public.has_role(p_user_id, 'manager'::public.app_role)
      or public.has_role(p_user_id, 'admin'::public.app_role)
      or public.has_role(p_user_id, 'finance'::public.app_role)
      or public.has_role(p_user_id, 'super_admin'::public.app_role)
      or public.has_role(p_user_id, 'extreme_admin'::public.app_role);
  end if;
  if v_age < 18 and (not coalesce(v_consent, false) or v_status <> 'verified') then return false; end if;

  select case p_feature
    when 'social' then c.social_enabled
    when 'friend_requests' then c.friend_requests_enabled
    when 'direct_messages' then c.direct_messages_enabled
    when 'multiplayer' then c.multiplayer_enabled
    when 'calls' then c.calls_enabled
    else false
  end into v_enabled
  from public.guardian_child_controls c
  where c.child_id = p_user_id and c.guardian_user_id = (
    select p.guardian_user_id from public.profiles p where p.id = p_user_id
  );
  return coalesce(v_enabled, false);
end;
$$;

revoke all on function public.is_user_feature_enabled(uuid, text) from public, anon, authenticated;

create or replace function public.is_current_user_feature_enabled(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select public.is_user_feature_enabled(auth.uid(), p_feature);
$$;

revoke all on function public.is_current_user_feature_enabled(text) from public, anon;
grant execute on function public.is_current_user_feature_enabled(text) to authenticated;

-- Replace social RPCs with parent-controlled feature checks in addition to terms and blocks.
create or replace function public.send_friend_request(p_target_user_id uuid)
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
  if not public.has_accepted_policy('community_terms', '2026-11-24') then raise exception 'Please accept the current Terms of Use'; end if;
  if not public.is_user_feature_enabled(v_uid, 'friend_requests')
     or not public.is_user_feature_enabled(p_target_user_id, 'friend_requests') then
    raise exception 'Friend requests are disabled by the parent or guardian settings';
  end if;
  if p_target_user_id is null or p_target_user_id = v_uid then raise exception 'Invalid friend target'; end if;
  if public.are_users_blocked(v_uid, p_target_user_id) then raise exception 'This user cannot be contacted'; end if;
  if exists (
    select 1 from public.friends f
    where (f.user_id = v_uid and f.friend_id = p_target_user_id)
       or (f.user_id = p_target_user_id and f.friend_id = v_uid)
  ) then raise exception 'A friend request or friendship already exists'; end if;
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
   where id = p_request_id and friend_id = v_uid and status = 'pending' for update;
  if not found then raise exception 'Friend request not found'; end if;
  if public.are_users_blocked(v_uid, v_friend.user_id) then raise exception 'This user cannot be contacted'; end if;
  if not public.is_user_feature_enabled(v_uid, 'friend_requests')
     or not public.is_user_feature_enabled(v_friend.user_id, 'friend_requests') then
    raise exception 'Friend requests are disabled by parent or guardian settings';
  end if;
  if p_accept then
    if not public.has_accepted_policy('community_terms', '2026-11-24')
       or not public.is_user_feature_enabled(v_uid, 'friend_requests')
       or not public.is_user_feature_enabled(v_friend.user_id, 'friend_requests') then
      raise exception 'Friend requests are disabled by parent or guardian settings';
    end if;
    update public.friends set status = 'accepted', updated_at = now() where id = p_request_id returning * into v_friend;
  else
    -- Declining a request remains available even when a parent has disabled friend requests.
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
  if not public.has_accepted_policy('community_terms', '2026-11-24') then raise exception 'Please accept the current Terms of Use before messaging'; end if;
  if not public.is_user_feature_enabled(v_uid, 'direct_messages')
     or not public.is_user_feature_enabled(p_receiver_id, 'direct_messages') then
    raise exception 'Direct messages are disabled by parent or guardian settings';
  end if;
  if p_receiver_id is null or p_receiver_id = v_uid then raise exception 'Invalid recipient'; end if;
  if public.are_users_blocked(v_uid, p_receiver_id) then raise exception 'This user cannot be contacted'; end if;
  if not exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and ((f.user_id = v_uid and f.friend_id = p_receiver_id) or (f.friend_id = v_uid and f.user_id = p_receiver_id))
  ) then raise exception 'You can only message an accepted friend'; end if;
  if trim(coalesce(p_content, '')) = '' then raise exception 'Message cannot be empty'; end if;
  insert into public.messages(sender_id, receiver_id, content)
  values (v_uid, p_receiver_id, left(trim(p_content), 2000))
  returning * into v_message;
  return v_message;
end;
$$;

create or replace function public.send_group_message(
  p_group_id uuid, p_content text, p_message_type text default 'text',
  p_reply_to_id uuid default null, p_attachment_url text default null
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
  if v_user is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24') then raise exception using errcode = '42501', message = 'Please accept the current Terms of Use'; end if;
  if not public.is_user_feature_enabled(v_user, 'direct_messages') then raise exception 'Group messaging is disabled by parent or guardian settings'; end if;
  if not exists (select 1 from public.chat_group_members m where m.group_id = p_group_id and m.user_id = v_user) then
    raise exception using errcode = '42501', message = 'You must be a group member to send messages';
  end if;
  if p_content is null or length(btrim(p_content)) = 0 or length(p_content) > 4000 then
    raise exception using errcode = '22023', message = 'Message must be between 1 and 4000 characters';
  end if;
  if p_message_type is null or length(p_message_type) = 0 or length(p_message_type) > 32 then
    raise exception using errcode = '22023', message = 'Invalid message type';
  end if;
  if p_reply_to_id is not null and not exists (select 1 from public.group_messages r where r.id = p_reply_to_id and r.group_id = p_group_id) then
    raise exception using errcode = '22023', message = 'Reply target is not in this group';
  end if;
  insert into public.group_messages(group_id, sender_id, content, message_type, reply_to_id, attachment_url)
  values (p_group_id, v_user, btrim(p_content), p_message_type, p_reply_to_id, p_attachment_url)
  returning * into v_message;
  update public.chat_groups set updated_at = now() where id = p_group_id;
  return v_message;
end;
$$;

create or replace function public.create_chat_group(p_name text, p_description text default null, p_group_type text default 'private')
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
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(v_user, 'social') then
    raise exception using errcode = '42501', message = 'Community groups are not enabled for this account';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 or length(btrim(p_name)) > 120 then raise exception using errcode = '22023', message = 'Group name must be between 1 and 120 characters'; end if;
  if p_group_type is null or p_group_type not in ('private', 'public', 'class', 'subject', 'group', 'room') then raise exception using errcode = '22023', message = 'Unsupported group type'; end if;
  insert into public.chat_groups(name, description, group_type, created_by)
  values (btrim(p_name), nullif(btrim(p_description), ''), p_group_type, v_user)
  returning * into v_group;
  insert into public.chat_group_members(group_id, user_id, role) values (v_group.id, v_user, 'owner');
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
  v_caller uuid := auth.uid();
  v_room uuid;
begin
  if v_caller is null then raise exception 'Sign in required' using errcode = '28000'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24') then raise exception 'Please accept the current Terms of Use'; end if;
  if not public.is_user_feature_enabled(v_caller, 'calls')
     or not public.is_user_feature_enabled(_friend_id, 'calls') then
    raise exception 'Study Mode calls are disabled by parent or guardian settings';
  end if;
  if _friend_id is null or _friend_id = v_caller then raise exception 'Choose a different friend'; end if;
  if public.are_users_blocked(v_caller, _friend_id) then raise exception 'This user cannot be contacted'; end if;
  if not exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and ((f.user_id = v_caller and f.friend_id = _friend_id) or (f.friend_id = v_caller and f.user_id = _friend_id))
  ) then raise exception 'You can only call an accepted friend'; end if;
  insert into public.study_call_rooms(created_by) values (v_caller) returning id into v_room;
  insert into public.study_call_participants(room_id, user_id, invited_by, status, responded_at)
  values (v_room, v_caller, v_caller, 'accepted', now()), (v_room, _friend_id, v_caller, 'invited', null);
  return v_room;
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
  if not public.has_accepted_policy('community_terms', '2026-11-24') then raise exception 'Please accept the current Terms of Use'; end if;
  if not public.is_user_feature_enabled(v_uid, 'multiplayer')
     or not public.is_user_feature_enabled(_receiver_id, 'multiplayer') then
    raise exception 'Multiplayer invitations are disabled by parent or guardian settings';
  end if;
  if _receiver_id is null or _receiver_id = v_uid then raise exception 'Invalid invite recipient'; end if;
  if public.are_users_blocked(v_uid, _receiver_id) then raise exception 'This user cannot be contacted'; end if;
  select host_id, status, max_players into v_host, v_status, v_max_players from public.multiplayer_rooms where id = _room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_host <> v_uid then raise exception 'Only the host can invite players'; end if;
  if v_status <> 'waiting' then raise exception 'Invites are only available while the room is waiting'; end if;
  select count(*)::integer into v_player_count from public.room_players where room_id = _room_id;
  if v_player_count >= coalesce(v_max_players, 8) then raise exception 'Room is full'; end if;
  if exists (select 1 from public.room_players where room_id = _room_id and user_id = _receiver_id) then raise exception 'Player is already in this room'; end if;
  if exists (select 1 from public.multiplayer_invites where room_id = _room_id and receiver_id = _receiver_id and status = 'pending' and expires_at > now()) then
    raise exception 'An active invite already exists for this player';
  end if;
  insert into public.multiplayer_invites(room_id, sender_id, receiver_id, status, expires_at)
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
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(v_user, 'multiplayer') then
    raise exception 'Study competitions are disabled by parent or guardian settings';
  end if;
  if length(v_name) < 3 or length(v_name) > 80 then raise exception 'Competition name must be between 3 and 80 characters'; end if;
  insert into public.study_competitions(name, created_by, start_time, end_time, status)
  values (v_name, v_user, now(), now() + interval '24 hours', 'active')
  returning * into v_competition;
  insert into public.study_participants(competition_id, user_id, total_study_time)
  values (v_competition.id, v_user, 0)
  on conflict (competition_id, user_id) do nothing;
  return v_competition;
end;
$$;

create or replace function public.multiplayer_create_room(
  p_name text, p_subject text, p_difficulty text, p_question_count integer, p_max_players integer, p_password text default null
)
returns public.multiplayer_rooms
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.multiplayer_rooms%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(v_uid, 'multiplayer') then
    raise exception 'Multiplayer is disabled by parent or guardian settings';
  end if;
  if p_max_players is null or p_max_players < 2 or p_max_players > 8 then raise exception 'Player limit must be between 2 and 8'; end if;
  if p_question_count is null or p_question_count < 1 or p_question_count > 50 then raise exception 'Question count must be between 1 and 50'; end if;
  if octet_length(coalesce(p_password, '')) > 256 then raise exception 'Room password is too long'; end if;
  insert into public.multiplayer_rooms(name, host_id, max_players, subject, difficulty, question_count, has_password, status, game_mode)
  values (
    left(trim(coalesce(p_name, 'Room')), 80), v_uid, p_max_players,
    coalesce(nullif(trim(p_subject), ''), 'Mixed'),
    coalesce(nullif(trim(p_difficulty), ''), 'Medium'),
    p_question_count,
    nullif(trim(coalesce(p_password, '')), '') is not null,
    'waiting', 'speed'
  ) returning * into v_room;
  if nullif(trim(coalesce(p_password, '')), '') is not null then
    insert into public.multiplayer_room_secrets(room_id, password_hash)
    values (v_room.id, extensions.crypt(encode(extensions.digest(p_password, 'sha256'), 'hex'), extensions.gen_salt('bf')));
  end if;
  insert into public.room_players(room_id, user_id, is_ready) values (v_room.id, v_uid, true);
  return v_room;
end;
$$;

-- RLS also checks the current user's parent-approved feature flags.
drop policy if exists "involved users can view" on public.friends;
create policy "involved users can view"
  on public.friends for select to authenticated
  using (
    public.is_current_user_feature_enabled('friend_requests')
    and (user_id = (select auth.uid()) or friend_id = (select auth.uid()))
    and not public.is_blocked_with(case when user_id = (select auth.uid()) then friend_id else user_id end)
  );

drop policy if exists "involved users can view" on public.followers;
create policy "involved users can view"
  on public.followers for select to authenticated
  using (
    public.is_current_user_feature_enabled('social')
    and (follower_id = (select auth.uid()) or following_id = (select auth.uid()))
    and not public.is_blocked_with(case when follower_id = (select auth.uid()) then following_id else follower_id end)
  );

drop policy if exists "involved users can view messages" on public.messages;
create policy "involved users can view messages"
  on public.messages for select to authenticated
  using (
    public.is_current_user_feature_enabled('direct_messages')
    and (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and not public.is_blocked_with(case when sender_id = (select auth.uid()) then receiver_id else sender_id end)
  );

drop policy if exists "Authenticated users can view opted-in posts" on public.social_posts;
create policy "Authenticated users can view opted-in posts"
  on public.social_posts for select to authenticated
  using (
    public.is_current_user_feature_enabled('social')
    and (
      author_id = (select auth.uid())
      or (
        not public.is_blocked_with(author_id)
        and coalesce((select p.is_public from public.profile_privacy_settings p where p.user_id = social_posts.author_id), true)
      )
    )
  );

drop policy if exists "authenticated can create post" on public.social_posts;
create policy "authenticated can create post"
  on public.social_posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('social')
  );

drop policy if exists "authenticated can view visible post comments" on public.social_post_comments;
create policy "authenticated can view visible post comments"
  on public.social_post_comments for select to authenticated
  using (
    public.is_current_user_feature_enabled('social')
    and not public.is_blocked_with(user_id)
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_comments.post_id
        and (p.author_id = (select auth.uid()) or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true))
    )
  );

drop policy if exists "users can comment on visible posts" on public.social_post_comments;
create policy "users can comment on visible posts"
  on public.social_post_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('social')
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_comments.post_id and not public.is_blocked_with(p.author_id)
    )
  );

drop policy if exists "members can view group messages" on public.group_messages;
create policy "members can view group messages"
  on public.group_messages for select to authenticated
  using (
    public.is_current_user_feature_enabled('direct_messages')
    and not public.is_blocked_with(sender_id)
    and exists (select 1 from public.chat_group_members m where m.group_id = group_messages.group_id and m.user_id = (select auth.uid()))
  );

drop policy if exists "members can send group messages" on public.group_messages;
create policy "members can send group messages"
  on public.group_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('direct_messages')
    and exists (select 1 from public.chat_group_members m where m.group_id = group_messages.group_id and m.user_id = (select auth.uid()))
  );

drop policy if exists "authenticated can view lobby" on public.lobby_messages;
create policy "authenticated can view lobby"
  on public.lobby_messages for select to authenticated
  using (public.is_current_user_feature_enabled('social') and not public.is_blocked_with(user_id));

drop policy if exists "authenticated can post lobby" on public.lobby_messages;
create policy "authenticated can post lobby"
  on public.lobby_messages for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('social')
  );

drop policy if exists "Room players can view room chat" on public.room_chat_messages;
drop policy if exists "room_chat_member_read" on public.room_chat_messages;
create policy "room_chat_member_read"
  on public.room_chat_messages for select to authenticated
  using (
    public.is_current_user_feature_enabled('social')
    and public.is_multiplayer_room_member(room_id)
    and not public.is_blocked_with(user_id)
  );

drop policy if exists "participants can view own invitations" on public.study_call_participants;
create policy "participants can view own invitations"
  on public.study_call_participants for select to authenticated
  using (
    public.is_current_user_feature_enabled('calls')
    and (auth.uid() = user_id or auth.uid() = invited_by)
    and not public.is_blocked_with(case when auth.uid() = user_id then invited_by else user_id end)
  );

drop policy if exists "users invite friends to own call" on public.study_call_participants;
create policy "users invite friends to own call"
  on public.study_call_participants for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('calls')
    and not public.is_blocked_with(user_id)
    and exists (select 1 from public.study_call_rooms r where r.id = study_call_participants.room_id and r.created_by = (select auth.uid()))
  );

drop policy if exists "involved can view invite" on public.multiplayer_invites;
create policy "involved can view invite"
  on public.multiplayer_invites for select to authenticated
  using (
    public.is_current_user_feature_enabled('multiplayer')
    and (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and not public.is_blocked_with(case when sender_id = (select auth.uid()) then receiver_id else sender_id end)
  );

drop policy if exists "sender creates invite" on public.multiplayer_invites;
create policy "sender creates invite"
  on public.multiplayer_invites for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('multiplayer')
    and not public.is_blocked_with(receiver_id)
  );

-- Enforce guardian settings for direct table writes as well as RPC callers.
create or replace function public.enforce_guardian_relationship_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if not public.has_accepted_policy('community_terms', '2026-11-24') then
    raise exception 'Accept the current community terms before creating social relationships';
  end if;
  if tg_table_name = 'friends' then
    if tg_op = 'INSERT' and new.user_id <> auth.uid() then
      raise exception 'You can only send a friend request from your own account';
    end if;
    if not public.is_user_feature_enabled(new.user_id, 'friend_requests')
       or not public.is_user_feature_enabled(new.friend_id, 'friend_requests') then
      raise exception 'Friend requests are disabled by parent or guardian settings';
    end if;
    if public.are_users_blocked(new.user_id, new.friend_id) then
      raise exception 'This user cannot be contacted';
    end if;
    if tg_op = 'UPDATE' and new.status in ('accepted', 'pending') and new.friend_id <> auth.uid() and new.user_id <> auth.uid() then
      raise exception 'Only a participant can update this friendship';
    end if;
  elsif tg_table_name = 'followers' then
    if new.follower_id <> auth.uid() then raise exception 'You can only follow from your own account'; end if;
    if not public.is_user_feature_enabled(new.follower_id, 'social')
       or not public.is_user_feature_enabled(new.following_id, 'social') then
      raise exception 'Social features are disabled by parent or guardian settings';
    end if;
    if public.are_users_blocked(new.follower_id, new.following_id) then
      raise exception 'This user cannot be contacted';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_friend_relationship_guard on public.friends;
create trigger guardian_friend_relationship_guard
  before insert or update on public.friends
  for each row execute function public.enforce_guardian_relationship_permissions();
drop trigger if exists guardian_follow_relationship_guard on public.followers;
create trigger guardian_follow_relationship_guard
  before insert or update on public.followers
  for each row execute function public.enforce_guardian_relationship_permissions();
revoke all on function public.enforce_guardian_relationship_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_message_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.sender_id <> auth.uid() then raise exception 'You can only send messages from your own account'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.sender_id, 'direct_messages')
     or not public.is_user_feature_enabled(new.receiver_id, 'direct_messages') then
    raise exception 'Direct messaging is disabled by parent or guardian settings';
  end if;
  if public.are_users_blocked(new.sender_id, new.receiver_id) then raise exception 'This user cannot be contacted'; end if;
  if not exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and ((f.user_id = new.sender_id and f.friend_id = new.receiver_id)
        or (f.friend_id = new.sender_id and f.user_id = new.receiver_id))
  ) then raise exception 'You can only message an accepted friend'; end if;
  return new;
end;
$$;

drop trigger if exists guardian_direct_message_guard on public.messages;
create trigger guardian_direct_message_guard
  before insert on public.messages
  for each row execute function public.enforce_guardian_message_permissions();
revoke all on function public.enforce_guardian_message_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_call_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.invited_by <> auth.uid() then raise exception 'You can only invite from your own account'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.invited_by, 'calls')
     or not public.is_user_feature_enabled(new.user_id, 'calls') then
    raise exception 'Study Mode calls are disabled by parent or guardian settings';
  end if;
  if public.are_users_blocked(new.invited_by, new.user_id) then raise exception 'This user cannot be contacted'; end if;
  if new.user_id <> new.invited_by and not exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and ((f.user_id = new.invited_by and f.friend_id = new.user_id)
        or (f.friend_id = new.invited_by and f.user_id = new.user_id))
  ) then raise exception 'Study Mode calls are limited to accepted friends'; end if;
  return new;
end;
$$;

drop trigger if exists guardian_call_participant_guard on public.study_call_participants;
create trigger guardian_call_participant_guard
  before insert on public.study_call_participants
  for each row execute function public.enforce_guardian_call_permissions();
revoke all on function public.enforce_guardian_call_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_multiplayer_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.sender_id <> auth.uid() then raise exception 'You can only invite from your own account'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.sender_id, 'multiplayer')
     or not public.is_user_feature_enabled(new.receiver_id, 'multiplayer') then
    raise exception 'Multiplayer invitations are disabled by parent or guardian settings';
  end if;
  if public.are_users_blocked(new.sender_id, new.receiver_id) then raise exception 'This user cannot be contacted'; end if;
  return new;
end;
$$;

drop trigger if exists guardian_multiplayer_invite_guard on public.multiplayer_invites;
create trigger guardian_multiplayer_invite_guard
  before insert on public.multiplayer_invites
  for each row execute function public.enforce_guardian_multiplayer_permissions();
revoke all on function public.enforce_guardian_multiplayer_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_multiplayer_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.status = 'accepted' then
    if new.receiver_id <> auth.uid() then
      raise exception 'Only the invited recipient can accept this invitation';
    end if;
    if not public.is_user_feature_enabled(auth.uid(), 'multiplayer')
       or not public.is_user_feature_enabled(new.sender_id, 'multiplayer')
       or not public.is_user_feature_enabled(new.receiver_id, 'multiplayer')
       or public.are_users_blocked(new.sender_id, new.receiver_id) then
      raise exception 'This multiplayer invitation is no longer available';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_multiplayer_invite_update_guard on public.multiplayer_invites;
create trigger guardian_multiplayer_invite_update_guard
  before update on public.multiplayer_invites
  for each row execute function public.enforce_guardian_multiplayer_update_permissions();
revoke all on function public.enforce_guardian_multiplayer_update_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_call_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.status = 'accepted' then
    if new.user_id <> auth.uid() then raise exception 'Only the invited learner can accept this call'; end if;
    if not public.is_user_feature_enabled(new.user_id, 'calls')
       or not public.is_user_feature_enabled(new.invited_by, 'calls')
       or public.are_users_blocked(new.invited_by, new.user_id) then
      raise exception 'This Study Mode call is no longer available';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_call_participant_update_guard on public.study_call_participants;
create trigger guardian_call_participant_update_guard
  before update on public.study_call_participants
  for each row execute function public.enforce_guardian_call_update_permissions();
revoke all on function public.enforce_guardian_call_update_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_group_membership_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then return new; end if;
  if new.user_id = auth.uid() then
    if not public.has_accepted_policy('community_terms', '2026-11-24')
       or not public.is_user_feature_enabled(auth.uid(), 'social') then
      raise exception 'Community group access is disabled by parent or guardian settings';
    end if;
  elsif not (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    or public.has_role(auth.uid(), 'manager'::public.app_role)
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'extreme_admin'::public.app_role)
  ) then
    raise exception 'You cannot add another account to a community group';
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_group_membership_guard on public.chat_group_members;
create trigger guardian_group_membership_guard
  before insert on public.chat_group_members
  for each row execute function public.enforce_guardian_group_membership_permissions();
revoke all on function public.enforce_guardian_group_membership_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_room_player_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.user_id <> auth.uid() then raise exception 'You can only join a room as your own account'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.user_id, 'multiplayer') then
    raise exception 'Multiplayer is disabled by parent or guardian settings';
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_room_player_guard on public.room_players;
create trigger guardian_room_player_guard
  before insert on public.room_players
  for each row execute function public.enforce_guardian_room_player_permissions();
revoke all on function public.enforce_guardian_room_player_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_room_chat_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.user_id <> auth.uid() then raise exception 'You can only send room chat from your own account'; end if;
  if not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.user_id, 'multiplayer')
     or not public.is_user_feature_enabled(new.user_id, 'social') then
    raise exception 'Room chat is disabled by parent or guardian settings';
  end if;
  if not public.is_multiplayer_room_member(new.room_id) then raise exception 'You must be a room member to send chat'; end if;
  return new;
end;
$$;

drop trigger if exists guardian_room_chat_guard on public.room_chat_messages;
create trigger guardian_room_chat_guard
  before insert on public.room_chat_messages
  for each row execute function public.enforce_guardian_room_chat_permissions();
revoke all on function public.enforce_guardian_room_chat_permissions() from public, anon, authenticated;

drop policy if exists "members can view roster" on public.chat_group_members;
create policy "members can view roster"
  on public.chat_group_members for select to authenticated
  using (
    public.is_current_user_feature_enabled('direct_messages')
    and ((user_id = (select auth.uid())) or is_chat_group_member(group_id))
  );

drop policy if exists "room_players_member_or_public_lobby_read" on public.room_players;
create policy "room_players_member_or_public_lobby_read"
  on public.room_players for select to authenticated
  using (
    public.is_current_user_feature_enabled('multiplayer')
    and (is_multiplayer_room_member(room_id) or is_multiplayer_public_room(room_id))
  );

create or replace function public.enforce_guardian_competition_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.user_id <> auth.uid()
     or not public.has_accepted_policy('community_terms', '2026-11-24')
     or not public.is_user_feature_enabled(new.user_id, 'multiplayer') then
    raise exception 'Study competitions are disabled by parent or guardian settings';
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_study_participant_guard on public.study_participants;
create trigger guardian_study_participant_guard
  before insert on public.study_participants
  for each row execute function public.enforce_guardian_competition_permissions();
drop trigger if exists guardian_tournament_participant_guard on public.tournament_participants;
create trigger guardian_tournament_participant_guard
  before insert on public.tournament_participants
  for each row execute function public.enforce_guardian_competition_permissions();
revoke all on function public.enforce_guardian_competition_permissions() from public, anon, authenticated;

create or replace function public.enforce_guardian_group_membership_permissions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_is_school_staff boolean;
begin
  if auth.uid() is null then return new; end if;
  if new.user_id = auth.uid() then
    if not public.has_accepted_policy('community_terms', '2026-11-24')
       or not public.is_user_feature_enabled(auth.uid(), 'social') then
      raise exception 'Community group access is disabled by parent or guardian settings';
    end if;
    return new;
  end if;

  v_is_school_staff :=
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    or public.has_role(auth.uid(), 'manager'::public.app_role)
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'extreme_admin'::public.app_role);

  if not v_is_school_staff and not public.is_chat_group_creator(new.group_id) then
    raise exception 'You cannot add another account to a community group';
  end if;
  if not v_is_school_staff and not public.is_user_feature_enabled(new.user_id, 'social') then
    raise exception 'The invited learner has community features disabled by their parent or guardian';
  end if;
  return new;
end;
$$;

drop trigger if exists guardian_group_membership_guard on public.chat_group_members;
create trigger guardian_group_membership_guard
  before insert on public.chat_group_members
  for each row execute function public.enforce_guardian_group_membership_permissions();
revoke all on function public.enforce_guardian_group_membership_permissions() from public, anon, authenticated;

-- Direct social interactions are subject to the same consent and feature gates.
drop policy if exists "users can like visible posts" on public.social_post_likes;
create policy "users can like visible posts"
  on public.social_post_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('social')
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_likes.post_id and not public.is_blocked_with(p.author_id)
    )
  );

drop policy if exists "users can react to visible posts" on public.social_post_reactions;
create policy "users can react to visible posts"
  on public.social_post_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('social')
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_reactions.post_id and not public.is_blocked_with(p.author_id)
    )
  );

drop policy if exists "insert own rows" on public.saved_posts;
drop policy if exists "users can save visible posts" on public.saved_posts;
create policy "users can save visible posts"
  on public.saved_posts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_current_user_feature_enabled('social')
    and exists (
      select 1 from public.social_posts p
      where p.id = saved_posts.post_id
        and (p.author_id = (select auth.uid()) or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true))
    )
  );

drop policy if exists "users can view own saved posts" on public.saved_posts;
create policy "users can view own saved posts"
  on public.saved_posts for select to authenticated
  using (user_id = (select auth.uid()) and public.is_current_user_feature_enabled('social'));

drop policy if exists "authors can update own posts" on public.social_posts;
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
      and public.is_current_user_feature_enabled('social')
    )
    or has_role((select auth.uid()), 'admin'::app_role)
    or has_role((select auth.uid()), 'manager'::app_role)
  );

drop policy if exists "users can update own comments" on public.social_post_comments;
create policy "users can update own comments"
  on public.social_post_comments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.has_accepted_policy('community_terms', '2026-11-24')
    and public.is_current_user_feature_enabled('social')
  );

-- Parent revocation removes access to social feeds by making the child's profile private.
comment on table public.guardian_child_controls is 'Parent-managed feature permissions for verified minor accounts; all community features default off.';
