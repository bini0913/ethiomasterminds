-- User blocking controls for direct social interactions.
-- Keep the block list private to the account that created each block.

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_pkey primary key (blocker_id, blocked_user_id),
  constraint user_blocks_no_self check (blocker_id <> blocked_user_id)
);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

drop policy if exists "Users can view their own blocks" on public.user_blocks;
create policy "Users can view their own blocks"
  on public.user_blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);

drop policy if exists "Users can create their own blocks" on public.user_blocks;
create policy "Users can create their own blocks"
  on public.user_blocks for insert to authenticated
  with check (
    (select auth.uid()) = blocker_id
    and blocked_user_id <> (select auth.uid())
  );

drop policy if exists "Users can remove their own blocks" on public.user_blocks;
create policy "Users can remove their own blocks"
  on public.user_blocks for delete to authenticated
  using ((select auth.uid()) = blocker_id);

create or replace function app_private.is_user_blocked(p_user_a uuid, p_user_b uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_user_a is null or p_user_b is null then
    return false;
  end if;

  -- This helper is only useful to a participant in the pair. It must not
  -- become a way to probe whether two unrelated accounts have blocked each other.
  if v_uid <> p_user_a and v_uid <> p_user_b then
    return false;
  end if;

  return exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = p_user_a and b.blocked_user_id = p_user_b)
       or (b.blocker_id = p_user_b and b.blocked_user_id = p_user_a)
  );
end;
$function$;

revoke all on function app_private.is_user_blocked(uuid, uuid) from public, anon;
grant execute on function app_private.is_user_blocked(uuid, uuid) to authenticated;

create or replace function app_private.reject_blocked_social_interaction()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_first_user uuid;
  v_second_user uuid;
begin
  if tg_table_name = 'friends' then
    v_first_user := new.user_id;
    v_second_user := new.friend_id;
  elsif tg_table_name = 'messages' then
    v_first_user := new.sender_id;
    v_second_user := new.receiver_id;
  elsif tg_table_name = 'multiplayer_invites' then
    v_first_user := new.sender_id;
    v_second_user := new.receiver_id;
  elsif tg_table_name = 'study_call_participants' then
    v_first_user := new.invited_by;
    v_second_user := new.user_id;
  elsif tg_table_name = 'followers' then
    v_first_user := new.follower_id;
    v_second_user := new.following_id;
  elsif tg_table_name in ('social_post_comments', 'social_post_likes', 'social_post_reactions', 'saved_posts') then
    v_first_user := new.user_id;
    select p.author_id into v_second_user
    from public.social_posts p
    where p.id = new.post_id;
    if v_second_user is null then
      return new;
    end if;
  else
    return new;
  end if;

  if app_private.is_user_blocked(v_first_user, v_second_user) then
    raise exception using
      errcode = '42501',
      message = 'This interaction is unavailable because one of the users has blocked the other';
  end if;

  return new;
end;
$function$;

revoke all on function app_private.reject_blocked_social_interaction() from public, anon, authenticated;

drop trigger if exists reject_blocked_friend_interaction on public.friends;
create trigger reject_blocked_friend_interaction
  before insert or update of user_id, friend_id on public.friends
  for each row execute function app_private.reject_blocked_social_interaction();

drop trigger if exists reject_blocked_direct_message on public.messages;
create trigger reject_blocked_direct_message
  before insert on public.messages
  for each row execute function app_private.reject_blocked_social_interaction();

drop trigger if exists reject_blocked_multiplayer_invite on public.multiplayer_invites;
create trigger reject_blocked_multiplayer_invite
  before insert on public.multiplayer_invites
  for each row execute function app_private.reject_blocked_social_interaction();

drop trigger if exists reject_blocked_study_call_invite on public.study_call_participants;
create trigger reject_blocked_study_call_invite
  before insert on public.study_call_participants
  for each row execute function app_private.reject_blocked_social_interaction();

