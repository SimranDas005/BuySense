import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { clampQuantity } from "../cart-math";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type Address,
  type CartLine,
  type Order,
  type OrderItem,
  type OrderStatus,
} from "../types";
import { SEED_PRODUCTS } from "../seed-products";
import { getCurrentUser, requireAdmin, requireCustomer } from "./auth";
import { listProducts } from "./catalog";
import { ApiError, toApiError } from "./errors";
import { readTable, writeTable } from "./local-db";
import { placeCodOrder } from "./checkout.functions";

const GUEST = "guest";
type GuestCarts = Record<string, CartLine[]>;
const guestCarts = () => readTable<GuestCarts>("carts", {});
const saveGuestCart = (lines: CartLine[]) => writeTable("carts", { ...guestCarts(), [GUEST]: lines });
const isSeedProduct = (productId: string) => productId.startsWith("seed-");

async function findCartRow(userId: string, product: { id: string; slug: string }) {
  const bySlug = await supabase
    .from("cart_items")
    .select("id, product_id, product_slug, quantity")
    .eq("user_id", userId)
    .eq("product_slug", product.slug)
    .maybeSingle();
  if (bySlug.error) throw toApiError(bySlug.error, "Could not update your bag.");
  if (bySlug.data) return bySlug.data;
  if (isSeedProduct(product.id)) return null;

  const byId = await supabase
    .from("cart_items")
    .select("id, product_id, product_slug, quantity")
    .eq("user_id", userId)
    .eq("product_id", product.id)
    .maybeSingle();
  if (byId.error) throw toApiError(byId.error, "Could not update your bag.");
  return byId.data;
}

async function findWishlistRow(userId: string, product: { id: string; slug: string }) {
  const bySlug = await supabase
    .from("wishlists")
    .select("id, product_id, product_slug")
    .eq("user_id", userId)
    .eq("product_slug", product.slug)
    .maybeSingle();
  if (bySlug.error) throw toApiError(bySlug.error, "Could not update your wishlist.");
  if (bySlug.data) return bySlug.data;
  if (isSeedProduct(product.id)) return null;

  const byId = await supabase
    .from("wishlists")
    .select("id, product_id, product_slug")
    .eq("user_id", userId)
    .eq("product_id", product.id)
    .maybeSingle();
  if (byId.error) throw toApiError(byId.error, "Could not update your wishlist.");
  return byId.data;
}

async function persistCartItem(
  userId: string,
  reference: { productId: string | null; productSlug: string | null },
  quantity: number,
) {
  if (quantity === 0) {
    const query = supabase.from("cart_items").delete().eq("user_id", userId);
    const { error } = reference.productId
      ? await query.eq("product_id", reference.productId).is("product_slug", null)
      : await query.eq("product_slug", reference.productSlug).is("product_id", null);
    if (error) throw toApiError(error, "Could not update your bag.");
    return;
  }

  const conflict = reference.productId ? "user_id,product_id" : "user_id,product_slug";
  const { error } = await supabase.from("cart_items").upsert(
    {
      user_id: userId,
      product_id: reference.productId,
      product_slug: reference.productSlug,
      quantity,
    },
    { onConflict: conflict },
  );
  if (error) throw toApiError(error, "Could not update your bag.");
}

function cartReference(
  product: { id: string; slug: string },
  existingRow?: { product_id: string | null; product_slug: string | null } | null,
) {
  if (existingRow) {
    return { productId: existingRow.product_id, productSlug: existingRow.product_slug };
  }
  return isSeedProduct(product.id)
    ? { productId: null, productSlug: product.slug }
    : { productId: product.id, productSlug: null };
}

export type OrderRow = {
  id: string;
  order_number: string;
  user_id: string;
  order_status: string;
  payment_status: string;
  payment_method: string;
  subtotal: number;
  discount: number | null;
  delivery_fee: number | null;
  total_amount: number;
  address: string;
  address_data?: unknown;
  phone: string;
  customer_name?: string | null;
  customer_email?: string | null;
  items?: unknown;
  status_history?: unknown;
  created_at: string | null;
};

