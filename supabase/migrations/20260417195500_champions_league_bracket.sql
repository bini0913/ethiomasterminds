-- Champions League style knockout bracket (Round of 16 -> Quarterfinal -> Semifinal -> Final)
create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round integer not null check (round between 1 and 4),
  bracket_position integer not null,
  status text not null default 'pending' check (status in ('pending', 'ready', 'live', 'finished')),
  player1_id uuid references public.profiles(id) on delete set null,
  player2_id uuid references public.profiles(id) on delete set null,
  winner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, round, bracket_position)
);

create index if not exists idx_tournament_matches_tournament_round on public.tournament_matches(tournament_id, round);

alter table public.tournament_matches enable row level security;

drop policy if exists "Authenticated users can view tournament matches" on public.tournament_matches;
create policy "Authenticated users can view tournament matches"
  on public.tournament_matches
  for select
  using (auth.uid() is not null);

create policy "Managers and admins can manage tournament matches"
  on public.tournament_matches
  for all
  using (public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'admin'));

create or replace function public.set_tournament_matches_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tournament_matches_updated_at on public.tournament_matches;
create trigger trg_tournament_matches_updated_at
before update on public.tournament_matches
for each row
execute function public.set_tournament_matches_updated_at();
