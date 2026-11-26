-- Prevent a learner from changing an already-recorded minor age into an adult age.
-- The guard exists in both the self-service RPC and the profile trigger so a
-- direct PostgREST profile update cannot bypass it.
create or replace function public.set_my_age_and_guardian(
  p_age integer,
  p_guardian_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_existing_age integer;
  v_guardian_email text := nullif(lower(trim(coalesce(p_guardian_email, ''))), '');
  v_at_position integer;
  v_request_id uuid;
begin
  if v_user_id is null or not public.has_role(v_user_id, 'student'::public.app_role) then
    raise exception using errcode = '42501', message = 'Learner account required';
  end if;
  if p_age is null or p_age < 3 or p_age > 120 then
    raise exception 'Enter a valid age';
  end if;

  select p.age into v_existing_age
    from public.profiles p
   where p.id = v_user_id
   for update;

  if v_existing_age is not null and v_existing_age < 18 and p_age >= 18 then
    raise exception using
      errcode = '42501',
      message = 'A learner cannot change an existing under-18 age to 18 or older through self-service. Contact a verified adult or support for an age correction.';
  end if;

  select lower(u.email) into v_email
    from auth.users u
   where u.id = v_user_id;

  if p_age < 18 then
    v_at_position := position('@' in coalesce(v_guardian_email, ''));
    if v_guardian_email is null
       or v_guardian_email = v_email
       or v_at_position <= 1
       or position('@' in substring(v_guardian_email from v_at_position + 1)) > 0
       or position('.' in split_part(v_guardian_email, '@', 2)) <= 1
       or right(v_guardian_email, 1) = '.'
       or position(' ' in v_guardian_email) > 0 then
      raise exception 'A separate, valid parent or guardian email is required';
    end if;

    update public.guardian_consent_requests
       set status = 'rejected', reviewed_at = now()
     where child_id = v_user_id
       and status = 'pending'
       and lower(guardian_email) <> v_guardian_email;

    delete from public.guardian_child_controls
     where child_id = v_user_id;

    select r.id into v_request_id
      from public.guardian_consent_requests r
     where r.child_id = v_user_id
       and lower(r.guardian_email) = v_guardian_email
       and r.status = 'pending'
     order by r.created_at desc
     limit 1;

    if v_request_id is null then
      insert into public.guardian_consent_requests(child_id, guardian_email)
      values (v_user_id, v_guardian_email)
      returning id into v_request_id;
    end if;

    update public.profiles
       set age = p_age,
           guardian_email = v_guardian_email,
           guardian_consent = false,
           guardian_consent_status = 'pending',
           guardian_user_id = null,
           consent_at = null
     where id = v_user_id;
  else
    update public.guardian_consent_requests
       set status = 'rejected', reviewed_at = now()
     where child_id = v_user_id and status = 'pending';

    delete from public.guardian_child_controls
     where child_id = v_user_id;

    update public.profiles
       set age = p_age,
           guardian_email = null,
           guardian_consent = false,
           guardian_consent_status = 'not_required',
           guardian_user_id = null,
           consent_at = null
     where id = v_user_id;

    v_request_id := null;
  end if;

  return v_request_id;
end;
$function$;

-- Defense in depth: protect the age transition even when a client attempts a
-- direct UPDATE of its own profile instead of calling the RPC.
create or replace function public.validate_guardian_consent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_child_email text;
begin
  if tg_op = 'UPDATE'
     and old.age is not null
     and old.age < 18
     and new.age >= 18
     and auth.uid() = old.id then
    raise exception using
      errcode = '42501',
      message = 'A learner cannot change an existing under-18 age to 18 or older through self-service. Contact a verified adult or support for an age correction.';
  end if;

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
$function$;

revoke all on function public.set_my_age_and_guardian(integer, text) from public, anon;
grant execute on function public.set_my_age_and_guardian(integer, text) to authenticated;
