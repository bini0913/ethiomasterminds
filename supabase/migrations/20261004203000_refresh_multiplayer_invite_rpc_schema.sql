-- Keep the multiplayer invite RPC canonical and force PostgREST to
-- re-introspect it after older deployments used a different signature.

create or replace function public.create_multiplayer_invite(
  _room_id uuid,
  _receiver_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.multiplayer_invites (room_id, sender_id, receiver_id)
  values (_room_id, auth.uid(), _receiver_id)
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.create_multiplayer_invite(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
