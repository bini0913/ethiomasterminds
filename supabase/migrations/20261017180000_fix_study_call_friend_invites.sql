-- Repair the study-call friend check: unqualified user_id resolved to the friends table.
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
