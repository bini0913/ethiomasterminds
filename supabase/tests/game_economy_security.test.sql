begin;

select plan(24);

-- Direct mutation is denied for all five economy tables.
select ok(not has_table_privilege('authenticated','public.user_currency','INSERT'), 'students cannot insert currency rows');
select ok(not has_table_privilege('authenticated','public.user_currency','UPDATE'), 'students cannot update currency rows');
select ok(not has_table_privilege('authenticated','public.user_currency','DELETE'), 'students cannot delete currency rows');
select ok(not has_table_privilege('authenticated','public.user_inventory','INSERT'), 'students cannot insert inventory rows');
select ok(not has_table_privilege('authenticated','public.user_inventory','UPDATE'), 'students cannot update inventory rows');
select ok(not has_table_privilege('authenticated','public.user_inventory','DELETE'), 'students cannot delete inventory rows');
select ok(not has_table_privilege('authenticated','public.user_achievements','INSERT'), 'students cannot insert achievement rows');
select ok(not has_table_privilege('authenticated','public.user_achievements','UPDATE'), 'students cannot update achievement rows');
select ok(not has_table_privilege('authenticated','public.user_achievements','DELETE'), 'students cannot delete achievement rows');
select ok(not has_table_privilege('authenticated','public.user_missions','INSERT'), 'students cannot insert mission rows');
select ok(not has_table_privilege('authenticated','public.user_missions','UPDATE'), 'students cannot update mission rows');
select ok(not has_table_privilege('authenticated','public.user_missions','DELETE'), 'students cannot delete mission rows');
select ok(not has_table_privilege('authenticated','public.early_user_collection','INSERT'), 'students cannot insert collectible ownership');
select ok(not has_table_privilege('authenticated','public.early_user_collection','UPDATE'), 'students cannot update collectible ownership');
select ok(not has_table_privilege('authenticated','public.early_user_collection','DELETE'), 'students cannot delete collectible ownership');

-- Read access remains available.
select ok(has_table_privilege('authenticated','public.user_currency','SELECT'), 'students can read currency');
select ok(has_table_privilege('authenticated','public.user_inventory','SELECT'), 'students can read inventory');
select ok(has_table_privilege('authenticated','public.user_achievements','SELECT'), 'students can read achievements');
select ok(has_table_privilege('authenticated','public.user_missions','SELECT'), 'students can read missions');
select ok(has_table_privilege('authenticated','public.early_user_collection','SELECT'), 'students can read collectibles');

-- Existing trusted transaction paths remain callable by authenticated users.
select ok(has_function_privilege('authenticated','public.purchase_early_item(uuid)','EXECUTE'), 'server-side collectible purchase RPC remains available');
select ok(has_function_privilege('authenticated','public.complete_early_activity(uuid,text,text,boolean,boolean)','EXECUTE'), 'server-side early activity reward RPC remains available');
select ok(has_function_privilege('authenticated','public.check_achievements(uuid)','EXECUTE'), 'achievement initialization RPC remains available');

-- The legacy unrestricted multiplayer payout RPC is no longer callable.
select ok(not has_function_privilege('authenticated','public.finalize_match(uuid)','EXECUTE'), 'legacy multiplayer payout RPC is revoked');
select ok(not has_function_privilege('anon','public.finalize_match(uuid)','EXECUTE'), 'anonymous users cannot call legacy multiplayer payout RPC');

select * from finish();
rollback;
