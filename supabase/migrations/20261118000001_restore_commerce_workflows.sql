-- Add only the order snapshots consumed by the storefront. Existing orders
-- and order items remain intact; all additions are nullable or have defaults.
alter table public.orders
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists pincode text,
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists status_history jsonb not null default '[]'::jsonb,
  add column if not exists address_data jsonb;

alter table public.order_items
  add column if not exists brand text,
  add column if not exists image text;

update public.orders o
set customer_name = coalesce(o.customer_name, p.full_name),
    customer_email = coalesce(o.customer_email, p.email)
from public.profiles p
where p.id = o.user_id
  and (o.customer_name is null or o.customer_email is null);

update public.orders
set address_line1 = coalesce(address_line1, address, ''),
    address_data = coalesce(
      address_data,
      jsonb_build_object(
        'fullName', coalesce(customer_name, ''),
        'phone', phone,
        'line1', coalesce(address, ''),
        'line2', coalesce(address_line2, ''),
        'city', coalesce(city, ''),
        'state', coalesce(state, ''),
        'pincode', coalesce(pincode, '')
      )
    )
where address_line1 is null or address_data is null;

update public.order_items oi
set brand = coalesce(oi.brand, p.brand),
    image = coalesce(oi.image, p.image_url)
from public.products p
where p.id = oi.product_id
  and (oi.brand is null or oi.image is null);

update public.orders o
set items = (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'productId', coalesce(oi.product_id::text, 'legacy-' || oi.id::text),
        'name', oi.product_name,
        'brand', coalesce(oi.brand, ''),
        'image', coalesce(oi.image, ''),
        'unitPrice', oi.unit_price,
        'quantity', oi.quantity
      )
      order by oi.id
    ),
    '[]'::jsonb
  )
  from public.order_items oi
  where oi.order_id = o.id
)
where o.items = '[]'::jsonb
  and exists (select 1 from public.order_items oi where oi.order_id = o.id);

update public.orders
set status_history = jsonb_build_array(
  jsonb_build_object('status', order_status, 'at', created_at)
)
where status_history = '[]'::jsonb;

-- Orders are built from the caller's own database cart. Product details and
-- prices come only from active public.products rows; no stock is reserved.
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
  v_cart_row record;
  v_product public.products%rowtype;
  v_product_id uuid;
  v_product_ids uuid[] := array[]::uuid[];
  v_cart_row_ids uuid[] := array[]::uuid[];
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_item_count integer;
  v_name text;
  v_customer_email text;
  v_order_number text;
  v_subtotal numeric := 0;
