-- Multiplayer production hardening
-- Applied to the production Supabase project as part of the multiplayer reliability fix.
-- Keep this migration in source control so a future environment reproduces the same schema/publication state.

alter table public.room_players
  add column if not exists question_started_at timestamptz;

do $$
declare t text;
begin
  foreach t in array array[
    'multiplayer_rooms',
    'room_players',
    'room_state',
    'room_chat_messages',
    'multiplayer_match_results',
    'multiplayer_invites',
    'user_presence'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
