begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_dna' and column_name='activity_summary' and data_type='jsonb'),
  'Learning DNA stores server-computed activity aggregates'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_dna' and column_name='ai_insights' and data_type='jsonb'),
  'Learning DNA stores structured Grok insights'
);
select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='learning_dna' and column_name='data_coverage' and data_type='jsonb'),
  'Learning DNA records source coverage and sample limits'
);
select ok(has_table_privilege('authenticated','public.learning_dna','SELECT'), 'authenticated students retain report read access');
select ok(not has_table_privilege('authenticated','public.learning_dna','INSERT'), 'students cannot forge activity reports');
select ok(not has_table_privilege('authenticated','public.learning_dna','UPDATE'), 'students cannot alter activity reports');
select ok(not has_table_privilege('authenticated','public.learning_dna','DELETE'), 'students cannot delete activity reports');
select ok(not has_table_privilege('anon','public.learning_dna','SELECT'), 'anonymous users cannot read activity reports');

select * from finish();
rollback;
