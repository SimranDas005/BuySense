-- BuySense: single Supabase auth system, role-based access control and RLS.
-- Apply with `supabase db push` or paste into the Supabase SQL editor.
-- Safe to re-run: every object is created with IF NOT EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- 0. Shared helpers
-- ---------------------------------------------------------------------------

-- roles live in exactly one place: profiles.role.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Profiles: roles, contact info, delivery address
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists address jsonb;
alter table public.profiles add column if not exists role text;

update public.profiles set role = 'customer' where role is null or role not in ('customer', 'admin');
alter table public.profiles alter column role set default 'customer';
alter table public.profiles alter column role set not null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer', 'admin'));

-- Every Supabase auth user gets exactly one profile. Role can only be set to
-- admin by the server-side admin-registration function (service role), never
-- by trusting user_metadata from a public sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Catalogue columns used by the storefront (writes are admin-only)
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists tagline text,
  add column if not exists mrp numeric,
  add column if not exists images jsonb,
  add column if not exists specs jsonb,
  add column if not exists featured boolean not null default false,
  add column if not exists category_slug text;

update public.products
set
  name = coalesce(nullif(name, ''), nullif(model, ''), 'Laptop'),
  slug = coalesce(
    nullif(slug, ''),
    trim(both '-' from regexp_replace(lower(coalesce(model, 'laptop')), '[^a-z0-9]+', '-', 'g'))
      || '-' || replace(substring(id::text, 1, 8), '-', '')
  ),
  mrp = coalesce(mrp, original_price, price),
  images = coalesce(images, jsonb_build_array(coalesce(image_url, ''))),
  category_slug = coalesce(nullif(category_slug, ''), 'everyday')
where name is null or name = '' or slug is null or slug = ''
   or mrp is null or images is null or category_slug is null or category_slug = '';

alter table public.products alter column name set not null;
alter table public.products alter column slug set not null;
drop index if exists public.products_slug_key;
create unique index products_slug_key on public.products (slug);

-- ---------------------------------------------------------------------------
-- 3. Order columns used by the storefront
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists status_history jsonb not null default '[]'::jsonb,
  add column if not exists address_data jsonb;

alter table public.order_items add column if not exists brand text;
alter table public.order_items add column if not exists image text;

-- ---------------------------------------------------------------------------
-- 4. Remove any pre-existing policies on the tables we manage, then apply one
--    consistent policy set. This prevents an older permissive policy from
--    leaving a hole in the permission model.
-- ---------------------------------------------------------------------------

do $$
declare r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array['profiles','products','orders','order_items','cart_items','wishlists','reviews','decision_history'])
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.reviews enable row level security;
alter table public.decision_history enable row level security;

-- Profiles: a customer may only see their own profile; admins may see all.
-- No direct INSERT/UPDATE/DELETE privilege is granted to clients: profile
-- edits go through update_my_profile(), roles only through trusted server code.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Products: public read, admin writes.
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

create policy "products_public_read" on public.products
  for select to anon, authenticated
  using (is_active);

create policy "products_admin_read" on public.products
  for select to authenticated
  using (public.is_admin());

create policy "products_admin_insert" on public.products
  for insert to authenticated with check (public.is_admin());

create policy "products_admin_update" on public.products
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "products_admin_delete" on public.products
  for delete to authenticated using (public.is_admin());

-- Orders and items: only readable by their owner or an admin. All writes go
-- through SECURITY DEFINER RPCs so stock changes and ownership are atomic.
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;

create policy "orders_owner_or_admin" on public.orders
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "order_items_owner_or_admin" on public.order_items
  for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id
            and (o.user_id = auth.uid() or public.is_admin()))
  );

-- Carts and wishlists are private to their owner.
grant select, insert, update, delete on public.cart_items to authenticated;
grant select, insert, delete on public.wishlists to authenticated;

create unique index if not exists cart_items_user_product_key on public.cart_items (user_id, product_id);
create unique index if not exists wishlists_user_product_key on public.wishlists (user_id, product_id);

create policy "cart_items_owner" on public.cart_items
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "wishlists_owner" on public.wishlists
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reviews and decision history: owners only; admins may moderate reviews.
grant select, insert, update, delete on public.reviews to authenticated;
grant select, insert, update, delete on public.decision_history to authenticated;

create policy "reviews_owner_or_admin" on public.reviews
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

create policy "decision_history_owner" on public.decision_history
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. Trusted RPCs
-- ---------------------------------------------------------------------------

