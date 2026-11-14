-- The Learning DNA Edge Function upserts one report per student by user_id.
-- The original table only had a primary key on id, so Postgres rejected
-- ON CONFLICT (user_id). Production currently has no rows, so this is safe
-- to enforce without data cleanup.

do $$
begin
  if exists (
    select 1
    from public.learning_dna
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce one Learning DNA row per user: duplicate user_id rows exist';
  end if;
end;
$$;

create unique index if not exists learning_dna_user_id_key
  on public.learning_dna (user_id);

comment on index public.learning_dna_user_id_key is
  'Enforces one Learning DNA analysis row per student and supports the Edge Function upsert conflict target.';
