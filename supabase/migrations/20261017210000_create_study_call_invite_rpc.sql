-- Atomically create a study call room and invite an accepted friend.
-- Security-definer avoids a client-side multi-insert race and keeps all relationship checks server-side.
create or replace function public.create_study_call_invite(_friend_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  new_room_id uuid;
begin
  if caller_id is null then
    raise exception 'Sign in required' using errcode = '28000';
  end if;
  if _friend_id is null or _friend_id = caller_id then
    raise exception 'Choose a different friend';
  end if;
  if not exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and ((f.user_id = caller_id and f.friend_id = _friend_id)
        or (f.friend_id = caller_id and f.user_id = _friend_id))
  ) then
    raise exception 'You can only call an accepted friend';
  end if;

  insert into public.study_call_rooms (created_by)
  values (caller_id)
  returning id into new_room_id;

  insert into public.study_call_participants
    (room_id, user_id, invited_by, status, responded_at)
  values
    (new_room_id, caller_id, caller_id, 'accepted', now()),
    (new_room_id, _friend_id, caller_id, 'invited', null);

  return new_room_id;
end;
$$;

revoke all on function public.create_study_call_invite(uuid) from public, anon;
grant execute on function public.create_study_call_invite(uuid) to authenticated;