create or replace function public.update_my_profile(
  p_full_name text,
  p_phone text,
  p_address jsonb
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Please sign in to continue.';
  end if;
  update public.profiles
  set full_name = coalesce(nullif(p_full_name, ''), full_name),
      phone = coalesce(nullif(p_phone, ''), phone),
      address = case when p_address is null then address else p_address end
  where id = auth.uid()
  returning * into v_profile;
  return v_profile;
end;
$$;

revoke all on function public.update_my_profile(text, text, jsonb) from public;
grant execute on function public.update_my_profile(text, text, jsonb) to authenticated;

-- Places an order, validates stock, reserves inventory and empties the cart
-- in one transaction. The user id always comes from the verified JWT.
create or replace function public.place_order(
  p_items jsonb,
  p_address jsonb,
  p_customer_name text,
  p_customer_email text
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_order public.orders;
  v_item jsonb;
  v_product public.products;
  v_qty int;
  v_subtotal numeric := 0;
  v_number text;
  v_order_id uuid := gen_random_uuid();
  v_items jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'Please sign in to continue.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your bag is empty.';
  end if;

  -- Lock products in a stable order so concurrent checkouts cannot oversell
  -- stock or deadlock when their carts contain overlapping products.
  for v_item in
    select value from jsonb_array_elements(p_items)
    order by value ->> 'productId'
  loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then
      raise exception 'Invalid item quantity.';
    end if;

    select * into v_product from public.products
      where id = (v_item ->> 'productId')::uuid and is_active
      for update;

    if not found then
      raise exception 'This laptop is no longer available.';
    end if;
    if v_product.stock < v_qty then
      raise exception 'Only % of % left. Please update your bag.', v_product.stock, v_product.name;
    end if;

    v_subtotal := v_subtotal + v_product.price * v_qty;
    v_items := v_items || jsonb_build_object(
      'productId', v_product.id,
      'name', v_product.name,
      'brand', v_product.brand,
      'image', coalesce(v_product.images ->> 0, ''),
      'unitPrice', v_product.price,
      'quantity', v_qty
    );

    update public.products set stock = stock - v_qty where id = v_product.id;
  end loop;

  v_number := 'BS-' || to_char(now(), 'YYMMDD') || '-' || lpad(floor(random() * 9000 + 1000)::text, 4, '0');

  insert into public.orders (
    id, order_number, user_id, order_status, payment_method, payment_status,
    subtotal, discount, delivery_fee, total_amount, address, address_data,
    phone, customer_name, customer_email, items, status_history, created_at
  )
  values (
    v_order_id, v_number, v_user, 'pending', 'cod', 'unpaid',
    v_subtotal, 0, 0, v_subtotal, coalesce(p_address ->> 'line1', ''), p_address,
    coalesce(p_address ->> 'phone', ''), p_customer_name, p_customer_email,
    v_items, jsonb_build_array(jsonb_build_object('status', 'pending', 'at', now())), now()
  )
  returning * into v_order;

  -- Insert the parent order before its rows to satisfy immediate foreign keys.
  for v_item in select value from jsonb_array_elements(v_items)
  loop
    insert into public.order_items (order_id, product_id, product_name, brand, image, quantity, unit_price, subtotal)
    values (
      v_order_id,
      (v_item ->> 'productId')::uuid,
      v_item ->> 'name',
      v_item ->> 'brand',
      coalesce(v_item ->> 'image', ''),
      (v_item ->> 'quantity')::int,
      (v_item ->> 'unitPrice')::numeric,
      (v_item ->> 'unitPrice')::numeric * (v_item ->> 'quantity')::int
    );
  end loop;

  delete from public.cart_items where user_id = v_user;
  return v_order;
end;
$$;

revoke all on function public.place_order(jsonb, jsonb, text, text) from public;
grant execute on function public.place_order(jsonb, jsonb, text, text) to authenticated;

-- Applies a status change. Admin-only for every status except a customer's own
-- cancellation. Cancelling returns reserved stock exactly once.
create or replace function public.change_order_status(p_order_id uuid, p_status text)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_product_id uuid;
  v_qty int;
begin
  if p_status not in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') then
    raise exception 'Unknown order status.';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.order_status in ('cancelled', 'delivered') then
    raise exception 'This order can no longer be changed.';
  end if;
  if v_order.order_status = p_status then
    return v_order;
  end if;

  if p_status = 'cancelled' then
    if v_order.order_status not in ('pending', 'confirmed') then
      raise exception 'This order has already shipped and can''t be cancelled.';
    end if;
    if not public.is_admin() and v_order.user_id <> auth.uid() then
      raise exception 'This order does not belong to you.';
    end if;
  else
    if not public.is_admin() then
      raise exception 'Only administrators can do this.';
    end if;
    if not (
      (v_order.order_status = 'pending' and p_status = 'confirmed') or
      (v_order.order_status = 'confirmed' and p_status = 'shipped') or
      (v_order.order_status = 'shipped' and p_status = 'delivered')
    ) then
      raise exception 'This order status change is not allowed.';
    end if;
  end if;

  if p_status = 'cancelled' then
    for v_item in select value from jsonb_array_elements(v_order.items)
    loop
      v_product_id := (v_item ->> 'productId')::uuid;
      v_qty := (v_item ->> 'quantity')::int;
      if v_product_id is not null and v_qty is not null then
        update public.products set stock = stock + v_qty where id = v_product_id;
      end if;
    end loop;
  end if;

  update public.orders
  set order_status = p_status,
      payment_status = case
        when p_status = 'cancelled' and payment_status = 'unpaid' then 'unpaid'
        when p_status = 'cancelled' then 'refunded'
        else payment_status
      end,
      status_history = v_order.status_history || jsonb_build_object('status', p_status, 'at', now())
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.change_order_status(uuid, text) from public;
grant execute on function public.change_order_status(uuid, text) to authenticated;

-- Admin catalogue operations (RLS already restricts these to admins; these
-- RPCs give the UI a single, validated entry point).
create or replace function public.set_product_stock(p_product_id uuid, p_stock int)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can do this.';
  end if;
  if p_stock is null or p_stock < 0 then
    raise exception 'Stock must be a whole number >= 0.';
  end if;
  update public.products set stock = p_stock where id = p_product_id;
end;
$$;

revoke all on function public.set_product_stock(uuid, integer) from public;
grant execute on function public.set_product_stock(uuid, integer) to authenticated;

-- Confirm the fixed permission set at the end of the migration.
grant usage on schema public to anon, authenticated;
-- Seed catalogue for BuySense. Products whose slug already exists are skipped.
insert into public.products
  (id, slug, name, brand, category_slug, tagline, description, price, mrp, images, specs, stock, featured, is_active, created_at)
select * from jsonb_to_recordset('[{"id":"9be8b8c4-06a8-490c-a27d-312383cdc887","slug":"macbook-air-13-m3","name":"MacBook Air 13 (M3)","brand":"Apple","category_slug":"ultrabook","tagline":"Featherlight. All-day power.","description":"A fanless, silent ultrabook built around the M3 chip. Exceptional battery life, a crisp Liquid Retina display and a body that slips into any bag.","price":114900,"mrp":119900,"images":["preset:ultrabook","preset:hero"],"specs":{"cpu":"Apple M3 (8-core CPU)","cpuScore":78,"gpu":"Apple 10-core GPU","gpuScore":52,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":13.6,"displayResolution":"2560 × 1664","displayType":"Liquid Retina IPS","refreshRate":60,"batteryHours":18,"weightKg":1.24,"os":"macOS","ports":"2× Thunderbolt / USB 4, MagSafe 3, 3.5 mm jack"},"stock":14,"featured":true,"is_active":true,"created_at":"2026-11-17T05:23:22.102Z"},{"id":"5cd4cc1a-382d-4339-9680-ccb77a1ad0fe","slug":"macbook-pro-16-m3-pro","name":"MacBook Pro 16 (M3 Pro)","brand":"Apple","category_slug":"creator","tagline":"Pro performance for serious creative work.","description":"A 16-inch Liquid Retina XDR display, the M3 Pro chip and a thermal design that holds peak performance through long renders and builds.","price":249900,"mrp":249900,"images":["preset:creator","preset:hero"],"specs":{"cpu":"Apple M3 Pro (12-core CPU)","cpuScore":92,"gpu":"Apple 18-core GPU","gpuScore":74,"ramGb":18,"storageGb":512,"storageType":"SSD","displaySize":16.2,"displayResolution":"3456 × 2234","displayType":"Liquid Retina XDR mini-LED","refreshRate":120,"batteryHours":22,"weightKg":2.14,"os":"macOS","ports":"3× Thunderbolt 4, HDMI, SDXC, MagSafe 3, 3.5 mm jack"},"stock":6,"featured":true,"is_active":true,"created_at":"2026-11-17T05:23:22.103Z"},{"id":"f005a519-de22-451a-b1a3-09fa7aa1a19e","slug":"dell-xps-14","name":"Dell XPS 14","brand":"Dell","category_slug":"ultrabook","tagline":"Edge-to-edge craft in machined aluminium.","description":"Intel Core Ultra power with optional discrete graphics in a precision-machined chassis, framed by a seamless glass palm rest.","price":169990,"mrp":184990,"images":["preset:ultrabook"],"specs":{"cpu":"Intel Core Ultra 7 155H","cpuScore":82,"gpu":"NVIDIA GeForce RTX 4050 6GB","gpuScore":68,"ramGb":32,"storageGb":1024,"storageType":"SSD","displaySize":14.5,"displayResolution":"3200 × 2000","displayType":"OLED touch","refreshRate":120,"batteryHours":12,"weightKg":1.68,"os":"Windows 11 Home","ports":"3× Thunderbolt 4, microSD, 3.5 mm jack"},"stock":9,"featured":false,"is_active":true,"created_at":"2026-11-17T05:23:22.103Z"},{"id":"4b9a34b6-b096-413f-b1df-a9bb8fbd8726","slug":"asus-rog-zephyrus-g14","name":"ASUS ROG Zephyrus G14","brand":"ASUS","category_slug":"gaming","tagline":"Compact. Ferocious. Built to travel.","description":"A 14-inch gaming machine with a 120 Hz OLED panel, RTX graphics and a slim CNC aluminium body that doesn''t look like a gaming laptop.","price":174990,"mrp":199990,"images":["preset:gaming"],"specs":{"cpu":"AMD Ryzen 9 8945HS","cpuScore":88,"gpu":"NVIDIA GeForce RTX 4070 8GB","gpuScore":84,"ramGb":32,"storageGb":1024,"storageType":"SSD","displaySize":14,"displayResolution":"2880 × 1800","displayType":"OLED","refreshRate":120,"batteryHours":8,"weightKg":1.5,"os":"Windows 11 Home","ports":"USB4, USB-C, 2× USB-A, HDMI 2.1, microSD, 3.5 mm jack"},"stock":7,"featured":true,"is_active":true,"created_at":"2026-11-17T05:23:22.103Z"},{"id":"55659e9f-11b6-4075-9caa-8eae7ea8c521","slug":"lenovo-legion-pro-5","name":"Lenovo Legion Pro 5","brand":"Lenovo","category_slug":"gaming","tagline":"Tournament-grade cooling and frame rates.","description":"Legion ColdFront cooling keeps the Intel Core i9 and RTX 4060 running flat-out, driving a fast 165 Hz WQXGA display.","price":154990,"mrp":172990,"images":["preset:gaming"],"specs":{"cpu":"Intel Core i9-14900HX","cpuScore":95,"gpu":"NVIDIA GeForce RTX 4060 8GB","gpuScore":78,"ramGb":16,"storageGb":1024,"storageType":"SSD","displaySize":16,"displayResolution":"2560 × 1600","displayType":"IPS","refreshRate":165,"batteryHours":6,"weightKg":2.5,"os":"Windows 11 Home","ports":"USB-C, 4× USB-A, HDMI 2.1, RJ-45, 3.5 mm jack"},"stock":11,"featured":false,"is_active":true,"created_at":"2026-11-17T05:23:22.103Z"},{"id":"770efa7d-237d-457f-936e-03d4ba7c99ff","slug":"acer-nitro-v-15","name":"Acer Nitro V 15","brand":"Acer","category_slug":"gaming","tagline":"Your first serious gaming rig.","description":"An accessible entry into RTX gaming with a 144 Hz display, dual-fan cooling and easy upgrade access to memory and storage.","price":72990,"mrp":89999,"images":["preset:gaming"],"specs":{"cpu":"Intel Core i5-13420H","cpuScore":64,"gpu":"NVIDIA GeForce RTX 3050 6GB","gpuScore":55,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":15.6,"displayResolution":"1920 × 1080","displayType":"IPS","refreshRate":144,"batteryHours":5,"weightKg":2.1,"os":"Windows 11 Home","ports":"Thunderbolt 4, 3× USB-A, HDMI 2.1, RJ-45, 3.5 mm jack"},"stock":18,"featured":false,"is_active":true,"created_at":"2026-11-17T05:23:22.103Z"},{"id":"323629dd-b705-4ac0-9c55-c1ddb73976b5","slug":"lenovo-thinkpad-x1-carbon-gen-12","name":"ThinkPad X1 Carbon Gen 12","brand":"Lenovo","category_slug":"business","tagline":"The business icon, lighter than ever.","description":"Carbon-fibre construction, a legendary keyboard and enterprise-grade security in a laptop that weighs barely over a kilogram.","price":189990,"mrp":215000,"images":["preset:business"],"specs":{"cpu":"Intel Core Ultra 7 155U","cpuScore":72,"gpu":"Intel Graphics","gpuScore":30,"ramGb":32,"storageGb":1024,"storageType":"SSD","displaySize":14,"displayResolution":"2880 × 1800","displayType":"OLED","refreshRate":120,"batteryHours":14,"weightKg":1.09,"os":"Windows 11 Pro","ports":"2× Thunderbolt 4, 2× USB-A, HDMI, 3.5 mm jack"},"stock":8,"featured":true,"is_active":true,"created_at":"2026-11-17T05:23:22.103Z"},{"id":"da01fa63-9dfd-4091-8a02-79c5b0c49e72","slug":"hp-elitebook-840-g11","name":"HP EliteBook 840 G11","brand":"HP","category_slug":"business","tagline":"Secure, serviceable, ready for hybrid work.","description":"HP Wolf Security, a 5 MP camera with AI noise cancellation and a durable aluminium chassis built for the daily commute.","price":129990,"mrp":149990,"images":["preset:business"],"specs":{"cpu":"Intel Core Ultra 5 125U","cpuScore":62,"gpu":"Intel Graphics","gpuScore":26,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":14,"displayResolution":"1920 × 1200","displayType":"IPS","refreshRate":60,"batteryHours":13,"weightKg":1.36,"os":"Windows 11 Pro","ports":"2× Thunderbolt 4, 2× USB-A, HDMI, 3.5 mm jack"},"stock":12,"featured":false,"is_active":true,"created_at":"2026-11-17T05:23:22.103Z"},{"id":"3f60929a-8c99-435f-ac13-ad464c4bb97d","slug":"hp-spectre-x360-14","name":"HP Spectre x360 14","brand":"HP","category_slug":"convertible","tagline":"Laptop, tablet, canvas — in one.","description":"A gem-cut convertible with a 2.8K OLED touch display, pen support and a 360° hinge that flips from meetings to sketching.","price":159990,"mrp":179990,"images":["preset:convertible"],"specs":{"cpu":"Intel Core Ultra 7 155H","cpuScore":80,"gpu":"Intel Arc Graphics","gpuScore":40,"ramGb":16,"storageGb":1024,"storageType":"SSD","displaySize":14,"displayResolution":"2880 × 1800","displayType":"OLED touch","refreshRate":120,"batteryHours":11,"weightKg":1.44,"os":"Windows 11 Home","ports":"2× Thunderbolt 4, USB-A, 3.5 mm jack"},"stock":5,"featured":true,"is_active":true,"created_at":"2026-11-17T05:23:22.103Z"},{"id":"ec2be7eb-e53c-4536-8a02-f451a66ec015","slug":"lenovo-yoga-7i-2-in-1","name":"Lenovo Yoga 7i 2-in-1","brand":"Lenovo","category_slug":"convertible","tagline":"Flexible by design. Friendly on budget.","description":"A versatile 2-in-1 with a bright touch display, active pen support and enough battery for a full day of lectures.","price":84990,"mrp":99990,"images":["preset:convertible"],"specs":{"cpu":"Intel Core Ultra 5 125U","cpuScore":62,"gpu":"Intel Graphics","gpuScore":28,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":14,"displayResolution":"1920 × 1200","displayType":"IPS touch","refreshRate":60,"batteryHours":12,"weightKg":1.55,"os":"Windows 11 Home","ports":"2× Thunderbolt 4, USB-A, HDMI, microSD, 3.5 mm jack"},"stock":10,"featured":false,"is_active":true,"created_at":"2026-11-17T05:23:22.103Z"},{"id":"ce97dc7b-b88c-4dd1-8707-e5044ad166de","slug":"asus-proart-p16","name":"ASUS ProArt P16","brand":"ASUS","category_slug":"creator","tagline":"A 4K studio that travels with you.","description":"Pantone-validated 4K OLED, the ASUS Dial for precision edits and RTX graphics tuned for creative applications.","price":239990,"mrp":259990,"images":["preset:creator"],"specs":{"cpu":"AMD Ryzen AI 9 HX 370","cpuScore":93,"gpu":"NVIDIA GeForce RTX 4070 8GB","gpuScore":85,"ramGb":32,"storageGb":2048,"storageType":"SSD","displaySize":16,"displayResolution":"3840 × 2400","displayType":"OLED touch","refreshRate":60,"batteryHours":9,"weightKg":1.85,"os":"Windows 11 Pro","ports":"USB4, USB-C, 2× USB-A, HDMI 2.1, SD Express, 3.5 mm jack"},"stock":4,"featured":false,"is_active":true,"created_at":"2026-11-17T05:23:22.103Z"},{"id":"d6d41994-30ae-4c52-8bfd-8d509b921401","slug":"acer-aspire-5","name":"Acer Aspire 5","brand":"Acer","category_slug":"everyday","tagline":"Everything you need, nothing you don''t.","description":"A dependable everyday laptop for study, streaming and office work with a full-size keyboard and fast SSD storage.","price":49990,"mrp":62999,"images":["preset:everyday"],"specs":{"cpu":"Intel Core i5-1335U","cpuScore":54,"gpu":"Intel Iris Xe Graphics","gpuScore":22,"ramGb":8,"storageGb":512,"storageType":"SSD","displaySize":15.6,"displayResolution":"1920 × 1080","displayType":"IPS","refreshRate":60,"batteryHours":8,"weightKg":1.76,"os":"Windows 11 Home","ports":"USB-C, 3× USB-A, HDMI, RJ-45, 3.5 mm jack"},"stock":25,"featured":false,"is_active":true,"created_at":"2026-11-17T05:23:22.103Z"},{"id":"9767499a-3e8c-4de8-ae05-d1d9cace0dca","slug":"hp-15s-ryzen-5","name":"HP 15s (Ryzen 5)","brand":"HP","category_slug":"everyday","tagline":"Reliable value for home and campus.","description":"Thin, light and efficient with a micro-edge display and fast charging that gets you back to 50% in about 45 minutes.","price":42990,"mrp":52990,"images":["preset:everyday"],"specs":{"cpu":"AMD Ryzen 5 7520U","cpuScore":46,"gpu":"AMD Radeon Graphics","gpuScore":20,"ramGb":8,"storageGb":512,"storageType":"SSD","displaySize":15.6,"displayResolution":"1920 × 1080","displayType":"IPS","refreshRate":60,"batteryHours":9,"weightKg":1.69,"os":"Windows 11 Home","ports":"USB-C, 2× USB-A, HDMI, SD card, 3.5 mm jack"},"stock":30,"featured":false,"is_active":true,"created_at":"2026-11-17T05:23:22.103Z"},{"id":"3d19698b-0672-4237-8992-a21b3735d264","slug":"samsung-galaxy-book4-pro","name":"Samsung Galaxy Book4 Pro","brand":"Samsung","category_slug":"ultrabook","tagline":"Dynamic AMOLED in a whisper-thin frame.","description":"An ultra-thin ultrabook with a vivid AMOLED 2X display, Intel Core Ultra power and seamless pairing with Galaxy devices.","price":131990,"mrp":157990,"images":["preset:ultrabook"],"specs":{"cpu":"Intel Core Ultra 7 155H","cpuScore":80,"gpu":"Intel Arc Graphics","gpuScore":40,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":14,"displayResolution":"2880 × 1800","displayType":"Dynamic AMOLED 2X touch","refreshRate":120,"batteryHours":15,"weightKg":1.23,"os":"Windows 11 Home","ports":"2× Thunderbolt 4, USB-A, HDMI, microSD, 3.5 mm jack"},"stock":3,"featured":false,"is_active":true,"created_at":"2026-11-17T05:23:22.103Z"}]'::jsonb) as x(
  id uuid, slug text, name text, brand text, category_slug text, tagline text, description text,
  price numeric, mrp numeric, images jsonb, specs jsonb, stock int, featured boolean, is_active boolean, created_at timestamptz
)
on conflict (slug) do nothing;
-- Expand every existing storefront category to at least six distinct laptops.
-- Preset images resolve to bundled local assets, so no remote image URL is required.
insert into public.products
  (id, slug, name, brand, category_slug, tagline, description, price, mrp, images, specs, stock, featured, is_active, created_at)
values
  (gen_random_uuid(), 'lenovo-yoga-slim-7i', 'Lenovo Yoga Slim 7i', 'Lenovo', 'ultrabook', 'Lenovo performance for ultrabook users.', 'Lenovo Yoga Slim 7i pairs Intel Core Ultra 7 155H performance with 16 GB memory and 1 TB SSD storage.', 104990, 117589, '["preset:ultrabook"]'::jsonb, '{"cpu":"Intel Core Ultra 7 155H","cpuScore":80,"gpu":"Intel Arc Graphics","gpuScore":40,"ramGb":16,"storageGb":1024,"storageType":"SSD","displaySize":14,"displayResolution":"2880 × 1800","displayType":"OLED","refreshRate":120,"batteryHours":14,"weightKg":1.39,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 13, false, true, now()),
  (gen_random_uuid(), 'hp-pavilion-aero-13', 'HP Pavilion Aero 13', 'HP', 'ultrabook', 'HP performance for ultrabook users.', 'HP Pavilion Aero 13 pairs AMD Ryzen 7 8840U performance with 16 GB memory and 512 GB SSD storage.', 89990, 100789, '["preset:ultrabook"]'::jsonb, '{"cpu":"AMD Ryzen 7 8840U","cpuScore":76,"gpu":"AMD Radeon 780M","gpuScore":44,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":13.3,"displayResolution":"2560 × 1600","displayType":"IPS","refreshRate":60,"batteryHours":11,"weightKg":0.99,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 16, false, true, now()),
  (gen_random_uuid(), 'asus-zenbook-14-oled', 'ASUS Zenbook 14 OLED', 'ASUS', 'ultrabook', 'ASUS performance for ultrabook users.', 'ASUS Zenbook 14 OLED pairs Intel Core Ultra 5 125H performance with 16 GB memory and 512 GB SSD storage.', 99990, 111989, '["preset:ultrabook"]'::jsonb, '{"cpu":"Intel Core Ultra 5 125H","cpuScore":68,"gpu":"Intel Arc Graphics","gpuScore":38,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":14,"displayResolution":"2880 × 1800","displayType":"OLED touch","refreshRate":120,"batteryHours":13,"weightKg":1.28,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 10, false, true, now()),
  (gen_random_uuid(), 'msi-katana-15', 'MSI Katana 15', 'MSI', 'gaming', 'MSI performance for gaming users.', 'MSI Katana 15 pairs Intel Core i7-13620H performance with 16 GB memory, RTX graphics and fast 144 Hz play.', 109990, 123189, '["preset:gaming"]'::jsonb, '{"cpu":"Intel Core i7-13620H","cpuScore":73,"gpu":"NVIDIA GeForce RTX 4060 8GB","gpuScore":78,"ramGb":16,"storageGb":1024,"storageType":"SSD","displaySize":15.6,"displayResolution":"1920 × 1080","displayType":"IPS","refreshRate":144,"batteryHours":5,"weightKg":2.25,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 9, false, true, now()),
  (gen_random_uuid(), 'hp-omen-16', 'HP Omen 16', 'HP', 'gaming', 'HP performance for gaming users.', 'HP Omen 16 pairs AMD Ryzen 7 8845HS performance with 16 GB memory and an RTX graphics card.', 139990, 156789, '["preset:gaming"]'::jsonb, '{"cpu":"AMD Ryzen 7 8845HS","cpuScore":79,"gpu":"NVIDIA GeForce RTX 4060 8GB","gpuScore":78,"ramGb":16,"storageGb":1024,"storageType":"SSD","displaySize":16.1,"displayResolution":"2560 × 1440","displayType":"IPS","refreshRate":165,"batteryHours":6,"weightKg":2.36,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 7, false, true, now()),
  (gen_random_uuid(), 'dell-g15-5530', 'Dell G15 5530', 'Dell', 'gaming', 'Dell performance for gaming users.', 'Dell G15 5530 pairs Intel Core i7-13650HX performance with 16 GB memory and RTX 4050 graphics.', 119990, 134389, '["preset:gaming"]'::jsonb, '{"cpu":"Intel Core i7-13650HX","cpuScore":81,"gpu":"NVIDIA GeForce RTX 4050 6GB","gpuScore":66,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":15.6,"displayResolution":"1920 × 1080","displayType":"IPS","refreshRate":165,"batteryHours":5,"weightKg":2.65,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 12, false, true, now()),
  (gen_random_uuid(), 'dell-latitude-5450', 'Dell Latitude 5450', 'Dell', 'business', 'Dell performance for business users.', 'Dell Latitude 5450 combines Intel Core Ultra 5 135U performance with Windows 11 Pro and business security features.', 139990, 156789, '["preset:business"]'::jsonb, '{"cpu":"Intel Core Ultra 5 135U","cpuScore":65,"gpu":"Intel Graphics","gpuScore":28,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":14,"displayResolution":"1920 × 1200","displayType":"IPS","refreshRate":60,"batteryHours":12,"weightKg":1.4,"os":"Windows 11 Pro","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 8, false, true, now()),
  (gen_random_uuid(), 'asus-expertbook-b5', 'ASUS ExpertBook B5', 'ASUS', 'business', 'ASUS performance for business users.', 'ASUS ExpertBook B5 pairs Intel Core Ultra 7 155U with Windows 11 Pro and 1 TB SSD storage.', 124990, 139989, '["preset:business"]'::jsonb, '{"cpu":"Intel Core Ultra 7 155U","cpuScore":73,"gpu":"Intel Graphics","gpuScore":30,"ramGb":16,"storageGb":1024,"storageType":"SSD","displaySize":14,"displayResolution":"1920 × 1200","displayType":"IPS","refreshRate":60,"batteryHours":13,"weightKg":1.29,"os":"Windows 11 Pro","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 11, false, true, now()),
  (gen_random_uuid(), 'hp-probook-440-g11', 'HP ProBook 440 G11', 'HP', 'business', 'HP performance for business users.', 'HP ProBook 440 G11 provides Intel Core Ultra 5 performance, a 14-inch display and Windows 11 Pro.', 94990, 106389, '["preset:business"]'::jsonb, '{"cpu":"Intel Core Ultra 5 125U","cpuScore":62,"gpu":"Intel Graphics","gpuScore":27,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":14,"displayResolution":"1920 × 1200","displayType":"IPS","refreshRate":60,"batteryHours":10,"weightKg":1.39,"os":"Windows 11 Pro","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 15, false, true, now()),
  (gen_random_uuid(), 'acer-travelmate-p2', 'Acer TravelMate P2', 'Acer', 'business', 'Acer performance for business users.', 'Acer TravelMate P2 is a practical office laptop with Intel Core i5, 16 GB memory and Windows 11 Pro.', 79990, 89589, '["preset:business"]'::jsonb, '{"cpu":"Intel Core i5-1335U","cpuScore":54,"gpu":"Intel Iris Xe Graphics","gpuScore":22,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":14,"displayResolution":"1920 × 1080","displayType":"IPS","refreshRate":60,"batteryHours":9,"weightKg":1.6,"os":"Windows 11 Pro","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 18, false, true, now()),
  (gen_random_uuid(), 'dell-xps-16', 'Dell XPS 16', 'Dell', 'creator', 'Dell performance for creator users.', 'Dell XPS 16 pairs Intel Core Ultra 7 with 32 GB memory, RTX graphics and a 16-inch OLED display.', 229990, 257589, '["preset:creator"]'::jsonb, '{"cpu":"Intel Core Ultra 7 155H","cpuScore":84,"gpu":"NVIDIA GeForce RTX 4060 8GB","gpuScore":78,"ramGb":32,"storageGb":1024,"storageType":"SSD","displaySize":16.3,"displayResolution":"3200 × 2000","displayType":"OLED touch","refreshRate":120,"batteryHours":10,"weightKg":2.13,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 5, false, true, now()),
  (gen_random_uuid(), 'lenovo-yoga-pro-9i', 'Lenovo Yoga Pro 9i', 'Lenovo', 'creator', 'Lenovo performance for creator users.', 'Lenovo Yoga Pro 9i pairs Intel Core Ultra 9 with 32 GB memory and a 165 Hz Mini LED display.', 199990, 223989, '["preset:creator"]'::jsonb, '{"cpu":"Intel Core Ultra 9 185H","cpuScore":91,"gpu":"NVIDIA GeForce RTX 4060 8GB","gpuScore":78,"ramGb":32,"storageGb":1024,"storageType":"SSD","displaySize":16,"displayResolution":"3200 × 2000","displayType":"Mini LED","refreshRate":165,"batteryHours":8,"weightKg":2.18,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 6, false, true, now()),
  (gen_random_uuid(), 'asus-vivobook-pro-15-oled', 'ASUS Vivobook Pro 15 OLED', 'ASUS', 'creator', 'ASUS performance for creator users.', 'ASUS Vivobook Pro 15 OLED pairs Intel Core i7 with RTX graphics and a vivid 120 Hz OLED panel.', 149990, 167989, '["preset:creator"]'::jsonb, '{"cpu":"Intel Core i7-13700H","cpuScore":79,"gpu":"NVIDIA GeForce RTX 4050 6GB","gpuScore":66,"ramGb":16,"storageGb":1024,"storageType":"SSD","displaySize":15.6,"displayResolution":"2880 × 1620","displayType":"OLED","refreshRate":120,"batteryHours":7,"weightKg":1.8,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 9, false, true, now()),
  (gen_random_uuid(), 'acer-swift-x-14', 'Acer Swift X 14', 'Acer', 'creator', 'Acer performance for creator users.', 'Acer Swift X 14 combines Intel Core Ultra 7 and RTX 4050 graphics in a portable 14.5-inch OLED laptop.', 159990, 179189, '["preset:creator"]'::jsonb, '{"cpu":"Intel Core Ultra 7 155H","cpuScore":82,"gpu":"NVIDIA GeForce RTX 4050 6GB","gpuScore":66,"ramGb":16,"storageGb":1024,"storageType":"SSD","displaySize":14.5,"displayResolution":"2880 × 1800","displayType":"OLED","refreshRate":120,"batteryHours":9,"weightKg":1.55,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 8, false, true, now()),
  (gen_random_uuid(), 'dell-inspiron-14-2-in-1', 'Dell Inspiron 14 2-in-1', 'Dell', 'convertible', 'Dell performance for convertible users.', 'Dell Inspiron 14 2-in-1 combines a responsive touchscreen, Intel Core 7 and flexible hinge design.', 89990, 100789, '["preset:convertible"]'::jsonb, '{"cpu":"Intel Core 7 150U","cpuScore":67,"gpu":"Intel Graphics","gpuScore":28,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":14,"displayResolution":"1920 × 1200","displayType":"IPS touch","refreshRate":60,"batteryHours":10,"weightKg":1.75,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 14, false, true, now()),
  (gen_random_uuid(), 'asus-zenbook-duo-ux8406', 'ASUS Zenbook Duo', 'ASUS', 'convertible', 'ASUS performance for convertible users.', 'ASUS Zenbook Duo offers two OLED touch displays, Intel Core Ultra 9 and 32 GB memory for flexible work.', 199990, 223989, '["preset:convertible"]'::jsonb, '{"cpu":"Intel Core Ultra 9 185H","cpuScore":91,"gpu":"Intel Arc Graphics","gpuScore":45,"ramGb":32,"storageGb":1024,"storageType":"SSD","displaySize":14,"displayResolution":"2880 × 1800","displayType":"Dual OLED touch","refreshRate":120,"batteryHours":9,"weightKg":1.65,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 4, false, true, now()),
  (gen_random_uuid(), 'hp-envy-x360-14', 'HP Envy x360 14', 'HP', 'convertible', 'HP performance for convertible users.', 'HP Envy x360 14 pairs AMD Ryzen 7 with a bright OLED touchscreen and flexible 360-degree hinge.', 109990, 123189, '["preset:convertible"]'::jsonb, '{"cpu":"AMD Ryzen 7 8840HS","cpuScore":78,"gpu":"AMD Radeon 780M","gpuScore":44,"ramGb":16,"storageGb":1024,"storageType":"SSD","displaySize":14,"displayResolution":"2880 × 1800","displayType":"OLED touch","refreshRate":120,"batteryHours":11,"weightKg":1.39,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 11, false, true, now()),
  (gen_random_uuid(), 'acer-spin-5', 'Acer Spin 5', 'Acer', 'convertible', 'Acer performance for convertible users.', 'Acer Spin 5 is a light 2-in-1 with Intel Core i7, pen-ready touch display and 1 TB SSD.', 99990, 111989, '["preset:convertible"]'::jsonb, '{"cpu":"Intel Core i7-1360P","cpuScore":74,"gpu":"Intel Iris Xe Graphics","gpuScore":34,"ramGb":16,"storageGb":1024,"storageType":"SSD","displaySize":14,"displayResolution":"2560 × 1600","displayType":"IPS touch","refreshRate":60,"batteryHours":10,"weightKg":1.3,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 7, false, true, now()),
  (gen_random_uuid(), 'lenovo-ideapad-slim-3', 'Lenovo IdeaPad Slim 3', 'Lenovo', 'everyday', 'Lenovo performance for everyday work.', 'Lenovo IdeaPad Slim 3 provides Ryzen 5 performance, 16 GB memory and a comfortable 15.6-inch display.', 54990, 61589, '["preset:everyday"]'::jsonb, '{"cpu":"AMD Ryzen 5 7530U","cpuScore":52,"gpu":"AMD Radeon Graphics","gpuScore":22,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":15.6,"displayResolution":"1920 × 1080","displayType":"IPS","refreshRate":60,"batteryHours":8,"weightKg":1.62,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 22, false, true, now()),
  (gen_random_uuid(), 'dell-inspiron-15-3530', 'Dell Inspiron 15', 'Dell', 'everyday', 'Dell performance for everyday work.', 'Dell Inspiron 15 pairs Intel Core i5 and 16 GB memory with a smooth 120 Hz Full HD display.', 59990, 67189, '["preset:everyday"]'::jsonb, '{"cpu":"Intel Core i5-1335U","cpuScore":54,"gpu":"Intel Iris Xe Graphics","gpuScore":22,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":15.6,"displayResolution":"1920 × 1080","displayType":"IPS","refreshRate":120,"batteryHours":8,"weightKg":1.65,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 19, false, true, now()),
  (gen_random_uuid(), 'asus-vivobook-15-x1504', 'ASUS Vivobook 15', 'ASUS', 'everyday', 'ASUS performance for everyday work.', 'ASUS Vivobook 15 brings Intel Core i5, 16 GB memory and fast SSD storage to study and home use.', 52990, 59349, '["preset:everyday"]'::jsonb, '{"cpu":"Intel Core i5-1335U","cpuScore":54,"gpu":"Intel Iris Xe Graphics","gpuScore":22,"ramGb":16,"storageGb":512,"storageType":"SSD","displaySize":15.6,"displayResolution":"1920 × 1080","displayType":"IPS","refreshRate":60,"batteryHours":8,"weightKg":1.7,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 17, false, true, now()),
  (gen_random_uuid(), 'lenovo-v15-g4', 'Lenovo V15 G4', 'Lenovo', 'everyday', 'Lenovo performance for everyday work.', 'Lenovo V15 G4 is a practical value laptop with Ryzen 5, 8 GB memory and a 512 GB SSD.', 47990, 53749, '["preset:everyday"]'::jsonb, '{"cpu":"AMD Ryzen 5 7520U","cpuScore":46,"gpu":"AMD Radeon Graphics","gpuScore":20,"ramGb":8,"storageGb":512,"storageType":"SSD","displaySize":15.6,"displayResolution":"1920 × 1080","displayType":"IPS","refreshRate":60,"batteryHours":7,"weightKg":1.65,"os":"Windows 11 Home","ports":"USB-C, USB-A, HDMI, 3.5 mm jack"}'::jsonb, 20, false, true, now())
on conflict (slug) do nothing;
