-- Restore status changes for the existing orders table. Status values match
-- orders_status_valid exactly; no table, policy, or constraint is changed.
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
  v_is_customer boolean;
begin
  if v_user is null then
    raise exception 'Please sign in to continue.';
  end if;

  if p_status is null
    or p_status not in (
      'Pending',
      'Confirmed',
      'Processing',
      'Shipped',
      'Delivered',
      'Cancelled'
    ) then
    raise exception 'Unknown order status.';
  end if;

  select
    coalesce(bool_or(role::text = 'admin'), false),
    coalesce(bool_or(role::text = 'customer'), false)
  into v_is_admin, v_is_customer
  from public.user_roles
  where user_id = v_user;

  if not v_is_admin and not v_is_customer then
    raise exception 'Order management is available to customer accounts only.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'Order not found.';
  end if;

  if not v_is_admin then
    if v_order.user_id <> v_user then
      raise exception 'This order does not belong to you.';
    end if;
    if p_status <> 'Cancelled'
      or v_order.order_status not in ('Pending', 'Confirmed') then
      raise exception 'Customers may only cancel their own pending or confirmed orders.';
    end if;
  elsif v_order.order_status in ('Cancelled', 'Delivered') then
    if v_order.order_status = p_status then
      return v_order;
    end if;
    raise exception 'This order can no longer be changed.';
  end if;

  if v_order.order_status = p_status then
    return v_order;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'status_history'
  ) then
    execute
      'update public.orders
       set order_status = $1,
           status_history = coalesce(status_history, ''[]''::jsonb) ||
             jsonb_build_array(jsonb_build_object(''status'', $1, ''at'', now()))
       where id = $2
       returning *'
    into v_order
    using p_status, p_order_id;
  else
    update public.orders
    set order_status = p_status
    where id = p_order_id
    returning * into v_order;
  end if;

  return v_order;
end;
$$;

revoke all on function public.change_order_status(uuid, text) from public, anon;
grant execute on function public.change_order_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
