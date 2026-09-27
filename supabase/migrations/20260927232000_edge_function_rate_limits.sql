-- Lightweight per-user Edge Function rate limits for paid/expensive AI operations.
create table if not exists public.edge_rate_limits (
  user_id uuid not null,
  function_name text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, function_name)
);

alter table public.edge_rate_limits enable row level security;
revoke all on table public.edge_rate_limits from public, anon, authenticated;
grant all on table public.edge_rate_limits to service_role;

create or replace function public.consume_edge_rate_limit(
  p_function_name text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.edge_rate_limits%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_function_name is null or length(trim(p_function_name)) = 0 then
    raise exception 'Function name is required';
  end if;
  if p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit configuration';
  end if;

  select * into v_row
  from public.edge_rate_limits
  where user_id=v_uid and function_name=trim(p_function_name)
  for update;

  if not found then
    insert into public.edge_rate_limits(user_id,function_name,window_started_at,request_count)
    values(v_uid,trim(p_function_name),now(),1);
    return true;
  end if;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= now() then
    update public.edge_rate_limits
       set window_started_at=now(), request_count=1
     where user_id=v_uid and function_name=trim(p_function_name);
    return true;
  end if;

  if v_row.request_count >= p_limit then
    return false;
  end if;

  update public.edge_rate_limits
     set request_count=request_count+1
   where user_id=v_uid and function_name=trim(p_function_name);
  return true;
end;
$$;

revoke execute on function public.consume_edge_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_edge_rate_limit(text, integer, integer) to authenticated;
