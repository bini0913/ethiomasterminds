-- Protect student identity, grade and progression fields at the database boundary.
-- Client profile writes are column-allowlisted; trusted SECURITY DEFINER RPCs
-- remain the only path for grade changes and server-owned progression/status.

alter table public.profiles
  add column if not exists age integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_age_range_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_age_range_check
      check (age is null or age between 3 and 120) not valid;
  end if;
end;
$$;

-- Remove table-wide and legacy column-level client write grants first.
revoke insert, update on table public.profiles from public, anon, authenticated;
revoke insert (
  id, name, username, gender, grade, education_level, xp, level, avatar,
  rank, badges, created_at, updated_at, avatar_config, language, season_xp,
  account_status, total_study_time, age
) on table public.profiles from public, anon, authenticated;
revoke update (
  id, name, username, gender, grade, education_level, xp, level, avatar,
  rank, badges, created_at, updated_at, avatar_config, language, season_xp,
  account_status, total_study_time, age
) on table public.profiles from public, anon, authenticated;

-- Safe self-service fields only. Profile identity, grade, education tier,
-- progression, moderation status and timestamps remain server-controlled.
grant insert (id, name, username, gender, age, avatar, avatar_config, language)
  on table public.profiles to authenticated;
grant update (name, username, gender, age, avatar, avatar_config, language)
  on table public.profiles to authenticated;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own editable profile fields"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- First-time setup can set a grade only when none exists. Re-submitting the
-- same grade is idempotent; changing an existing grade requires staff approval.
create or replace function public.set_initial_student_grade(p_grade text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_input text := upper(trim(coalesce(p_grade, '')));
  v_grade text;
  v_education_level text;
  v_existing text;
  v_existing_canonical text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if public.get_user_role(v_uid) is distinct from 'student'::public.app_role then
    raise exception 'Only student accounts can set a student grade';
  end if;

  if v_input in ('K', 'KG', 'KINDERGARTEN') then
    v_grade := 'KG';
    v_education_level := 'early';
  elsif v_input ~ '^(GRADE[[:space:]]*)?(1[0-2]|[1-9])$' then
    v_grade := coalesce(substring(v_input from '(1[0-2]|[1-9])'), '');
    v_education_level := case
      when v_grade::integer <= 4 then 'early'
      when v_grade::integer <= 8 then 'middle'
      else 'upper'
    end;
  else
    raise exception 'Choose KG or a grade from 1 to 12';
  end if;

  select grade into v_existing
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    raise exception 'Student profile not found';
  end if;

  v_existing_canonical := upper(trim(coalesce(v_existing, '')));
  if v_existing_canonical in ('K', 'KG', 'KINDERGARTEN') then
    v_existing_canonical := 'KG';
  elsif v_existing_canonical ~ '^(GRADE[[:space:]]*)?(1[0-2]|[1-9])$' then
    v_existing_canonical := coalesce(substring(v_existing_canonical from '(1[0-2]|[1-9])'), '');
  end if;

  if v_existing is not null and trim(v_existing) <> '' then
    if v_existing_canonical = v_grade then
      update public.profiles
      set education_level = v_education_level
      where id = v_uid
        and education_level is distinct from v_education_level;
      return jsonb_build_object('success', true, 'grade', v_grade, 'education_level', v_education_level);
    end if;
    raise exception 'Your grade is already set. Contact school staff to change it';
  end if;

  update public.profiles
  set grade = v_grade,
      education_level = v_education_level,
      updated_at = now()
  where id = v_uid;

  return jsonb_build_object('success', true, 'grade', v_grade, 'education_level', v_education_level);
end;
$function$;

revoke all on function public.set_initial_student_grade(text) from public, anon;
grant execute on function public.set_initial_student_grade(text) to authenticated;

-- Staff grade corrections use a role-checked, audit-logged database operation,
-- never a direct client UPDATE of protected columns.
create or replace function public.admin_update_student_grade(p_user_id uuid, p_grade text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, auth
as $function$
declare
  v_input text := upper(trim(coalesce(p_grade, '')));
  v_grade text;
  v_education_level text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'manager'::public.app_role)
    or public._is_extreme_admin()
  ) then
    raise exception 'Staff permission required';
  end if;

  if public.get_user_role(p_user_id) is distinct from 'student'::public.app_role then
    raise exception 'Target account is not a student';
  end if;

  if v_input in ('K', 'KG', 'KINDERGARTEN') then
    v_grade := 'KG';
    v_education_level := 'early';
  elsif v_input ~ '^(GRADE[[:space:]]*)?(1[0-2]|[1-9])$' then
    v_grade := coalesce(substring(v_input from '(1[0-2]|[1-9])'), '');
    v_education_level := case
      when v_grade::integer <= 4 then 'early'
      when v_grade::integer <= 8 then 'middle'
      else 'upper'
    end;
  else
    raise exception 'Choose KG or a grade from 1 to 12';
  end if;

  update public.profiles
  set grade = v_grade,
      education_level = v_education_level,
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'Student profile not found';
  end if;

  insert into public.admin_audit_logs(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'staff_set_student_grade', 'user', p_user_id,
          jsonb_build_object('grade', v_grade, 'education_level', v_education_level));

  return true;
end;
$function$;

revoke all on function public.admin_update_student_grade(uuid, text) from public, anon;
grant execute on function public.admin_update_student_grade(uuid, text) to authenticated;

comment on column public.profiles.grade is
  'Server-controlled student grade; set once during onboarding or changed through staff-authorized RPC.';
comment on column public.profiles.xp is
  'Server-authoritative progression total; clients have no direct write privilege.';
comment on column public.profiles.season_xp is
  'Server-authoritative seasonal progression; clients have no direct write privilege.';
comment on column public.profiles.level is
  'Server-derived level; clients have no direct write privilege.';
comment on column public.profiles.account_status is
  'Moderation-controlled account status; clients have no direct write privilege.';
