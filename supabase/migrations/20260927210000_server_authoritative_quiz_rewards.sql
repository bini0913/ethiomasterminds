-- Make quiz reward claims server-authoritative and idempotent.

create table if not exists public.quiz_reward_claims (
  submission_id uuid primary key references public.quiz_results(submission_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  xp_awarded integer not null check (xp_awarded >= 0),
  coins_awarded integer not null check (coins_awarded >= 0),
  claimed_at timestamptz not null default now()
);

alter table public.quiz_reward_claims enable row level security;

drop policy if exists "Users can view own quiz reward claims" on public.quiz_reward_claims;
create policy "Users can view own quiz reward claims"
on public.quiz_reward_claims for select
using (auth.uid() = user_id);

create or replace function public.claim_quiz_reward(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.quiz_results%rowtype;
  v_xp integer;
  v_coins integer;
  v_level integer;
  v_new_level integer;
  v_claimed boolean := false;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  select * into r
  from public.quiz_results
  where submission_id = p_submission_id
    and student_id = uid
  for update;

  if not found then
    raise exception 'Quiz submission not found';
  end if;

  select exists(
    select 1 from public.quiz_reward_claims
    where submission_id = p_submission_id
  ) into v_claimed;

  if v_claimed then
    select xp_awarded, coins_awarded
      into v_xp, v_coins
      from public.quiz_reward_claims
     where submission_id = p_submission_id;

    select level into v_new_level from public.profiles where id = uid;

    return jsonb_build_object(
      'success', true,
      'already_claimed', true,
      'xp_awarded', v_xp,
      'coins_awarded', v_coins,
      'new_level', v_new_level
    );
  end if;

  v_xp := greatest(0, coalesce(r.xp_earned, 0));
  v_coins := 5 + floor((coalesce(r.correct_answers, 0)::numeric / greatest(r.total_questions, 1)) * 15);

  select level into v_level from public.profiles where id = uid for update;
  v_level := greatest(1, coalesce(v_level, 1));
  v_new_level := greatest(v_level, floor((coalesce((select xp from public.profiles where id = uid), 0) + v_xp) / 100)::integer + 1);

  update public.profiles
     set xp = coalesce(xp, 0) + v_xp,
         level = v_new_level
   where id = uid;

  insert into public.user_currency(user_id, coins)
  values (uid, v_coins)
  on conflict (user_id) do update
    set coins = user_currency.coins + v_coins,
        updated_at = now();

  insert into public.quiz_reward_claims(submission_id, user_id, xp_awarded, coins_awarded)
  values (p_submission_id, uid, v_xp, v_coins);

  return jsonb_build_object(
    'success', true,
    'already_claimed', false,
    'xp_awarded', v_xp,
    'coins_awarded', v_coins,
    'new_level', v_new_level
  );
end;
$$;

revoke all on function public.claim_quiz_reward(uuid) from public;
grant execute on function public.claim_quiz_reward(uuid) to authenticated;
