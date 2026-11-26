-- Restore the read-only per-request deletion preflight on production histories
-- that already contain later migrations. Keep this forward-only: do not rewrite
-- the original 20261126230000 migration or alter remote migration history.
create or replace function public.extreme_admin_preflight_account_deletion(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.account_deletion_requests%rowtype;
  v_fk record;
  v_count bigint;
  v_blockers jsonb := '[]'::jsonb;
  v_storage jsonb := '[]'::jsonb;
  v_storage_count bigint := 0;
begin
  if v_actor is null or not public.has_role(v_actor, 'extreme_admin'::public.app_role) then
    raise exception using errcode = '42501', message = 'Extreme Admin access required';
  end if;

  if p_request_id is null then
    raise exception 'A deletion request is required';
  end if;

  select * into v_request
    from public.account_deletion_requests
   where id = p_request_id;

  if not found then
    raise exception 'Deletion request not found';
  end if;

  if v_request.user_id is null then
    return jsonb_build_object(
      'request_id', v_request.id,
      'auth_account_exists', false,
      'blocking_foreign_keys', '[]'::jsonb,
      'storage_objects_by_bucket', '[]'::jsonb,
      'storage_object_count', 0,
      'technical_blockers_clear', true,
      'retention_review_required', true,
      'deletion_executed', false
    );
  end if;

  -- Count only actual NO ACTION / RESTRICT rows that can block Auth deletion.
  -- The catalog join handles both single-column and composite foreign keys.
  for v_fk in
    select
      con.conname,
      child_ns.nspname as child_schema,
      child.relname as child_table,
      parent_ns.nspname as parent_schema,
      parent.relname as parent_table,
      case con.confdeltype
        when 'a' then 'NO ACTION'
        when 'r' then 'RESTRICT'
      end as delete_action,
      string_agg(
        format('child.%I = parent.%I', child_att.attname, parent_att.attname),
        ' AND ' order by child_key.ordinality
      ) as join_condition
    from pg_constraint con
    join pg_class child on child.oid = con.conrelid
    join pg_namespace child_ns on child_ns.oid = child.relnamespace
    join pg_class parent on parent.oid = con.confrelid
    join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
    join lateral unnest(con.conkey) with ordinality child_key(attnum, ordinality) on true
    join lateral unnest(con.confkey) with ordinality parent_key(attnum, ordinality)
      on parent_key.ordinality = child_key.ordinality
    join pg_attribute child_att
      on child_att.attrelid = child.oid and child_att.attnum = child_key.attnum
    join pg_attribute parent_att
      on parent_att.attrelid = parent.oid and parent_att.attnum = parent_key.attnum
    where con.contype = 'f'
      and con.confdeltype in ('a', 'r')
      and ((parent_ns.nspname = 'auth' and parent.relname = 'users')
        or (parent_ns.nspname = 'public' and parent.relname = 'profiles'))
      and exists (
        select 1
        from unnest(con.confkey) referenced_column(attnum)
        join pg_attribute id_column
          on id_column.attrelid = parent.oid
         and id_column.attnum = referenced_column.attnum
         and id_column.attname = 'id'
      )
    group by con.conname, child_ns.nspname, child.relname,
             parent_ns.nspname, parent.relname, con.confdeltype
  loop
    execute format(
      'select count(*)::bigint from %I.%I as child join %I.%I as parent on %s where parent.id = $1',
      v_fk.child_schema,
      v_fk.child_table,
      v_fk.parent_schema,
      v_fk.parent_table,
      v_fk.join_condition
    )
    into v_count
    using v_request.user_id;

    if v_count > 0 then
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'table', v_fk.child_schema || '.' || v_fk.child_table,
        'constraint', v_fk.conname,
        'delete_action', v_fk.delete_action,
        'referencing_rows', v_count
      ));
    end if;
  end loop;

  if to_regclass('storage.objects') is not null then
    execute
      'select coalesce(jsonb_agg(jsonb_build_object(''bucket_id'', bucket_id, ''objects'', object_count) order by bucket_id), ''[]''::jsonb), coalesce(sum(object_count), 0)::bigint
         from (
           select bucket_id, count(*)::bigint as object_count
             from storage.objects
            where owner_id = $1
            group by bucket_id
         ) owned'
      into v_storage, v_storage_count
      using v_request.user_id::text;
  end if;

  return jsonb_build_object(
    'request_id', v_request.id,
    'auth_account_exists', true,
    'blocking_foreign_keys', v_blockers,
    'storage_objects_by_bucket', v_storage,
    'storage_object_count', v_storage_count,
    'technical_blockers_clear', jsonb_array_length(v_blockers) = 0 and v_storage_count = 0,
    'retention_review_required', true,
    'deletion_executed', false
  );
end;
$$;

revoke all on function public.extreme_admin_preflight_account_deletion(uuid) from public, anon;
grant execute on function public.extreme_admin_preflight_account_deletion(uuid) to authenticated;

comment on function public.extreme_admin_preflight_account_deletion(uuid) is
  'Read-only Extreme Admin inventory of per-account NO ACTION/RESTRICT foreign-key references and owned Storage objects. Does not delete or modify data; manual retention review remains mandatory.';
