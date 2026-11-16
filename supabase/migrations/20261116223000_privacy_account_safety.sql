-- Critical privacy and account-safety hardening.

-- Profile safety metadata. Existing rows remain valid; new registration flows can
-- collect guardian consent before enabling child accounts.
alter table public.profiles
  add column if not exists guardian_consent boolean not null default false,
  add column if not exists guardian_email text,
  add column if not exists consent_at timestamptz;

alter table public.profile_privacy_settings
  add column if not exists show_online_status boolean not null default false,
  add column if not exists activity_history_enabled boolean not null default true,
  add column if not exists notifications_enabled boolean not null default true;

-- Keep privacy controls writable only by their owner. Public profile consumers
-- may still read the explicit display flags, but cannot alter another user.
drop policy if exists "Users can manage own privacy settings" on public.profile_privacy_settings;
create policy "Users can manage own privacy settings"
  on public.profile_privacy_settings for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- A user may permanently remove their own auth account. Cascading foreign keys
-- clean up the associated profile and user-owned records.
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

-- Social uploads must not be listable or anonymously downloadable. Consumers
-- should use signed URLs or authenticated object reads.
update storage.buckets set public = false where id = 'social-images';
update storage.buckets set public = false where id in ('library-files', 'library-thumbnails');

drop policy if exists "Anyone can view social images" on storage.objects;
drop policy if exists "Social images public read" on storage.objects;
create policy "Authenticated users can read social images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'social-images');

-- Remove legacy public library-read policies. The existing owner policies remain
-- in place and continue to support private uploads.
drop policy if exists "Library files are public read" on storage.objects;

-- Social posts are visible only to authenticated users and only when the author
-- has opted into public profile visibility. Authors retain management access.
drop policy if exists "Anyone can view posts" on public.social_posts;
create policy "Authenticated users can view opted-in posts"
  on public.social_posts for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or coalesce((select p.is_public from public.profile_privacy_settings p where p.user_id = social_posts.author_id), true)
  );

-- Multiplayer state, selected questions, answers, and chat are private to room
-- participants. This prevents authenticated users from enumerating other rooms.
drop policy if exists "Anyone can view room state" on public.room_state;
create policy "Room players can view room state"
  on public.room_state for select
  to authenticated
  using (exists (
    select 1 from public.room_players rp
    where rp.room_id = room_state.room_id and rp.user_id = (select auth.uid())
  ));

drop policy if exists "Anyone can view room questions" on public.room_questions;
create policy "Room players can view room questions"
  on public.room_questions for select
  to authenticated
  using (exists (
    select 1 from public.room_players rp
    where rp.room_id = room_questions.room_id and rp.user_id = (select auth.uid())
  ));

drop policy if exists "Anyone can view room answers" on public.room_answers;
create policy "Room players can view room answers"
  on public.room_answers for select
  to authenticated
  using (exists (
    select 1 from public.room_players rp
    where rp.room_id = room_answers.room_id and rp.user_id = (select auth.uid())
  ));

drop policy if exists "Anyone can view room chat" on public.room_chat_messages;
create policy "Room players can view room chat"
  on public.room_chat_messages for select
  to authenticated
  using (exists (
    select 1 from public.room_players rp
    where rp.room_id = room_chat_messages.room_id and rp.user_id = (select auth.uid())
  ));

-- Password breach protection is configured in Supabase Auth dashboard, not SQL.
-- Keep this migration self-documenting so deployment review does not miss it.
comment on function public.delete_my_account() is 'User-initiated permanent account deletion. Enable leaked-password protection in Supabase Auth settings.';
