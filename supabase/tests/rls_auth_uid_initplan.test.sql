begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select ok(
  not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and (
        replace(
          regexp_replace(
            coalesce(p.qual, ''),
            '[(][[:space:]]*select[[:space:]]+auth[.]uid[(][)]([[:space:]]+as[[:space:]]+uid)?[[:space:]]*[)]',
            'auth.uid()',
            'gi'
          ),
          '(select auth.uid())',
          ''
        ) ilike '%auth.uid()%'
        or
        replace(
          regexp_replace(
            coalesce(p.with_check, ''),
            '[(][[:space:]]*select[[:space:]]+auth[.]uid[(][)]([[:space:]]+as[[:space:]]+uid)?[[:space:]]*[)]',
            'auth.uid()',
            'gi'
          ),
          '(select auth.uid())',
          ''
        ) ilike '%auth.uid()%'
      )
  ),
  'all public RLS policy auth.uid calls are initplan-wrapped'
);

select * from finish();
rollback;
