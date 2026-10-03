-- New namespaced tables preserve any existing prototype orders table.
begin;
create table public.shop_products (
  id uuid primary key default gen_random_uuid(),
  name text not null, category text not null, description text not null,
  price_kobo integer not null check (price_kobo > 0 and price_kobo <= 100000000),
  image_url text not null, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.shop_cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.shop_products(id),
  quantity integer not null check (quantity between 1 and 99),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create table public.shop_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '', address text not null default '', city text not null default '', phone text not null default ''
);
create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  checkout_key uuid not null,
  reference text unique not null,
  name text not null, email text not null, address text not null, city text not null, phone text not null,
  total_kobo bigint not null check (total_kobo > 0), shipping_kobo integer not null,
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending' check (status in ('pending','paid')),
  authorization_url text, transaction_id text unique,
  created_at timestamptz not null default now(), paid_at timestamptz,
  unique (user_id, checkout_key)
);
create table public.shop_order_items (
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  product_id uuid not null references public.shop_products(id),
  name text not null, quantity integer not null check (quantity between 1 and 99), unit_price_kobo integer not null,
  primary key (order_id, product_id)
);
create table public.shop_email_outbox (
  order_id uuid primary key references public.shop_orders(id),
  status text not null default 'pending' check (status in ('pending','sending','sent')),
  attempts integer not null default 0, lease_id uuid, locked_until timestamptz,
  sent_at timestamptz, last_error text, created_at timestamptz not null default now()
);
create index shop_orders_user_date on public.shop_orders(user_id, created_at desc);
create function public.shop_cart_timestamp() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger shop_cart_timestamp before insert or update on public.shop_cart_items for each row execute function public.shop_cart_timestamp();
alter table public.shop_products enable row level security;
alter table public.shop_cart_items enable row level security;
alter table public.shop_profiles enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;
alter table public.shop_email_outbox enable row level security;
create policy products_read on public.shop_products for select to anon, authenticated using (active);
create policy cart_owner on public.shop_cart_items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy profile_owner on public.shop_profiles for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy orders_read on public.shop_orders for select to authenticated using ((select auth.uid()) = user_id);
create policy order_items_read on public.shop_order_items for select to authenticated using (exists (select 1 from public.shop_orders o where o.id = order_id and o.user_id = (select auth.uid())));
revoke all on public.shop_products, public.shop_cart_items, public.shop_profiles, public.shop_orders, public.shop_order_items, public.shop_email_outbox from anon, authenticated;
grant select on public.shop_products to anon, authenticated;
grant select, insert, update, delete on public.shop_cart_items, public.shop_profiles to authenticated;
grant select on public.shop_orders, public.shop_order_items to authenticated;
grant all on public.shop_products, public.shop_cart_items, public.shop_profiles, public.shop_orders, public.shop_order_items, public.shop_email_outbox to service_role;

create function public.shop_create_order(p_user_id uuid, p_checkout_key uuid, p_name text, p_email text, p_address text, p_city text, p_phone text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_subtotal bigint; v_shipping integer; v_count integer; v_items jsonb; v_active boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select id into v_id from public.shop_orders where user_id = p_user_id and checkout_key = p_checkout_key;
  if v_id is not null then return v_id; end if;
  -- Lock the cart for a consistent order snapshot.
  perform 1 from public.shop_cart_items where user_id = p_user_id for update;
  select count(*), sum(c.quantity::bigint * p.price_kobo), bool_and(p.active),
    jsonb_agg(jsonb_build_object('product_id',p.id,'name',p.name,'quantity',c.quantity,'unit_price_kobo',p.price_kobo))
  into v_count, v_subtotal, v_active, v_items
  from public.shop_cart_items c join public.shop_products p on p.id = c.product_id
  where c.user_id = p_user_id;
  if v_count = 0 then raise exception 'Cart is empty'; end if;
  if v_count > 50 or not v_active then raise exception 'Unavailable products or cart too large'; end if;
  v_shipping := case when v_subtotal >= 5000000 then 0 else 250000 end;
  v_id := gen_random_uuid();
  insert into public.shop_orders(id,user_id,checkout_key,reference,name,email,address,city,phone,total_kobo,shipping_kobo)
  values(v_id,p_user_id,p_checkout_key,'shop_'||v_id::text,p_name,p_email,p_address,p_city,p_phone,v_subtotal+v_shipping,v_shipping);
  insert into public.shop_order_items(order_id,product_id,name,quantity,unit_price_kobo)
  select v_id,i.product_id,i.name,i.quantity,i.unit_price_kobo
  from jsonb_to_recordset(v_items) as i(product_id uuid,name text,quantity integer,unit_price_kobo integer);
  insert into public.shop_profiles(user_id,name,address,city,phone) values(p_user_id,p_name,p_address,p_city,p_phone)
  on conflict(user_id) do update set name=excluded.name,address=excluded.address,city=excluded.city,phone=excluded.phone;
  return v_id;
end $$;

create function public.shop_settle_order(p_order_id uuid, p_transaction_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order public.shop_orders;
begin
  select * into v_order from public.shop_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status='paid' then return; end if;
  update public.shop_orders set status='paid',paid_at=now(),transaction_id=p_transaction_id where id=p_order_id;
  insert into public.shop_email_outbox(order_id) values(p_order_id) on conflict do nothing;
  -- Only remove lines unchanged since checkout; preserve subsequent cart edits.
  delete from public.shop_cart_items c using public.shop_order_items i
  where c.user_id=v_order.user_id and i.order_id=p_order_id and c.product_id=i.product_id and c.quantity=i.quantity and c.updated_at<=v_order.created_at;
end $$;

create function public.shop_claim_email(p_order_id uuid)
returns table(lease_id uuid) language sql security definer set search_path = '' as $$
  update public.shop_email_outbox e set status='sending',lease_id=gen_random_uuid(),locked_until=now()+interval '5 minutes',attempts=attempts+1
  where e.order_id=p_order_id and e.status<>'sent' and (e.locked_until is null or e.locked_until<now())
  and exists(select 1 from public.shop_orders o where o.id=e.order_id and o.status='paid')
  returning e.lease_id;
$$;
revoke all on function public.shop_create_order(uuid,uuid,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.shop_settle_order(uuid,text) from public, anon, authenticated;
revoke all on function public.shop_claim_email(uuid) from public, anon, authenticated;
grant execute on function public.shop_create_order(uuid,uuid,text,text,text,text,text), public.shop_settle_order(uuid,text), public.shop_claim_email(uuid) to service_role;

insert into public.shop_products(name,category,description,price_kobo,image_url) values
('Everyday cotton tee','Clothing','An easy fit. Soft cotton. Your new everyday favourite.',850000,'/products/tee.svg'),
('Court sneakers','Footwear','Clean lines and a cushioned sole for wherever the day goes.',2800000,'/products/sneakers.svg'),
('Classic cap','Accessories','A low profile cotton cap with an adjustable back.',650000,'/products/cap.svg'),
('Weekend tote','Accessories','Room for the essentials, and a little more. Heavy cotton canvas.',1200000,'/products/tote.svg'),
('Essential hoodie','Clothing','A relaxed layer in soft heavyweight fleece.',2250000,'/products/hoodie.svg'),
('Everyday slides','Footwear','Lightweight comfort, from slow mornings to weekend errands.',1400000,'/products/slides.svg');
commit;
