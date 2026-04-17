-- Multiplayer knockout tournament system
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'completed', 'cancelled')),
  format text not null default 'knockout' check (format in ('knockout', 'timed', 'daily')),
  max_players integer not null check (max_players in (8, 16, 32)),
  current_players integer not null default 0,
  entry_type text not null default 'free' check (entry_type in ('free', 'coins')),
  entry_cost integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  champion_user_id uuid references public.profiles(id),
  runner_up_user_id uuid references public.profiles(id),
  reward_winner_coins integer not null default 1500,
  reward_winner_xp integer not null default 800,
  reward_runner_up_coins integer not null default 600,
  reward_runner_up_xp integer not null default 300,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  join_status text not null default 'joined' check (join_status in ('joined', 'ready', 'active', 'eliminated', 'champion', 'runner_up')),
  seed integer,
  eliminated_round integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round integer not null check (round >= 1),
  bracket_position integer not null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'live', 'finished')),
  player1_id uuid references public.profiles(id),
  player2_id uuid references public.profiles(id),
  winner_id uuid references public.profiles(id),
  subject text,
  mode text,
  question_set_id text,
  room_code text,
  starts_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, round, bracket_position)
);

create index if not exists idx_tournaments_status on public.tournaments(status);
create index if not exists idx_tournament_players_tournament on public.tournament_players(tournament_id);
create index if not exists idx_tournament_matches_tournament_round on public.tournament_matches(tournament_id, round);

alter table public.tournaments enable row level security;
alter table public.tournament_players enable row level security;
alter table public.tournament_matches enable row level security;

create policy "Tournament data is readable by authenticated users"
  on public.tournaments
  for select
  using (auth.uid() is not null);

create policy "Tournament player data is readable by authenticated users"
  on public.tournament_players
  for select
  using (auth.uid() is not null);

create policy "Tournament match data is readable by authenticated users"
  on public.tournament_matches
  for select
  using (auth.uid() is not null);

create or replace function public.set_tournament_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_tournaments_updated_at
before update on public.tournaments
for each row
execute function public.set_tournament_updated_at();

create trigger trg_tournament_players_updated_at
before update on public.tournament_players
for each row
execute function public.set_tournament_updated_at();

create trigger trg_tournament_matches_updated_at
before update on public.tournament_matches
for each row
execute function public.set_tournament_updated_at();
