-- Require acceptance of the current Community Guidelines before any user-generated
-- social content or chat message can be created. This is enforced in Postgres so
-- clients cannot bypass the acceptance screen.

create table if not exists public.user_policy_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_key text not null,
  policy_version text not null,
  accepted_at timestamptz not null default now(),
  constraint user_policy_acceptances_pkey primary key (user_id, policy_key, policy_version),
  constraint user_policy_acceptances_supported_policy check (policy_key = 'community_guidelines')
);

alter table public.user_policy_acceptances enable row level security;
revoke all on public.user_policy_acceptances from anon, authenticated;
grant select, insert on public.user_policy_acceptances to authenticated;

drop policy if exists "Users can view own policy acceptances" on public.user_policy_acceptances;
create policy "Users can view own policy acceptances"
  on public.user_policy_acceptances for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can accept current community guidelines" on public.user_policy_acceptances;
create policy "Users can accept current community guidelines"
  on public.user_policy_acceptances for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and policy_key = 'community_guidelines'
    and policy_version = '2026-11-24-v1'
  );

create or replace function app_private.require_community_guidelines_acceptance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_content_owner uuid;
  v_jwt_role text := current_setting('request.jwt.claim.role', true);
begin
  -- Allow trusted server-side maintenance jobs, but never anonymous clients.
  if v_uid is null then
    if v_jwt_role = 'service_role' then
      return new;
    end if;
    raise exception using errcode = '42501', message = 'Sign in and accept the Community Guidelines before posting or messaging';
  end if;

  if tg_table_name = 'social_posts' then
    v_content_owner := new.author_id;
  elsif tg_table_name in ('social_post_comments', 'lobby_messages', 'room_chat_messages') then
    v_content_owner := new.user_id;
  elsif tg_table_name = 'messages' then
    v_content_owner := new.sender_id;
  elsif tg_table_name = 'group_messages' then
    v_content_owner := new.sender_id;
  else
    return new;
  end if;

  if v_content_owner <> v_uid then
    raise exception using errcode = '42501', message = 'You can only create content as your signed-in account';
  end if;

  if not exists (
    select 1
    from public.user_policy_acceptances a
    where a.user_id = v_uid
      and a.policy_key = 'community_guidelines'
      and a.policy_version = '2026-11-24-v1'
  ) then
    raise exception using
      errcode = '42501',
      message = 'Please review and accept the current Master Minds Community Guidelines before posting or messaging';
  end if;

  return new;
end;
$function$;

revoke all on function app_private.require_community_guidelines_acceptance() from public, anon, authenticated;

drop trigger if exists require_guidelines_for_social_posts on public.social_posts;
create trigger require_guidelines_for_social_posts
  before insert on public.social_posts
  for each row execute function app_private.require_community_guidelines_acceptance();

drop trigger if exists require_guidelines_for_social_comments on public.social_post_comments;
create trigger require_guidelines_for_social_comments
  before insert on public.social_post_comments
  for each row execute function app_private.require_community_guidelines_acceptance();

drop trigger if exists require_guidelines_for_direct_messages on public.messages;
create trigger require_guidelines_for_direct_messages
  before insert on public.messages
  for each row execute function app_private.require_community_guidelines_acceptance();

drop trigger if exists require_guidelines_for_group_messages on public.group_messages;
create trigger require_guidelines_for_group_messages
  before insert on public.group_messages
  for each row execute function app_private.require_community_guidelines_acceptance();

drop trigger if exists require_guidelines_for_lobby_messages on public.lobby_messages;
create trigger require_guidelines_for_lobby_messages
  before insert on public.lobby_messages
  for each row execute function app_private.require_community_guidelines_acceptance();

drop trigger if exists require_guidelines_for_room_chat on public.room_chat_messages;
create trigger require_guidelines_for_room_chat
  before insert on public.room_chat_messages
  for each row execute function app_private.require_community_guidelines_acceptance();
