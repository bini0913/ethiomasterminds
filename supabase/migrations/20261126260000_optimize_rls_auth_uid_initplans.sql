-- Evaluate auth.uid() once per policy expression rather than once per row.
-- Normalise any existing scalar-subquery wrappers before applying one wrapper
-- to every occurrence, including policies that mix wrapped and direct calls.
do $$
declare
  v_policy record;
  v_using text;
  v_check text;
  v_sql text;
begin
  for v_policy in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ilike '%auth.uid()%'
        or coalesce(with_check, '') ilike '%auth.uid()%'
      )
  loop
    v_using := v_policy.qual;
    v_check := v_policy.with_check;

    if v_using is not null then
      v_using := regexp_replace(
        v_using,
        '[(][[:space:]]*select[[:space:]]+auth[.]uid[(][)]([[:space:]]+as[[:space:]]+uid)?[[:space:]]*[)]',
        'auth.uid()',
        'gi'
      );
      v_using := replace(v_using, 'auth.uid()', '(select auth.uid())');
    end if;

    if v_check is not null then
      v_check := regexp_replace(
        v_check,
        '[(][[:space:]]*select[[:space:]]+auth[.]uid[(][)]([[:space:]]+as[[:space:]]+uid)?[[:space:]]*[)]',
        'auth.uid()',
        'gi'
      );
      v_check := replace(v_check, 'auth.uid()', '(select auth.uid())');
    end if;

    v_sql := format('alter policy %I on %I.%I',
      v_policy.policyname, v_policy.schemaname, v_policy.tablename);

    if v_using is not null then
      v_sql := v_sql || format(' using (%s)', v_using);
    end if;

    if v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;

    execute v_sql;
  end loop;
end;
$$;