function decodeAddress(value: string, addressData?: unknown): {
  address: Address | null;
  customerName: string | null;
  customerEmail: string | null;
} {
  const isAddress = (candidate: unknown): candidate is Address =>
    !!candidate &&
    typeof candidate === "object" &&
    ["fullName", "phone", "line1", "line2", "city", "state", "pincode"].every(
      (key) => typeof (candidate as Record<string, unknown>)[key] === "string",
    );

  if (isAddress(addressData)) {
    return { address: addressData, customerName: addressData.fullName, customerEmail: null };
  }
  if (addressData && typeof addressData === "object") {
    const snapshot = addressData as Record<string, unknown>;
    if (isAddress(snapshot["address"])) {
      return {
        address: snapshot["address"],
        customerName: snapshot["address"].fullName,
        customerEmail:
          typeof snapshot["customerEmail"] === "string" ? snapshot["customerEmail"] : null,
      };
    }
  }

  try {
    const snapshot: unknown = JSON.parse(value);
    if (snapshot && typeof snapshot === "object") {
      const envelope = snapshot as Record<string, unknown>;
      if (isAddress(envelope["address"])) {
        return {
          address: envelope["address"],
          customerName: envelope["address"].fullName,
          customerEmail:
            typeof envelope["customerEmail"] === "string" ? envelope["customerEmail"] : null,
        };
      }
    }
  } catch {
    // Older orders store a plain-text street address in this column.
  }

  return { address: null, customerName: null, customerEmail: null };
}

function rowToOrder(row: OrderRow, orderItems?: OrderItem[]): Order {
  const statusFromDatabase = (value: string): OrderStatus | undefined =>
    ORDER_STATUSES.find(
      (candidate) =>
        candidate === value.toLowerCase() ||
        ORDER_STATUS_LABELS[candidate] === value,
    );
  const status = statusFromDatabase(row.order_status) ?? "pending";
  const history = Array.isArray(row.status_history)
    ? row.status_history.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const event = entry as Record<string, unknown>;
        const eventStatus =
          typeof event["status"] === "string"
            ? statusFromDatabase(event["status"])
            : undefined;
        return eventStatus && typeof event["at"] === "string"
          ? [{ status: eventStatus, at: event["at"] }]
          : [];
      })
    : [];
  const snapshot = decodeAddress(row.address, row.address_data);
  const items = orderItems?.length
    ? orderItems
    : (Array.isArray(row.items) ? row.items : []) as OrderItem[];
  return {
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id,
    customerName: row.customer_name ?? snapshot.customerName ?? "Customer",
    customerEmail: row.customer_email ?? snapshot.customerEmail ?? "",
    items,
    subtotal: row.subtotal,
    shippingFee: row.delivery_fee ?? 0,
    total: row.total_amount,
    paymentMethod: "cod",
    status,
    address: snapshot.address ?? {
      fullName: row.customer_name ?? "",
      phone: row.phone ?? "",
      line1: row.address ?? "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
    },
    createdAt: row.created_at ?? new Date().toISOString(),
    statusHistory: history.length ? history : [{ status, at: row.created_at ?? new Date().toISOString() }],
  };
}

async function loadOrderItems(orderRows: OrderRow[]): Promise<Map<string, OrderItem[]>> {
  const orderIds = orderRows.map((order) => order.id);
  const grouped = new Map<string, OrderItem[]>();
  if (!orderIds.length) return grouped;

  const { data, error } = await supabase
    .from("order_items")
    .select("id, order_id, product_id, product_name, quantity, unit_price, subtotal")
    .in("order_id", orderIds);
  if (error) throw toApiError(error, "Could not load order items.");

  const productsById = new Map(
    (await listProducts()).map((product) => [product.id, product]),
  );
  for (const item of data ?? []) {
    const seed = SEED_PRODUCTS.find(
      (product) => product.name === item.product_name,
    );
    const product = item.product_id ? productsById.get(item.product_id) : undefined;
    const orderItem: OrderItem = {
      productId: item.product_id ?? (seed ? `seed-${seed.slug}` : `order-item-${item.id}`),
      name: item.product_name,
      brand: product?.brand ?? seed?.brand ?? "",
      image: product?.images[0] ?? seed?.images[0] ?? "",
      unitPrice: item.unit_price,
      quantity: item.quantity,
    };
    grouped.set(item.order_id, [...(grouped.get(item.order_id) ?? []), orderItem]);
  }
  return grouped;
}

