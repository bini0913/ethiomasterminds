-- Correct the SECURITY DEFINER search_path values installed by the initial
-- multiplayer hardening migration. A quoted comma-separated value is parsed as
-- one schema name; use an actual schema list instead.
do $$
declare
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
      and left(p.proname, 12) = 'multiplayer_'
  loop
    execute format('alter function %s set search_path = pg_catalog, auth', v_fn.signature);
  end loop;
end;
$$;

alter function public.cleanup_expired_multiplayer_rooms()
  set search_path = pg_catalog, auth;
