-- Competitive social system foundation for leaderboard/profile/follow features

create table if not exists public.stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  accuracy numeric(5,2) not null default 0,
  matches_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  contributions integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.followers (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint followers_unique_pair unique (follower_id, following_id),
  constraint followers_no_self_follow check (follower_id <> following_id)
);

create table if not exists public.profile_privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_public boolean not null default true,
  hide_stats boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.social_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  notification_type text not null check (notification_type in ('rank_increase', 'new_follower', 'achievement_unlocked')),
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_followers_following on public.followers(following_id, created_at desc);
create index if not exists idx_followers_follower on public.followers(follower_id, created_at desc);
create index if not exists idx_social_notifications_user on public.social_notifications(user_id, created_at desc);

alter table public.stats enable row level security;
alter table public.followers enable row level security;
alter table public.profile_privacy_settings enable row level security;
alter table public.social_notifications enable row level security;

create policy "Users can read all stats"
on public.stats for select
using (true);

create policy "Users can manage own stats"
on public.stats for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read follower graph"
on public.followers for select
using (true);

create policy "Users can follow others"
on public.followers for insert
with check (auth.uid() = follower_id);

create policy "Users can unfollow their own follows"
on public.followers for delete
using (auth.uid() = follower_id);

create policy "Users can read privacy settings"
on public.profile_privacy_settings for select
using (true);

create policy "Users can manage own privacy settings"
on public.profile_privacy_settings for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read own notifications"
on public.social_notifications for select
using (auth.uid() = user_id);

create policy "Users can create notifications"
on public.social_notifications for insert
with check (auth.uid() = actor_id);

create policy "Users can update own notifications"
on public.social_notifications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter publication supabase_realtime add table if not exists public.followers;
alter publication supabase_realtime add table if not exists public.social_notifications;
