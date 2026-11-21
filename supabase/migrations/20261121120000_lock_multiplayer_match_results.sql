-- Keep multiplayer match results server-owned.
-- Authenticated clients may read results for rooms they belong to, but must not
-- insert, update, delete, truncate, or alter result rows directly. The ranked
-- result trigger runs as its SECURITY DEFINER owner and remains functional.

revoke insert, update, delete, truncate, references, trigger
on table public.multiplayer_match_results
from anon, authenticated;

grant select
on table public.multiplayer_match_results
to authenticated;

comment on table public.multiplayer_match_results is
  'Server-owned multiplayer results. Authenticated room members may read; result rows are created and maintained only by trusted server-side processing.';