begin
  if v_user is null then
    raise exception 'Please sign in to continue.';
  end if;
  if not exists (
    select 1 from public.user_roles
    where user_id = v_user and role::text = 'customer'
  ) or exists (
    select 1 from public.user_roles
    where user_id = v_user and role::text = 'admin'
  ) then
    raise exception 'Checkout is available to customer accounts only.';
  end if;
  if p_address is null
    or nullif(btrim(p_address ->> 'fullName'), '') is null
    or nullif(btrim(p_address ->> 'phone'), '') is null
    or nullif(btrim(p_address ->> 'line1'), '') is null
    or nullif(btrim(p_address ->> 'city'), '') is null
    or nullif(btrim(p_address ->> 'state'), '') is null
    or nullif(btrim(p_address ->> 'pincode'), '') is null then
    raise exception 'Enter your name, phone number, and complete delivery address.';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Your bag is invalid. Please review it and try again.';
  end if;

  select count(*) into v_item_count
  from public.cart_items
  where user_id = v_user;
  if v_item_count = 0 then
    raise exception 'Your bag is empty.';
  end if;
  if v_item_count <> jsonb_array_length(p_items) then
    raise exception 'Your bag changed. Please review it and try again.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) as submitted(item)
    where jsonb_typeof(submitted.item -> 'productId') is distinct from 'string'
      or coalesce(submitted.item ->> 'productId', '') = ''
      or jsonb_typeof(submitted.item -> 'quantity') is distinct from 'number'
      or coalesce(submitted.item ->> 'quantity', '') !~ '^[1-9][0-9]*$'
  ) then
    raise exception 'Your bag contains an invalid item.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) as submitted(item)
    group by submitted.item ->> 'productId'
    having count(*) > 1
  ) then
    raise exception 'Your bag contains a duplicate item.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) as submitted(item)
    where (
      select count(*)
      from public.cart_items ci
      where ci.user_id = v_user
        and ci.quantity = (submitted.item ->> 'quantity')::integer
        and (
          ci.product_id::text = (submitted.item ->> 'productId')
          or ('seed-' || ci.product_slug) = (submitted.item ->> 'productId')
          or exists (
            select 1 from public.products p
            where p.slug = ci.product_slug
              and p.id::text = (submitted.item ->> 'productId')
              and p.is_active
          )
        )
    ) <> 1
  ) then
    raise exception 'Your bag changed. Please review it and try again.';
  end if;

  for v_cart_row in
    select id, product_id, product_slug, quantity
    from public.cart_items
    where user_id = v_user
    order by id
    for update
  loop
    if v_cart_row.quantity < 1 then
      raise exception 'Your bag contains an invalid quantity.';
    end if;

    if v_cart_row.product_id is not null then
      select * into v_product
      from public.products
      where id = v_cart_row.product_id and is_active;
    else
      select * into v_product
      from public.products
      where slug = v_cart_row.product_slug and is_active;
    end if;
    if not found then
      raise exception 'A product in your bag has no active database listing.';
    end if;

    v_product_id := v_product.id;
    if v_product_id = any(v_product_ids) then
      raise exception 'Your bag contains the same product more than once.';
    end if;
    if v_product.price is null or v_product.price <= 0 then
      raise exception 'A product in your bag has an invalid database price.';
    end if;
    if v_product.stock is null or v_product.stock < v_cart_row.quantity then
      raise exception 'A product in your bag has insufficient database stock.';
    end if;

    v_name := nullif(btrim(v_product.model), '');
    if v_name is null then
      raise exception 'A product in your bag has no name in the database.';
    end if;

    v_product_ids := array_append(v_product_ids, v_product_id);
    v_cart_row_ids := array_append(v_cart_row_ids, v_cart_row.id);
    v_subtotal := v_subtotal + v_product.price * v_cart_row.quantity;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'productId', v_product_id::text,
      'name', v_name,
      'brand', coalesce(v_product.brand, ''),
      'image', coalesce(v_product.image_url, ''),
      'unitPrice', v_product.price,
      'quantity', v_cart_row.quantity
    ));
  end loop;

  select coalesce(nullif(email, ''), p_customer_email, '')
  into v_customer_email
  from public.profiles
  where id = v_user;
  v_customer_email := coalesce(v_customer_email, p_customer_email, '');
  v_order_number := 'BS-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(gen_random_uuid()::text, 1, 8));

  insert into public.orders (
    id, order_number, user_id, order_status, payment_method, payment_status,
    subtotal, discount, delivery_fee, total_amount, address, phone, created_at,
    address_line1, address_line2, city, state, pincode,
    customer_name, customer_email, items, status_history, address_data
  )
  values (
    gen_random_uuid(), v_order_number, v_user, 'pending', 'cod', 'unpaid',
    v_subtotal, 0, 0, v_subtotal, p_address ->> 'line1', p_address ->> 'phone', now(),
    p_address ->> 'line1', nullif(p_address ->> 'line2', ''),
    p_address ->> 'city', p_address ->> 'state', p_address ->> 'pincode',
    coalesce(nullif(btrim(p_customer_name), ''), p_address ->> 'fullName'),
    v_customer_email, v_items,
    jsonb_build_array(jsonb_build_object('status', 'pending', 'at', now())),
    p_address
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    insert into public.order_items (
      order_id, product_id, product_name, brand, image, quantity, unit_price, subtotal
    )
    values (
      v_order.id,
      (v_item ->> 'productId')::uuid,
      v_item ->> 'name',
      v_item ->> 'brand',
      v_item ->> 'image',
      (v_item ->> 'quantity')::integer,
      (v_item ->> 'unitPrice')::numeric,
      (v_item ->> 'unitPrice')::numeric * (v_item ->> 'quantity')::integer
    );
  end loop;

  delete from public.cart_items
  where user_id = v_user and id = any(v_cart_row_ids);

  return v_order;
end;
$$;

revoke all on function public.place_order(jsonb, jsonb, text, text) from public, anon;
grant execute on function public.place_order(jsonb, jsonb, text, text) to authenticated;

-- Customers may cancel their own pending or confirmed orders. Only admins
-- may progress orders. No inventory is changed because checkout reserves none.
create or replace function public.change_order_status(p_order_id uuid, p_status text)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_order public.orders;
  v_is_admin boolean;
begin
  if v_user is null then
    raise exception 'Please sign in to continue.';
  end if;
  if p_status is null
    or p_status not in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') then
    raise exception 'Unknown order status.';
  end if;

  select exists (
    select 1 from public.user_roles
    where user_id = v_user and role::text = 'admin'
  ) into v_is_admin;
  if not v_is_admin and not exists (
    select 1 from public.user_roles
    where user_id = v_user and role::text = 'customer'
  ) then
    raise exception 'Order management is available to customer accounts only.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'Order not found.';
  end if;
  if not v_is_admin and v_order.user_id <> v_user then
    raise exception 'This order does not belong to you.';
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
  else
    if not v_is_admin then
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

  update public.orders
  set order_status = p_status,
      payment_status = case
        when p_status = 'cancelled' and payment_status = 'unpaid' then 'unpaid'
        when p_status = 'cancelled' then 'refunded'
        else payment_status
      end,
      status_history = coalesce(status_history, '[]'::jsonb) ||
        jsonb_build_object('status', p_status, 'at', now())
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.change_order_status(uuid, text) from public, anon;
grant execute on function public.change_order_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