export async function getCart(): Promise<CartLine[]> {
  const user = await getCurrentUser();
  if (user?.role === "admin") {
    throw new ApiError("Cart features are available to customer accounts only.");
  }
  if (!user) return guestCarts()[GUEST] ?? [];
  const { data, error } = await supabase
    .from("cart_items")
    .select("product_id, product_slug, quantity")
    .eq("user_id", user.id);
  if (error) throw toApiError(error, "Could not load your bag.");
  const products = await listProducts();
  const idsBySlug = new Map(products.map((product) => [product.slug, product.id]));
  return (data ?? []).flatMap((r) => {
    const productId = r.product_slug
      ? idsBySlug.get(r.product_slug) ?? `seed-${r.product_slug}`
      : r.product_id;
    return productId ? [{ productId, quantity: r.quantity }] : [];
  });
}

export async function addToCart(productId: string, quantity = 1): Promise<void> {
  const user = await getCurrentUser();
  if (user?.role === "admin") {
    throw new ApiError("Cart features are available to customer accounts only.");
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new ApiError("Quantity must be a whole number greater than zero.");
  }
  const product = (await listProducts()).find((p) => p.id === productId);
  if (!product) throw new ApiError("This laptop is no longer available.");
  if (product.stock <= 0) throw new ApiError(`${product.name} is out of stock.`);

  const lines = await getCart();
  const existing = lines.find((l) => l.productId === productId);
  const nextQty = (existing?.quantity ?? 0) + quantity;
  if (nextQty > product.stock) throw new ApiError(`Only ${product.stock} left in stock.`);

  if (!user) {
    saveGuestCart(
      existing
        ? lines.map((l) => (l.productId === productId ? { ...l, quantity: nextQty } : l))
        : [...lines, { productId, quantity: nextQty }],
    );
    return;
  }

  const existingRow = await findCartRow(user.id, product);
  await persistCartItem(user.id, cartReference(product, existingRow), nextQty);
}

export async function setCartQuantity(productId: string, quantity: number): Promise<void> {
  const user = await getCurrentUser();
  if (user?.role === "admin") {
    throw new ApiError("Cart features are available to customer accounts only.");
  }
  if (!Number.isInteger(quantity)) {
    throw new ApiError("Quantity must be a whole number.");
  }
  const products = await listProducts();
  const product = products.find((p) => p.id === productId);
  const lines = await getCart();
  const userId = user?.id;
  const productSlug = product?.slug ?? productId.replace(/^seed-/, "");

  if (!product || quantity <= 0) {
    if (userId) {
      if (product) {
        const existingRow = await findCartRow(userId, product);
        if (!existingRow) return;
        await persistCartItem(userId, cartReference(product, existingRow), 0);
      } else {
        await persistCartItem(
          userId,
          isSeedProduct(productId)
            ? { productId: null, productSlug }
            : { productId, productSlug: null },
          0,
        );
      }
    } else {
      saveGuestCart(lines.filter((l) => l.productId !== productId));
    }
    return;
  }

  if (product.stock <= 0) throw new ApiError(`${product.name} is out of stock.`);

  const q = clampQuantity(quantity, product.stock);
  if (userId) {
    const existingRow = await findCartRow(userId, product);
    if (!existingRow) return;
    await persistCartItem(userId, cartReference(product, existingRow), q);
  } else {
    saveGuestCart(lines.map((l) => (l.productId === productId ? { ...l, quantity: q } : l)));
  }
}

export async function removeFromCart(productId: string): Promise<void> {
  await setCartQuantity(productId, 0);
}

/** Moves the signed-out bag into the authenticated user's RLS-protected cart. */
export async function mergeGuestCart(userId: string): Promise<void> {
  const customer = await requireCustomer();
  if (customer.id !== userId) throw new ApiError("You can only restore your own cart.");
  const guest = guestCarts()[GUEST] ?? [];
  if (!guest.length) return;
  const { data: existing, error: loadError } = await supabase
    .from("cart_items")
    .select("product_id, product_slug, quantity")
    .eq("user_id", userId);
  if (loadError) throw toApiError(loadError, "Could not restore your bag.");

  const products = await listProducts();
  const merged = new Map<string, number>();
  for (const line of existing ?? []) {
    const product = line.product_slug
      ? products.find((p) => p.slug === line.product_slug)
      : products.find((p) => p.id === line.product_id);
    if (product?.stock && product.stock > 0) {
      merged.set(product.id, Math.min(line.quantity, product.stock));
    }
  }
  for (const line of guest) {
    const stock = products.find((p) => p.id === line.productId)?.stock ?? 0;
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || stock < 1) continue;
    merged.set(line.productId, Math.min((merged.get(line.productId) ?? 0) + line.quantity, stock));
  }

  for (const [productId, quantity] of merged) {
    const product = products.find((item) => item.id === productId);
    if (!product) continue;
    const existingRow = await findCartRow(userId, product);
    await persistCartItem(cartReference(product, existingRow), quantity);
  }
  saveGuestCart([]);
}

