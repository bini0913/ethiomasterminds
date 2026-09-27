-- Protect profile fields that control authorization and progression.
-- Students may complete profile setup, but cannot rewrite grade/progression
-- after setup or fabricate badges/XP through the Data API.
create or replace function public.protect_profile_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('anon','authenticated')
     and not (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager')) then

    if new.xp is distinct from old.xp
       or new.level is distinct from old.level
       or new.rank is distinct from old.rank
       or new.season_xp is distinct from old.season_xp
       or new.badges is distinct from old.badges then
      raise exception 'Progression fields are managed by Master Minds';
    end if;

    if old.grade is not null and new.grade is distinct from old.grade then
      raise exception 'Grade changes require an administrator';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_integrity on public.profiles;
create trigger trg_protect_profile_integrity
before update on public.profiles
for each row
execute function public.protect_profile_integrity();
