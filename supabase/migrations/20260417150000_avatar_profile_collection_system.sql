-- Avatar + profile collection system foundation
create table if not exists public.avatars (
  user_id uuid primary key references auth.users(id) on delete cascade,
  face_data jsonb not null default '{}'::jsonb,
  clothes_data jsonb not null default '{}'::jsonb,
  accessories jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.store_items(id) on delete cascade,
  type text not null check (type in ('clothes', 'avatars', 'cars', 'themes', 'titles', 'special')),
  source text not null default 'shop',
  unlocked_at timestamptz not null default now(),
  equipped boolean not null default false,
  unique (user_id, item_id)
);

create index if not exists idx_avatars_updated_at on public.avatars(updated_at desc);
create index if not exists idx_collections_user_type on public.collections(user_id, type, unlocked_at desc);

create or replace function public.touch_avatar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_avatars_updated_at on public.avatars;
create trigger trg_avatars_updated_at
before update on public.avatars
for each row
execute function public.touch_avatar_updated_at();

create or replace function public.map_store_section_to_collection_type(p_section text, p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v_name text := lower(coalesce(p_name, ''));
begin
  if p_section = 'avatars' then
    return 'avatars';
  elsif p_section = 'titles' then
    return 'titles';
  elsif p_section = 'customization' then
    if v_name like '%theme%' then
      return 'themes';
    else
      return 'clothes';
    end if;
  elsif p_section = 'effects' then
    if v_name like '%car%' then
      return 'cars';
    elsif v_name like '%theme%' then
      return 'themes';
    else
      return 'special';
    end if;
  end if;

  return 'special';
end;
$$;

create or replace function public.sync_user_item_to_collection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.store_items;
  v_type text;
begin
  select * into v_item
  from public.store_items
  where id = new.item_id;

  if v_item.id is null then
    return new;
  end if;

  v_type := public.map_store_section_to_collection_type(v_item.section, v_item.name);

  insert into public.collections (user_id, item_id, type, source, equipped, unlocked_at)
  values (new.user_id, new.item_id, v_type, 'shop', new.equipped, coalesce(new.acquired_at, now()))
  on conflict (user_id, item_id)
  do update set
    equipped = excluded.equipped,
    unlocked_at = least(public.collections.unlocked_at, excluded.unlocked_at),
    type = excluded.type;

  return new;
end;
$$;

drop trigger if exists trg_user_items_sync_collection on public.user_items;
create trigger trg_user_items_sync_collection
after insert or update on public.user_items
for each row
execute function public.sync_user_item_to_collection();

-- Backfill existing user items into collections
insert into public.collections (user_id, item_id, type, source, equipped, unlocked_at)
select
  ui.user_id,
  ui.item_id,
  public.map_store_section_to_collection_type(si.section, si.name),
  'shop',
  ui.equipped,
  coalesce(ui.acquired_at, now())
from public.user_items ui
join public.store_items si on si.id = ui.item_id
on conflict (user_id, item_id) do nothing;

alter table public.avatars enable row level security;
alter table public.collections enable row level security;

drop policy if exists "Users can view avatars" on public.avatars;
create policy "Users can view avatars" on public.avatars
for select using (true);

drop policy if exists "Users can manage their avatars" on public.avatars;
create policy "Users can manage their avatars" on public.avatars
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can view collections" on public.collections;
create policy "Users can view collections" on public.collections
for select using (true);

drop policy if exists "Users can manage own collections" on public.collections;
create policy "Users can manage own collections" on public.collections
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
