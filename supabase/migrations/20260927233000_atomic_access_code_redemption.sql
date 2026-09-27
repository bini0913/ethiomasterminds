-- Atomic access-code redemption. The code is locked and consumed in the
-- same transaction as the role assignment, preventing double redemption.
create or replace function public.redeem_access_code(
  p_code text,
  p_code_type text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code public.access_codes%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_code is null or length(trim(p_code)) = 0 then raise exception 'Code is required'; end if;
  if p_code_type not in ('teacher','admin','manager') then
    raise exception 'Invalid access code type';
  end if;

  select * into v_code
  from public.access_codes
  where upper(code)=upper(trim(p_code))
    and code_type=p_code_type
    and is_used=false
  for update;

  if not found then raise exception 'Invalid or already used access code'; end if;
  if v_code.expires_at is not null and v_code.expires_at < now() then
    raise exception 'Access code has expired';
  end if;

  if exists (
    select 1 from public.user_roles
    where user_id=v_uid and role=p_code_type
  ) then
    return jsonb_build_object('ok',true,'role',p_code_type,'already_assigned',true);
  end if;

  delete from public.user_roles
  where user_id=v_uid and role='student';

  insert into public.user_roles(user_id,role)
  values(v_uid,p_code_type);

  update public.access_codes
     set is_used=true, used_by=v_uid
   where id=v_code.id and is_used=false;

  if not found then
    raise exception 'Access code was redeemed by another request';
  end if;

  return jsonb_build_object('ok',true,'role',p_code_type,'already_assigned',false);
end;
$$;

revoke execute on function public.redeem_access_code(text,text) from public, anon;
grant execute on function public.redeem_access_code(text,text) to authenticated;
