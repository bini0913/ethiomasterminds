-- Reconcile the production tournament schema with the current Tournament Hub.
-- Keep the existing tournament_participants table as the historical record while
-- providing the richer workflow tables expected by the UI.

alter table public.tournaments
  add column if not exists title text,
  add column if not exists mode text default 'speed',
  add column if not exists questions_count integer default 10,
  add column if not exists question_count integer default 10,
  add column if not exists questions_per_match integer default 10,
  add column if not exists starts_at timestamptz,
  add column if not exists registration_deadline timestamptz,
  add column if not exists max_players integer,
  add column if not exists current_players integer default 0,
  add column if not exists entry_fee integer default 0,
  add column if not exists entry_cost integer default 0,
  add column if not exists ends_at timestamptz,
  add column if not exists winner_id uuid,
  add column if not exists settings jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz default now();

update public.tournaments
set title = coalesce(title, name),
    mode = coalesce(mode, 'speed'),
    questions_count = coalesce(questions_count, 10),
    question_count = coalesce(question_count, questions_count, 10),
    questions_per_match = coalesce(questions_per_match, question_count, questions_count, 10),
    starts_at = coalesce(starts_at, start_time),
    max_players = coalesce(max_players, max_participants, 16),
    current_players = coalesce(current_players, 0),
    entry_fee = coalesce(entry_fee, entry_fee_coins, 0),
    entry_cost = coalesce(entry_cost, entry_fee_coins, 0),
    ends_at = coalesce(ends_at, end_time),
    settings = coalesce(settings, '{}'::jsonb),
    updated_at = now()
where true;

create table if not exists public.tournament_players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active',
  join_status text not null default 'active',
  joined_at timestamptz not null default now(),
  unique(tournament_id, user_id)
);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round integer not null default 1,
  round_number integer not null default 1,
  bracket_position integer not null default 1,
  status text not null default 'waiting',
  player1_id uuid references public.profiles(id),
  player2_id uuid references public.profiles(id),
  winner_id uuid references public.profiles(id),
  score_player1 integer not null default 0,
  score_player2 integer not null default 0,
  room_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  event_type text not null,
  data jsonb not null default '{}'::jsonb,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.tournament_players enable row level security;
alter table public.tournament_matches enable row level security;
alter table public.tournament_events enable row level security;

drop policy if exists "authenticated tournament players read" on public.tournament_players;
create policy "authenticated tournament players read"
on public.tournament_players for select to authenticated using (true);

drop policy if exists "authenticated tournament matches read" on public.tournament_matches;
create policy "authenticated tournament matches read"
on public.tournament_matches for select to authenticated using (true);

drop policy if exists "authenticated tournament events read" on public.tournament_events;
create policy "authenticated tournament events read"
on public.tournament_events for select to authenticated using (true);

create or replace function public.recount_tournament_players(p_tournament_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.tournament_players
  where tournament_id = p_tournament_id and status = 'active';

  update public.tournaments
  set current_players = v_count, updated_at = now()
  where id = p_tournament_id;

  return v_count;
end;
$$;

create or replace function public.create_tournament_workflow(
  p_name text,
  p_mode text,
  p_subject text,
  p_max_players integer,
  p_questions_per_match integer,
  p_start_time timestamptz,
  p_registration_deadline timestamptz,
  p_entry_fee integer default 0
)
returns public.tournaments
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_t public.tournaments%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not (public.has_role(v_uid,'manager') or public.has_role(v_uid,'admin') or public.has_role(v_uid,'extreme_admin')) then
    raise exception 'Only managers/admins can create tournaments';
  end if;
  if p_max_players not in (8,16,32) then raise exception 'Player count must be 8, 16, or 32'; end if;
  if p_registration_deadline >= p_start_time then raise exception 'Registration deadline must be before start time'; end if;

  insert into public.tournaments(
    name,title,status,created_by,subject,mode,max_participants,max_players,current_players,
    questions_count,question_count,questions_per_match,start_time,starts_at,registration_deadline,
    entry_fee,entry_fee_coins,entry_cost,settings,prize_coins,end_time,ends_at,updated_at
  ) values (
    p_name,p_name,'waiting',v_uid,p_subject,lower(p_mode),p_max_players,p_max_players,0,
    p_questions_per_match,p_questions_per_match,p_questions_per_match,p_start_time,p_start_time,p_registration_deadline,
    greatest(p_entry_fee,0),greatest(p_entry_fee,0),greatest(p_entry_fee,0),
    jsonb_build_object('mode',lower(p_mode),'subject',p_subject,'max_players',p_max_players,'questions_per_match',p_questions_per_match),
    1500,p_start_time + interval '2 hours',p_start_time + interval '2 hours',now()
  )
  returning * into v_t;

  return v_t;
end;
$$;

create or replace function public.join_tournament(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_t public.tournaments%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_t from public.tournaments where id=p_tournament_id for update;
  if not found then raise exception 'Tournament not found'; end if;
  if v_t.registration_deadline is not null and now() > v_t.registration_deadline then raise exception 'Registration deadline has passed'; end if;
  if v_t.status not in ('waiting','upcoming','starting') then raise exception 'Tournament is not open'; end if;
  if exists(select 1 from public.tournament_players where tournament_id=p_tournament_id and user_id=v_uid) then raise exception 'Already joined this tournament'; end if;
  if coalesce(v_t.current_players,0) >= coalesce(v_t.max_players,v_t.max_participants,0) then raise exception 'Tournament is full'; end if;

  insert into public.tournament_players(tournament_id,user_id,status,join_status)
  values(p_tournament_id,v_uid,'active','active');

  perform public.recount_tournament_players(p_tournament_id);
  return jsonb_build_object('ok',true,'tournament_id',p_tournament_id);
end;
$$;

create or replace function public.auto_start_due_tournaments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_started integer := 0; v record; v_count integer;
begin
  for v in
    select id from public.tournaments
    where status in ('waiting','upcoming','starting')
      and coalesce(starts_at,start_time) is not null
      and now() >= coalesce(starts_at,start_time)
  loop
    select count(*) into v_count from public.tournament_players where tournament_id=v.id and status='active';
    if v_count >= 2 then
      update public.tournaments set status='active', updated_at=now() where id=v.id;
      v_started := v_started + 1;
    end if;
  end loop;
  return v_started;
end;
$$;

revoke all on function public.create_tournament_workflow(text,text,text,integer,integer,timestamptz,timestamptz,integer) from public,anon;
revoke all on function public.join_tournament(uuid) from public,anon;
revoke all on function public.auto_start_due_tournaments() from public,anon;
grant execute on function public.create_tournament_workflow(text,text,text,integer,integer,timestamptz,timestamptz,integer) to authenticated;
grant execute on function public.join_tournament(uuid) to authenticated;
grant execute on function public.auto_start_due_tournaments() to authenticated;
