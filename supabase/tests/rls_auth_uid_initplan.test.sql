begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

-- Remove already-wrapped scalar subqueries, then fail only if a direct
-- auth.uid() call remains in a public policy expression.
select ok(
  not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and (
        regexp_replace(
          coalesce(p.qual, ''),
          '[(][[:space:]]*select[[:space:]]+auth[.]uid[(][)]([[:space:]]+as[[:space:]]+uid)?[[:space:]]*[)]',
          '',
          'gi'
        ) ilike '%auth.uid()%'
        or
        regexp_replace(
          coalesce(p.with_check, ''),
          '[(][[:space:]]*select[[:space:]]+auth[.]uid[(][)]([[:space:]]+as[[:space:]]+uid)?[[:space:]]*[)]',
          '',
          'gi'
        ) ilike '%auth.uid()%'
      )
  ),
  'all public RLS policy auth.uid calls are initplan-wrapped'
);

select * from finish();
rollback;
