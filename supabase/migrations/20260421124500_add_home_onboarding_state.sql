create table if not exists public.user_onboarding_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_onboarding_states enable row level security;

create policy "Users can view their own onboarding state"
  on public.user_onboarding_states
  for select
  using (auth.uid() = user_id);

create policy "Users can upsert their own onboarding state"
  on public.user_onboarding_states
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
