-- Reconcile the approved privacy hardening against the live production baseline.
-- The live project was created from a squashed baseline that omitted the
-- profile_privacy_settings table even though the repository migration history
-- contains it. This migration is safe for both states.

create table if not exists public.profile_privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_public boolean not null default true,
  hide_stats boolean not null default false,
  show_online_status boolean not null default false,
  activity_history_enabled boolean not null default true,
  notifications_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.profile_privacy_settings enable row level security;

drop policy if exists "Users can read privacy settings" on public.profile_privacy_settings;
create policy "Users can read privacy settings"
  on public.profile_privacy_settings for select
  to authenticated
  using (true);

drop policy if exists "Users can manage own privacy settings" on public.profile_privacy_settings;
create policy "Users can manage own privacy settings"
  on public.profile_privacy_settings for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.profiles
  add column if not exists guardian_consent boolean not null default false,
  add column if not exists guardian_email text,
  add column if not exists consent_at timestamptz;

alter table public.profile_privacy_settings
  add column if not exists show_online_status boolean not null default false,
  add column if not exists activity_history_enabled boolean not null default true,
  add column if not exists notifications_enabled boolean not null default true;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

update storage.buckets set public = false where id = 'social-images';
update storage.buckets set public = false where id in ('library-files', 'library-thumbnails');

drop policy if exists "Anyone can view social images" on storage.objects;
drop policy if exists "Social images public read" on storage.objects;
drop policy if exists "Authenticated users can read social images" on storage.objects;
create policy "Authenticated users can read social images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'social-images');

drop policy if exists "Library files are public read" on storage.objects;

drop policy if exists "Anyone can view posts" on public.social_posts;
drop policy if exists "Authenticated users can view opted-in posts" on public.social_posts;
create policy "Authenticated users can view opted-in posts"
  on public.social_posts for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or coalesce((select p.is_public from public.profile_privacy_settings p where p.user_id = social_posts.author_id), true)
  );

drop policy if exists "Anyone can view room state" on public.room_state;
drop policy if exists "Room players can view room state" on public.room_state;
create policy "Room players can view room state"
  on public.room_state for select
  to authenticated
  using (exists (
    select 1 from public.room_players rp
    where rp.room_id = room_state.room_id and rp.user_id = (select auth.uid())
  ));

drop policy if exists "Anyone can view room questions" on public.room_questions;
drop policy if exists "Room players can view room questions" on public.room_questions;
create policy "Room players can view room questions"
  on public.room_questions for select
  to authenticated
  using (exists (
    select 1 from public.room_players rp
    where rp.room_id = room_questions.room_id and rp.user_id = (select auth.uid())
  ));

drop policy if exists "Anyone can view room answers" on public.room_answers;
drop policy if exists "Room players can view room answers" on public.room_answers;
create policy "Room players can view room answers"
  on public.room_answers for select
  to authenticated
  using (exists (
    select 1 from public.room_players rp
    where rp.room_id = room_answers.room_id and rp.user_id = (select auth.uid())
  ));

drop policy if exists "Anyone can view room chat" on public.room_chat_messages;
drop policy if exists "Room players can view room chat" on public.room_chat_messages;
create policy "Room players can view room chat"
  on public.room_chat_messages for select
  to authenticated
  using (exists (
    select 1 from public.room_players rp
    where rp.room_id = room_chat_messages.room_id and rp.user_id = (select auth.uid())
  ));

comment on function public.delete_my_account() is 'User-initiated permanent account deletion. Enable leaked-password protection in Supabase Auth settings.';
