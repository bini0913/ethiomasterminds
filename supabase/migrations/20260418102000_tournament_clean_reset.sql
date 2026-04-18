-- Tournament clean reset: removes stale/broken records for a fresh start.
-- Product request sequence:
--   DELETE FROM tournaments;
--   DELETE FROM matches;
--   DELETE FROM tournament_players;

-- Keep operation idempotent and FK-safe by deleting child rows first.
delete from public.matches;
delete from public.tournament_matches;
delete from public.tournament_players;
delete from public.tournament_participants;
delete from public.tournament_events;
delete from public.tournaments;