create or replace function app_private.cleanup_blocked_friendship()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  delete from public.friends f
  where (f.user_id = new.blocker_id and f.friend_id = new.blocked_user_id)
     or (f.user_id = new.blocked_user_id and f.friend_id = new.blocker_id);

  delete from public.followers f
  where (f.follower_id = new.blocker_id and f.following_id = new.blocked_user_id)
     or (f.follower_id = new.blocked_user_id and f.following_id = new.blocker_id);
  return new;
end;
$function$;

revoke all on function app_private.cleanup_blocked_friendship() from public, anon, authenticated;

drop trigger if exists remove_friendship_when_blocked on public.user_blocks;
create trigger remove_friendship_when_blocked
  after insert on public.user_blocks
  for each row execute function app_private.cleanup_blocked_friendship();

-- Remove permissive ALL policy so blocked friendship rows cannot leak through
-- its SELECT branch. Friend writes continue through the existing security-definer RPCs.
drop policy if exists "user manages own friend request" on public.friends;
drop policy if exists "involved users can view" on public.friends;
create policy "involved users can view unblocked friendships"
  on public.friends for select to authenticated
  using (
    (user_id = (select auth.uid()) or friend_id = (select auth.uid()))
    and not app_private.is_user_blocked(user_id, friend_id)
  );

drop policy if exists "involved users can view messages" on public.messages;
create policy "involved users can view unblocked messages"
  on public.messages for select to authenticated
  using (
    (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()))
    and not app_private.is_user_blocked(sender_id, receiver_id)
  );

drop policy if exists "members can view group messages" on public.group_messages;
create policy "members can view group messages excluding blocked senders"
  on public.group_messages for select to authenticated
  using (
    exists (
      select 1 from public.chat_group_members m
      where m.group_id = group_messages.group_id
        and m.user_id = (select auth.uid())
    )
    and not app_private.is_user_blocked(sender_id, (select auth.uid()))
  );

create index if not exists user_blocks_blocked_user_idx
  on public.user_blocks (blocked_user_id, blocker_id);

-- Extend blocking to public social content and follower relationships.
drop trigger if exists reject_blocked_follow on public.followers;
create trigger reject_blocked_follow
  before insert or update of follower_id, following_id on public.followers
  for each row execute function app_private.reject_blocked_social_interaction();

drop trigger if exists reject_blocked_social_comment on public.social_post_comments;
create trigger reject_blocked_social_comment
  before insert or update of user_id, post_id on public.social_post_comments
  for each row execute function app_private.reject_blocked_social_interaction();

drop trigger if exists reject_blocked_social_like on public.social_post_likes;
create trigger reject_blocked_social_like
  before insert or update of user_id, post_id on public.social_post_likes
  for each row execute function app_private.reject_blocked_social_interaction();

drop trigger if exists reject_blocked_social_reaction on public.social_post_reactions;
create trigger reject_blocked_social_reaction
  before insert or update of user_id, post_id on public.social_post_reactions
  for each row execute function app_private.reject_blocked_social_interaction();

drop trigger if exists reject_blocked_saved_post on public.saved_posts;
create trigger reject_blocked_saved_post
  before insert or update of user_id, post_id on public.saved_posts
  for each row execute function app_private.reject_blocked_social_interaction();

-- Rebuild the follower policies without a permissive ALL policy that could
-- bypass the block-aware SELECT policy.
drop policy if exists "involved users can view" on public.followers;
drop policy if exists "user manages own follow" on public.followers;
create policy "users can view unblocked follows"
  on public.followers for select to authenticated
  using (
    (follower_id = (select auth.uid()) or following_id = (select auth.uid()))
    and not app_private.is_user_blocked(follower_id, following_id)
  );
create policy "users can create unblocked follows"
  on public.followers for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and not app_private.is_user_blocked(follower_id, following_id)
  );
create policy "users can update own unblocked follows"
  on public.followers for update to authenticated
  using (
    follower_id = (select auth.uid())
    and not app_private.is_user_blocked(follower_id, following_id)
  )
  with check (
    follower_id = (select auth.uid())
    and not app_private.is_user_blocked(follower_id, following_id)
  );