/* ---------------- Wishlist ---------------- */

export async function getWishlist(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  await requireCustomer();
  const userId = user.id;
  const { data, error } = await supabase
    .from("wishlists")
    .select("product_id, product_slug")
    .eq("user_id", userId);
  if (error) throw toApiError(error, "Could not load your wishlist.");
  const products = await listProducts();
  const idsBySlug = new Map(products.map((product) => [product.slug, product.id]));
  return (data ?? []).flatMap((r) => {
    const productId = r.product_slug ? idsBySlug.get(r.product_slug) : r.product_id;
    return productId ? [productId] : [];
  });
}

export async function toggleWishlist(productId: string): Promise<boolean> {
  const me = await requireCustomer();
  const product = (await listProducts()).find((item) => item.id === productId);
  if (!product) throw new ApiError("This laptop is no longer available.");
  const existing = await findWishlistRow(me.id, product);

  if (existing) {
    const { error } = await supabase
      .from("wishlists")
      .delete()
      .eq("user_id", me.id)
      .eq("id", existing.id);
    if (error) throw toApiError(error, "Could not update your wishlist.");
    return false;
  }
  const { error } = await supabase
    .from("wishlists")
    .insert(
      isSeedProduct(product.id)
        ? { user_id: me.id, product_id: null, product_slug: product.slug }
        : { user_id: me.id, product_id: product.id, product_slug: null },
    );
  if (error) throw toApiError(error, "Could not update your wishlist.");
  return true;
}

/* ---------------- Orders ---------------- */

export async function placeOrder(address: Address): Promise<Order> {
  const me = await requireCustomer();
  const lines = await getCart();
  if (!lines.length) throw new ApiError("Your bag is empty.");

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw toApiError(sessionError, "Could not validate your session.");
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new ApiError("Please sign in again before placing your order.");

  const result = await placeCodOrder({
    data: {
      accessToken,
      address,
      items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    },
  });
  if (!result.cartCleared) {
    toast.warning("Your order was placed, but your bag could not be cleared. Please review it.");
  }
  return rowToOrder(
    {
      ...result.order,
      address_data: result.address,
      customer_name: result.address.fullName,
      customer_email: result.customerEmail,
      items: result.items,
    } as OrderRow,
    result.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      brand: item.brand,
      image: item.image,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    })),
  );
}

export async function listMyOrders(): Promise<Order[]> {
  const me = await requireCustomer();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false });
  if (error) throw toApiError(error, "Could not load your orders.");
  const orderRows = (data ?? []) as OrderRow[];
  const items = await loadOrderItems(orderRows);
  return orderRows.map((row) => rowToOrder(row, items.get(row.id)));
}

export async function getOrder(id: string): Promise<Order | null> {
  await requireCustomer();
  const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw toApiError(error, "Could not load this order.");
  // RLS returns null for another customer's order; admins may read any order.
  if (!data) return null;
  const row = data as OrderRow;
  const items = await loadOrderItems([row]);
  return rowToOrder(row, items.get(row.id));
}

export async function listAllOrders(): Promise<Order[]> {
  await requireAdmin();
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw toApiError(error, "Could not load orders.");
  const orderRows = (data ?? []) as OrderRow[];
  const items = await loadOrderItems(orderRows);
  return orderRows.map((row) => rowToOrder(row, items.get(row.id)));
}

/** Admin status change. The RPC enforces the admin role on the server. */
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  await requireAdmin();
  const { data, error } = await supabase.rpc("change_order_status", {
    p_order_id: id,
    p_status: ORDER_STATUS_LABELS[status],
  });
  if (error) throw toApiError(error, "Could not update this order.");
  return rowToOrder(data);
}

/** Customer cancellation. The RPC verifies ownership and order state. */
export async function cancelMyOrder(id: string): Promise<Order> {
  await requireCustomer();
  const { data, error } = await supabase.rpc("change_order_status", {
    p_order_id: id,
    p_status: ORDER_STATUS_LABELS.cancelled,
  });
  if (error) throw toApiError(error, "Could not cancel this order.");
  return rowToOrder(data);
}
