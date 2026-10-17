-- Fix friend invitation membership and expose only safe live-study/display data.
drop policy if exists "users invite friends to own call" on public.study_call_participants;
create policy "users invite friends to own call" on public.study_call_participants for insert to authenticated
with check (
  invited_by = auth.uid()
  and exists (
    select 1 from public.study_call_rooms r
    where r.id = study_call_participants.room_id and r.created_by = auth.uid()
  )
  and (
    study_call_participants.user_id = auth.uid()
    or exists (
      select 1 from public.friends f
      where f.status = 'accepted'
        and (
          (f.user_id = auth.uid() and f.friend_id = study_call_participants.user_id)
          or (f.friend_id = auth.uid() and f.user_id = study_call_participants.user_id)
        )
    )
  )
);

-- Students may see who is actively studying, but may only change their own status.
drop policy if exists "authenticated can view study presence" on public.study_live_status;
create policy "authenticated can view study presence"
on public.study_live_status for select to authenticated using (true);

-- Profile RLS intentionally hides other users' full profile rows. Return only display-safe
-- fields, and only for self or users with an existing friendship/request relationship.
create or replace function public.get_friend_profiles(_user_ids uuid[])
returns table (id uuid, name text, username text, avatar text, level integer, xp integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.username, p.avatar, p.level, p.xp
  from public.profiles p
  where p.id = any(coalesce(_user_ids, array[]::uuid[]))
    and (
      p.id = auth.uid()
      or exists (
        select 1 from public.friends f
        where f.status in ('accepted', 'pending')
          and (
            (f.user_id = auth.uid() and f.friend_id = p.id)
            or (f.friend_id = auth.uid() and f.user_id = p.id)
          )
      )
    );
$$;
revoke all on function public.get_friend_profiles(uuid[]) from public, anon;
grant execute on function public.get_friend_profiles(uuid[]) to authenticated;