create policy "users can remove own follows"
  on public.followers for delete to authenticated
  using (follower_id = (select auth.uid()));

-- Split the social-post ALL policies so public feed reads can respect blocks
-- while moderator and owner write permissions remain intact.
drop policy if exists "Authenticated users can view opted-in posts" on public.social_posts;
drop policy if exists "author manages own post" on public.social_posts;
drop policy if exists "extreme admin full control social_posts" on public.social_posts;
create policy "users can view opted-in posts excluding blocked authors"
  on public.social_posts for select to authenticated
  using (
    (
      author_id = (select auth.uid())
      or coalesce((select p.is_public from public.profile_privacy_settings p where p.user_id = social_posts.author_id), true)
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
    )
    and (
      author_id = (select auth.uid())
      or has_role((select auth.uid()), 'admin'::public.app_role)
      or has_role((select auth.uid()), 'manager'::public.app_role)
      or (select public._is_extreme_admin())
      or not app_private.is_user_blocked(author_id, (select auth.uid()))
    )
  );
create policy "authors and moderators can update social posts"
  on public.social_posts for update to authenticated
  using (
    author_id = (select auth.uid())
    or has_role((select auth.uid()), 'admin'::public.app_role)
    or has_role((select auth.uid()), 'manager'::public.app_role)
    or (select public._is_extreme_admin())
  )
  with check (
    author_id = (select auth.uid())
    or has_role((select auth.uid()), 'admin'::public.app_role)
    or has_role((select auth.uid()), 'manager'::public.app_role)
    or (select public._is_extreme_admin())
  );
create policy "authors and moderators can delete social posts"
  on public.social_posts for delete to authenticated
  using (
    author_id = (select auth.uid())
    or has_role((select auth.uid()), 'admin'::public.app_role)
    or has_role((select auth.uid()), 'manager'::public.app_role)
    or (select public._is_extreme_admin())
  );

-- A blocked user's comments and reactions are hidden from the blocker as well.
drop policy if exists "authenticated can view visible post comments" on public.social_post_comments;
create policy "users can view visible comments excluding blocked authors"
  on public.social_post_comments for select to authenticated
  using (
    not app_private.is_user_blocked(user_id, (select auth.uid()))
    and exists (
      select 1
      from public.social_posts p
      where p.id = social_post_comments.post_id
        and (
          p.author_id = (select auth.uid())
          or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true)
          or has_role((select auth.uid()), 'admin'::public.app_role)
          or has_role((select auth.uid()), 'manager'::public.app_role)
          or (select public._is_extreme_admin())
        )
    )
  );

drop policy if exists "authenticated can view visible post likes" on public.social_post_likes;
create policy "users can view visible likes excluding blocked users"
  on public.social_post_likes for select to authenticated
  using (
    not app_private.is_user_blocked(user_id, (select auth.uid()))
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_likes.post_id
    )
  );

drop policy if exists "authenticated can view visible post reactions" on public.social_post_reactions;
create policy "users can view visible reactions excluding blocked users"
  on public.social_post_reactions for select to authenticated
  using (
    not app_private.is_user_blocked(user_id, (select auth.uid()))
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_reactions.post_id
    )
  );

-- Public multiplayer lobby and room chat also hide messages from accounts
-- that either side has blocked.
drop policy if exists "authenticated can view lobby" on public.lobby_messages;
create policy "authenticated can view unblocked lobby messages"
  on public.lobby_messages for select to authenticated
  using (not app_private.is_user_blocked(user_id, (select auth.uid())));

drop policy if exists "Room players can view room chat" on public.room_chat_messages;
drop policy if exists "room_chat_member_read" on public.room_chat_messages;
create policy "room members can view unblocked room chat"
  on public.room_chat_messages for select to authenticated
  using (
    is_multiplayer_room_member(room_id)
    and not app_private.is_user_blocked(user_id, (select auth.uid()))
  );
