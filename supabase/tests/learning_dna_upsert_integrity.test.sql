begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

insert into public.learning_dna (user_id)
values ('00000000-0000-4000-8000-000000004741');

select ok(
  exists (
    select 1
    from pg_index i
    join pg_class idx on idx.oid = i.indexrelid
    join pg_class tbl on tbl.oid = i.indrelid
    join pg_namespace n on n.oid = tbl.relnamespace
    where n.nspname = 'public'
      and tbl.relname = 'learning_dna'
      and idx.relname = 'learning_dna_user_id_key'
      and i.indisunique
  ),
  'Learning DNA user_id has a unique index for the upsert conflict target'
);

select throws_ok(
  $$insert into public.learning_dna (user_id) values ('00000000-0000-4000-8000-000000004741')$$,
  '23505',
  null,
  'a student cannot have duplicate Learning DNA rows'
);

select * from finish();
rollback;
