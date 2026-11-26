begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select ok(to_regclass('public.early_item_exposure') is not null,'early item exposure table is present in migrations');
select ok((select relrowsecurity from pg_class where oid='public.early_item_exposure'::regclass),'early item exposure has RLS enabled');
select ok(not has_table_privilege('anon','public.early_item_exposure','select'),'anonymous clients cannot read internal exposure records');
select ok(not has_table_privilege('authenticated','public.early_item_exposure','select'),'authenticated clients cannot directly read internal exposure records');
select ok(not has_table_privilege('authenticated','public.early_item_exposure','insert'),'authenticated clients cannot directly write internal exposure records');

select * from finish();
rollback;
