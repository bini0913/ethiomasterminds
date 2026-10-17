-- Allow the creator to read their newly-created room before their participant row exists.
-- This is required for INSERT ... RETURNING (PostgREST .insert().select()).
-- Access remains limited to the authenticated room creator; participants retain their existing policy.
drop policy if exists "users can view own created study call rooms" on public.study_call_rooms;
create policy "users can view own created study call rooms"
on public.study_call_rooms
for select to authenticated
using (created_by = auth.uid());
