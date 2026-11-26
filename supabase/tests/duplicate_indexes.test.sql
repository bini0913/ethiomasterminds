begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select ok(to_regclass('public.user_policy_acceptances_lookup_idx') is null,
  'redundant non-unique policy acceptance index is removed');
select ok(to_regclass('public.user_policy_acceptances_unique') is not null,
  'unique policy acceptance index remains to support the same lookup');
select ok(to_regclass('public.user_roles_single_super_admin_idx') is null,
  'duplicate Super Admin partial unique index is removed');
select ok(to_regclass('public.exactly_one_super_admin') is not null,
  'the remaining Super Admin uniqueness invariant is preserved');
select ok(to_regclass('public.user_roles_single_extreme_admin_idx') is null,
  'duplicate Extreme Admin partial unique index is removed');
select ok(to_regclass('public.exactly_one_extreme_admin') is not null,
  'the remaining Extreme Admin uniqueness invariant is preserved');

select * from finish();
rollback;
