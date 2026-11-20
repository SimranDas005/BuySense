-- Extend the existing owner-scoped commerce tables for BuySense's local seed
-- catalogue. Keep UUID product references and rows intact for legacy products.
-- Seed catalogue rows use product_slug because those products do not exist as
-- UUID records in public.products.

alter table public.cart_items
  add column if not exists product_slug text;
alter table public.cart_items
  alter column product_id drop not null;

alter table public.wishlists
  add column if not exists product_slug text;
alter table public.wishlists
  alter column product_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.cart_items'::regclass
      and conname = 'cart_items_product_reference_check'
  ) then
    alter table public.cart_items
      add constraint cart_items_product_reference_check
      check (
        (product_id is not null and product_slug is null)
        or (product_id is null and product_slug is not null)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.wishlists'::regclass
      and conname = 'wishlists_product_reference_check'
  ) then
    alter table public.wishlists
      add constraint wishlists_product_reference_check
      check (
        (product_id is not null and product_slug is null)
        or (product_id is null and product_slug is not null)
      );
  end if;
end;
$$;

-- The existing UUID uniqueness indexes remain in place. PostgreSQL permits
-- multiple NULL product IDs, while these indexes enforce one seed item per
-- user and slug.
create unique index if not exists cart_items_user_slug_key
  on public.cart_items (user_id, product_slug);
create unique index if not exists wishlists_user_slug_key
  on public.wishlists (user_id, product_slug);

-- RLS, grants, user foreign keys, product UUID foreign keys and existing
-- owner policies are intentionally left unchanged.
