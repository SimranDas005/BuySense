-- BuySense: single Supabase auth system, role-based access control and RLS.
-- Apply with `supabase db push` or paste into the Supabase SQL editor.
-- Safe to re-run: every object is created with IF NOT EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------------------
-- 1. Profiles: roles, contact info, delivery address
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists address jsonb;
alter table public.profiles add column if not exists role text;

-- Preserve any existing administrator assignments from the legacy user_roles
-- table before filling missing or invalid profile roles with customer.
update public.profiles p
set role = 'admin'
from public.user_roles ur
where ur.user_id = p.id
  and ur.role::text = 'admin';

update public.profiles set role = 'customer' where role is null or role not in ('customer', 'admin');
alter table public.profiles alter column role set default 'customer';
alter table public.profiles alter column role set not null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer', 'admin'));

-- Define the helper only after profiles.role exists. Policies and RPCs below
-- depend on this function.
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
create unique index if not exists products_slug_key on public.products (slug);

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
-- 4. Enable RLS and add BuySense policies only when their names are absent.
--    Existing policies are not dropped or replaced by this migration.
-- ---------------------------------------------------------------------------

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

-- Products: public read, admin writes.
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

-- Orders and items: only readable by their owner or an admin. All writes go
-- through SECURITY DEFINER RPCs so stock changes and ownership are atomic.
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- Carts and wishlists are private to their owner.
grant select, insert, update, delete on public.cart_items to authenticated;
grant select, insert, delete on public.wishlists to authenticated;

create unique index if not exists cart_items_user_product_key on public.cart_items (user_id, product_id);
create unique index if not exists wishlists_user_product_key on public.wishlists (user_id, product_id);

-- Reviews and decision history: owners only; admins may moderate reviews.
grant select, insert, update, delete on public.reviews to authenticated;
grant select, insert, update, delete on public.decision_history to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own_or_admin') then
    execute $policy$create policy "profiles_select_own_or_admin" on public.profiles
      for select to authenticated
      using (id = auth.uid() or public.is_admin())$policy$;
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'products_public_read') then
    execute $policy$create policy "products_public_read" on public.products
      for select to anon, authenticated
      using (is_active)$policy$;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'products_admin_read') then
    execute $policy$create policy "products_admin_read" on public.products
      for select to authenticated
      using (public.is_admin())$policy$;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'products_admin_insert') then
    execute $policy$create policy "products_admin_insert" on public.products
      for insert to authenticated with check (public.is_admin())$policy$;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'products_admin_update') then
    execute $policy$create policy "products_admin_update" on public.products
      for update to authenticated
      using (public.is_admin()) with check (public.is_admin())$policy$;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'products_admin_delete') then
    execute $policy$create policy "products_admin_delete" on public.products
      for delete to authenticated using (public.is_admin())$policy$;
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'orders_owner_or_admin') then
    execute $policy$create policy "orders_owner_or_admin" on public.orders
      for select to authenticated
      using (user_id = auth.uid() or public.is_admin())$policy$;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_items' and policyname = 'order_items_owner_or_admin') then
    execute $policy$create policy "order_items_owner_or_admin" on public.order_items
      for select to authenticated
      using (
        exists (select 1 from public.orders o where o.id = order_id
                and (o.user_id = auth.uid() or public.is_admin()))
      )$policy$;
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cart_items' and policyname = 'cart_items_owner') then
    execute $policy$create policy "cart_items_owner" on public.cart_items
      for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid())$policy$;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'wishlists' and policyname = 'wishlists_owner') then
    execute $policy$create policy "wishlists_owner" on public.wishlists
      for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid())$policy$;
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reviews' and policyname = 'reviews_owner_or_admin') then
    execute $policy$create policy "reviews_owner_or_admin" on public.reviews
      for all to authenticated
      using (user_id = auth.uid() or public.is_admin())
      with check (user_id = auth.uid())$policy$;
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'decision_history' and policyname = 'decision_history_owner') then
    execute $policy$create policy "decision_history_owner" on public.decision_history
      for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid())$policy$;
  end if;
end $$;

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
