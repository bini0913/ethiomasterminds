-- 9-tier ranking system based on user level progression

create table if not exists public.rank_config (
  rank_name text primary key,
  min_level integer not null,
  max_level integer,
  color text not null,
  badge text not null,
  glow_intensity integer not null default 1,
  check (max_level is null or min_level <= max_level)
);

insert into public.rank_config (rank_name, min_level, max_level, color, badge, glow_intensity)
values
  ('BRONZE', 1, 2, 'brown', '🟤', 1),
  ('SILVER', 3, 4, 'gray', '⚪', 2),
  ('DIAMOND', 5, 6, 'blue', '🔷', 3),
  ('ROOKIE', 7, 8, 'green', '🟢', 4),
  ('SMART', 9, 12, 'cyan', '🧠', 5),
  ('GENIUS', 13, 19, 'purple', '🧬', 6),
  ('ACHIEVER', 20, 24, 'gold', '🟡', 7),
  ('MASTER', 25, 29, 'orange-red', '🔥', 8),
  ('MASTER MIND', 30, null, 'neon-purple', '👑', 9)
on conflict (rank_name) do update
set
  min_level = excluded.min_level,
  max_level = excluded.max_level,
  color = excluded.color,
  badge = excluded.badge,
  glow_intensity = excluded.glow_intensity;

create or replace function public.rank_from_level(p_level integer)
returns text
language sql
immutable
as $$
  select rank_name
  from public.rank_config
  where p_level >= min_level
    and (max_level is null or p_level <= max_level)
  order by min_level desc
  limit 1;
$$;

create or replace function public.sync_profile_rank_title()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.rank := coalesce(public.rank_from_level(new.level), 'BRONZE');
  return new;
end;
$$;

drop trigger if exists set_profile_rank_on_level_change on public.profiles;
create trigger set_profile_rank_on_level_change
before insert or update of level
on public.profiles
for each row
execute function public.sync_profile_rank_title();

update public.profiles
set rank = coalesce(public.rank_from_level(level), 'BRONZE')
where rank is distinct from coalesce(public.rank_from_level(level), 'BRONZE');
