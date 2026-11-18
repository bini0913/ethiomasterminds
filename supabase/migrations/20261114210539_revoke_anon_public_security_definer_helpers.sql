-- These RPCs are used only by authenticated student routes and chat policy checks.
-- Remove the default PUBLIC/anon execution path while preserving signed-in and server access.
--
-- Some deployments contain these helper RPCs from out-of-band historical fixes.
-- Harden each exact signature when present, but do not make a clean migration
-- replay depend on optional functions that are not created by this repository.

do $migration$
declare
  v_signature text;
  v_function regprocedure;
  v_signatures text[] := array[
    'public.get_early_leaderboard(text, text, text)',
    'public.get_public_leaderboard(integer)',
    'public.is_chat_group_creator(uuid)',
    'public.is_chat_group_member(uuid)'
  ];
begin
  foreach v_signature in array v_signatures loop
    v_function := to_regprocedure(v_signature);
    if v_function is not null then
      execute format('revoke all on function %s from public, anon', v_function);
      execute format('grant execute on function %s to authenticated, service_role', v_function);
    end if;
  end loop;
end
$migration$;
