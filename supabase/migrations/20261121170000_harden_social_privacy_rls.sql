-- Social privacy hardening.
-- Permissive RLS policies are OR-combined, so legacy USING (true) policies
-- must be removed before privacy-aware visibility can be enforced.

-- Posts are visible to authenticated users only when the author is the current
-- user or has opted into public profile visibility.
drop policy if exists "Anyone can view posts" on public.social_posts;
drop policy if exists "authenticated can view posts" on public.social_posts;
drop policy if exists "Authenticated users can view opted-in posts" on public.social_posts;
create policy "Authenticated users can view opted-in posts"
  on public.social_posts
  for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or coalesce(
      (select p.is_public
       from public.profile_privacy_settings p
       where p.user_id = social_posts.author_id),
      true
    )
  );

-- Engagement rows inherit the visibility of their parent post. This prevents
-- private-post comments, likes, reactions, and bookmarks from being queried
-- directly by another authenticated user.
drop policy if exists "Anyone can view likes" on public.social_post_likes;
drop policy if exists "Users can view all likes" on public.social_post_likes;
drop policy if exists "authenticated can view" on public.social_post_likes;
drop policy if exists "insert own rows" on public.social_post_likes;
drop policy if exists "own rows manage" on public.social_post_likes;
drop policy if exists "Users can add likes" on public.social_post_likes;
drop policy if exists "Users can remove own likes" on public.social_post_likes;
drop policy if exists "Admins can delete any likes" on public.social_post_likes;
create policy "authenticated can view visible post likes"
  on public.social_post_likes for select to authenticated
  using (exists (
    select 1 from public.social_posts p
    where p.id = social_post_likes.post_id
      and (
        p.author_id = (select auth.uid())
        or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true)
      )
  ));
create policy "users can like visible posts"
  on public.social_post_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_likes.post_id
        and (
          p.author_id = (select auth.uid())
          or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true)
        )
    )
  );
create policy "users can remove own likes"
  on public.social_post_likes for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "admins can delete any likes"
  on public.social_post_likes for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) or has_role((select auth.uid()), 'manager'::app_role));

drop policy if exists "Users can view all reactions" on public.social_post_reactions;
drop policy if exists "authenticated can view" on public.social_post_reactions;
drop policy if exists "insert own rows" on public.social_post_reactions;
drop policy if exists "own rows manage" on public.social_post_reactions;
drop policy if exists "Users can add reactions" on public.social_post_reactions;
drop policy if exists "Users can remove own reactions" on public.social_post_reactions;
drop policy if exists "Admins can delete any reactions" on public.social_post_reactions;
create policy "authenticated can view visible post reactions"
  on public.social_post_reactions for select to authenticated
  using (exists (
    select 1 from public.social_posts p
    where p.id = social_post_reactions.post_id
      and (
        p.author_id = (select auth.uid())
        or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true)
      )
  ));
create policy "users can react to visible posts"
  on public.social_post_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_reactions.post_id
        and (
          p.author_id = (select auth.uid())
          or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true)
        )
    )
  );
create policy "users can remove own reactions"
  on public.social_post_reactions for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "admins can delete any reactions"
  on public.social_post_reactions for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) or has_role((select auth.uid()), 'manager'::app_role));

drop policy if exists "Anyone can view comments" on public.social_post_comments;
drop policy if exists "authenticated can view" on public.social_post_comments;
drop policy if exists "insert own rows" on public.social_post_comments;
drop policy if exists "own rows manage" on public.social_post_comments;
drop policy if exists "Users can create comments" on public.social_post_comments;
drop policy if exists "Users can delete own comments" on public.social_post_comments;
drop policy if exists "Admins can delete any comments" on public.social_post_comments;
create policy "authenticated can view visible post comments"
  on public.social_post_comments for select to authenticated
  using (exists (
    select 1 from public.social_posts p
    where p.id = social_post_comments.post_id
      and (
        p.author_id = (select auth.uid())
        or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true)
      )
  ));
create policy "users can comment on visible posts"
  on public.social_post_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.social_posts p
      where p.id = social_post_comments.post_id
        and (
          p.author_id = (select auth.uid())
          or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true)
        )
    )
  );
create policy "users can update own comments"
  on public.social_post_comments for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "users can delete own comments"
  on public.social_post_comments for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "admins can delete any comments"
  on public.social_post_comments for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) or has_role((select auth.uid()), 'manager'::app_role));

drop policy if exists "authenticated can view" on public.saved_posts;
drop policy if exists "own rows manage" on public.saved_posts;
drop policy if exists "Users can view own saved posts" on public.saved_posts;
drop policy if exists "Users can save posts" on public.saved_posts;
drop policy if exists "Users can unsave posts" on public.saved_posts;
drop policy if exists "Admins can delete any saved posts" on public.saved_posts;
create policy "users can view own saved posts"
  on public.saved_posts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "users can save visible posts"
  on public.saved_posts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.social_posts p
      where p.id = saved_posts.post_id
        and (
          p.author_id = (select auth.uid())
          or coalesce((select s.is_public from public.profile_privacy_settings s where s.user_id = p.author_id), true)
        )
    )
  );
create policy "users can unsave own posts"
  on public.saved_posts for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "admins can delete any saved posts"
  on public.saved_posts for delete to authenticated
  using (has_role((select auth.uid()), 'admin'::app_role) or has_role((select auth.uid()), 'manager'::app_role));

-- Keep authenticated feed actions working while removing unused anonymous
-- privileges from these user-generated tables.
revoke all on table public.social_posts, public.social_post_likes,
  public.social_post_comments, public.social_post_reactions, public.saved_posts
from anon;
grant select, insert, update, delete on table public.social_posts to authenticated;
grant select, insert, delete on table public.social_post_likes to authenticated;
grant select, insert, delete on table public.social_post_reactions to authenticated;
grant select, insert, update, delete on table public.social_post_comments to authenticated;
grant select, insert, delete on table public.saved_posts to authenticated;
