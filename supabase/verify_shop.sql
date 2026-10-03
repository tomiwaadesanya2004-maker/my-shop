-- Read-only verification of the shop migration and database access boundaries.
select jsonb_build_object(
  'tables', (select jsonb_agg(jsonb_build_object('name',tablename,'rls_enabled',rowsecurity) order by tablename) from pg_tables where schemaname='public' and tablename like 'shop_%'),
  'products', (select count(*) from public.shop_products),
  'active_products', (select count(*) from public.shop_products where active),
  'policies', (select jsonb_agg(jsonb_build_object('table',tablename,'policy',policyname,'roles',roles,'command',cmd) order by tablename) from pg_policies where schemaname='public' and tablename like 'shop_%'),
  'server_functions', (select jsonb_agg(jsonb_build_object('name',p.proname,'security_definer',p.prosecdef,'anon_can_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_can_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_role_can_execute',has_function_privilege('service_role',p.oid,'EXECUTE'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('shop_create_order','shop_settle_order','shop_claim_email')),
  'cart_timestamp_trigger', exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname='shop_cart_items' and t.tgname='shop_cart_timestamp' and not t.tgisinternal),
  'authenticated_can_insert_orders', has_table_privilege('authenticated','public.shop_orders','INSERT'),
  'authenticated_can_update_orders', has_table_privilege('authenticated','public.shop_orders','UPDATE'),
  'authenticated_can_read_email_jobs', has_table_privilege('authenticated','public.shop_email_outbox','SELECT'),
  'anon_can_read_products', has_table_privilege('anon','public.shop_products','SELECT'),
  'prototype_orders_preserved', to_regclass('public.orders') is not null
) as verification;
