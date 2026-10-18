-- Period-based Study Mode leaderboard, aggregated server-side so students never need direct access
-- to other students' private study-session rows.

create or replace function public.get_study_period_leaderboard(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_limit integer default 50
)
returns table (
  user_id uuid,
  name text,
  total_minutes bigint,
  focus_sessions bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'A valid leaderboard date range is required';
  end if;

  if p_end_at > now() + interval '5 minutes' then
    raise exception 'Leaderboard end time cannot be in the future';
  end if;

  return query
  with totals as (
    select
      ss.user_id,
      sum(greatest(coalesce(ss.duration, 0), 0))::bigint as total_minutes,
      count(*)::bigint as focus_sessions,
      max(coalesce(ss.end_time, ss.created_at)) as updated_at
    from public.study_sessions ss
    where ss.status = 'completed'
      and coalesce(ss.end_time, ss.created_at) >= p_start_at
      and coalesce(ss.end_time, ss.created_at) < p_end_at
      and coalesce(ss.type, 'focus') <> 'break'
      and coalesce(ss.duration, 0) > 0
    group by ss.user_id
  )
  select
    t.user_id,
    coalesce(nullif(trim(p.name), ''), nullif(trim(p.username), ''), 'Student') as name,
    t.total_minutes,
    t.focus_sessions,
    t.updated_at
  from totals t
  left join public.profiles p on p.id = t.user_id
  order by t.total_minutes desc, t.focus_sessions desc, t.updated_at asc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

revoke all on function public.get_study_period_leaderboard(timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.get_study_period_leaderboard(timestamptz, timestamptz, integer) to authenticated;
