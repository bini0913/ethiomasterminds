-- Keep chat group membership policies from recursively querying each other.
-- Functions check only the authenticated user's membership/ownership.

create or replace function public.is_chat_group_creator(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.chat_groups g
    where g.id = p_group_id
      and g.created_by = (select auth.uid())
  );
$function$;

revoke all on function public.is_chat_group_creator(uuid) from public;
grant execute on function public.is_chat_group_creator(uuid) to authenticated;

drop policy if exists "group admin manages members" on public.chat_group_members;
create policy "group admin manages members"
on public.chat_group_members
for all
to authenticated
using (user_id = (select auth.uid()) or public.is_chat_group_creator(group_id))
with check (user_id = (select auth.uid()) or public.is_chat_group_creator(group_id));

drop policy if exists "members can view group" on public.chat_groups;
create policy "members can view group"
on public.chat_groups
for select
to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.chat_group_members m
    where m.group_id = chat_groups.id
      and m.user_id = (select auth.uid())
  )
);
