-- Follow challenge system backing table for profile challenge actions

create table if not exists public.follow_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  challenged_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint follow_challenges_no_self check (challenger_id <> challenged_id)
);

create index if not exists idx_follow_challenges_challenged on public.follow_challenges(challenged_id, created_at desc);
create index if not exists idx_follow_challenges_challenger on public.follow_challenges(challenger_id, created_at desc);

alter table public.follow_challenges enable row level security;

create policy "Users can read their own challenges"
on public.follow_challenges for select
using (auth.uid() = challenger_id or auth.uid() = challenged_id);

create policy "Users can create challenges"
on public.follow_challenges for insert
with check (auth.uid() = challenger_id);

create policy "Users can update challenge state"
on public.follow_challenges for update
using (auth.uid() = challenger_id or auth.uid() = challenged_id)
with check (auth.uid() = challenger_id or auth.uid() = challenged_id);

create or replace function public.touch_follow_challenges_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  if new.status <> old.status and new.status in ('accepted', 'declined', 'completed', 'cancelled') then
    new.resolved_at = coalesce(new.resolved_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists follow_challenges_touch_updated_at on public.follow_challenges;
create trigger follow_challenges_touch_updated_at
before update on public.follow_challenges
for each row execute function public.touch_follow_challenges_updated_at();

alter publication supabase_realtime add table if not exists public.follow_challenges;
