-- Reconcile multiplayer matches that outlive a browser session or realtime
-- connection. Finishing the room fires the existing idempotent result/reward
-- trigger; no gameplay rows or historical results are deleted here.

create or replace function public.cleanup_expired_multiplayer_rooms()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, auth
as $function$
declare
  v_deleted integer := 0;
  v_finished integer := 0;
  v_delta integer := 0;
begin
  -- Speed matches have a server-owned one-minute clock. Finalize them even
  -- when every browser has closed and no client can call finish_game anymore.
  update public.multiplayer_rooms
  set status = 'finished',
      finished_at = coalesce(finished_at, clock_timestamp())
  where status = 'playing'
    and game_mode = 'speed'
    and started_at is not null
    and clock_timestamp() >= started_at + interval '1 minute';
  get diagnostics v_finished = row_count;

  -- Accuracy matches are independent per player. A player who has not sent a
  -- presence heartbeat for five minutes is treated as abandoned so another
  -- player's completed match cannot remain stuck forever. Active players keep
  -- their progress and remain in the match.
  update public.room_players rp
  set completed_at = clock_timestamp(),
      question_started_at = null
  where rp.completed_at is null
    and exists (
      select 1
      from public.multiplayer_rooms mr
      where mr.id = rp.room_id
        and mr.status = 'playing'
        and mr.game_mode = 'accuracy'
    )
    and not exists (
      select 1
      from public.user_presence up
      where up.user_id = rp.user_id
        and up.status = 'online'
        and up.last_seen > clock_timestamp() - interval '5 minutes'
    );

  -- Finalize accuracy rooms after abandoned players have been marked done.
  update public.multiplayer_rooms mr
  set status = 'finished',
      finished_at = coalesce(finished_at, clock_timestamp())
  where mr.status = 'playing'
    and mr.game_mode = 'accuracy'
    and not exists (
      select 1
      from public.room_players rp
      where rp.room_id = mr.id
        and rp.completed_at is null
    );
  get diagnostics v_delta = row_count;
  v_finished := v_finished + v_delta;

  -- Preserve the existing bounded cleanup for abandoned lobby rooms.
  with expired as (
    select id
    from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
  )
  delete from public.room_answers
  where room_id in (select id from expired);

  with expired as (
    select id
    from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
  )
  delete from public.room_questions
  where room_id in (select id from expired);

  with expired as (
    select id
    from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
  )
  delete from public.room_state
  where room_id in (select id from expired);

  with expired as (
    select id
    from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
  )
  delete from public.room_chat_messages
  where room_id in (select id from expired);

  with expired as (
    select id
    from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
  )
  delete from public.room_players
  where room_id in (select id from expired);

  with expired as (
    select id
    from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
  )
  delete from public.multiplayer_invites
  where room_id in (select id from expired);

  with deleted as (
    delete from public.multiplayer_rooms
    where status in ('waiting', 'countdown')
      and created_at <= now() - interval '1 hour'
    returning 1
  )
  select count(*) into v_deleted from deleted;

  return coalesce(v_deleted, 0) + coalesce(v_finished, 0);
end;
$function$;

-- Cleanup is maintenance-only. Never expose it to browser-authenticated users;
-- the service role invokes it from a trusted scheduler.
revoke all on function public.cleanup_expired_multiplayer_rooms() from public, anon, authenticated;
grant execute on function public.cleanup_expired_multiplayer_rooms() to service_role;
