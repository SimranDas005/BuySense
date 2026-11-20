import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  currentUser: { id: "customer-1", role: "customer" as const },
  cartRows: [] as {
    id?: string;
    user_id: string;
    product_id: string | null;
    product_slug: string | null;
    quantity: number;
  }[],
  wishlistRows: [] as {
    id?: string;
    user_id: string;
    product_id: string | null;
    product_slug: string | null;
  }[],
  upserts: [] as unknown[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      let operation = "select";
      let updateValues: Record<string, unknown> = {};
      const rows = () => (table === "cart_items" ? state.cartRows : state.wishlistRows);
      const matches = (row: Record<string, unknown>) =>
        Object.entries(filters).every(([key, value]) => row[key] === value);
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return query;
        },
        is: (key: string, value: unknown) => {
          filters[key] = value;
          return query;
        },
        maybeSingle: async () => ({ data: rows().find(matches) ?? null, error: null }),
        upsert: async (value: unknown, options: { onConflict: string }) => {
          state.upserts.push({ table, value, options });
          const incoming = Array.isArray(value) ? value : [value];
          const conflictField = options.onConflict.split(",")[1];
          for (const row of incoming as Record<string, unknown>[]) {
            const current = rows().find(
              (item) =>
                item["user_id"] === row["user_id"] && item[conflictField] === row[conflictField],
            );
            if (current) Object.assign(current, row);
            else rows().push(row as never);
          }
          return { error: null };
        },
        insert: async (value: Record<string, unknown>) => {
          rows().push({ ...value, id: "wishlist-entry-1" } as never);
          return { error: null };
        },
        update: (value: Record<string, unknown>) => {
          operation = "update";
          updateValues = value;
          return query;
        },
        delete: () => {
          operation = "delete";
          return query;
        },
        then: (
          resolve: (value: { data: unknown[]; error: null }) => unknown,
          reject: (reason: unknown) => unknown,
        ) => {
          if (operation === "delete") {
            const kept = rows().filter((row) => !matches(row));
            if (table === "cart_items") state.cartRows = kept as typeof state.cartRows;
            else state.wishlistRows = kept as typeof state.wishlistRows;
          } else if (operation === "update") {
            rows()
              .filter(matches)
              .forEach((row) => Object.assign(row, updateValues));
          }
          return Promise.resolve({ data: rows().filter(matches), error: null }).then(
            resolve,
            reject,
          );
        },
      };
      return query;
    },
  },
}));

vi.mock("./auth", () => ({
  getCurrentUser: async () => state.currentUser,
  requireCustomer: async () => state.currentUser,
  requireAdmin: async () => state.currentUser,
}));

vi.mock("./catalog", () => ({
  listProducts: async () => [
    {
      id: "seed-macbook-air-13-m3",
      slug: "macbook-air-13-m3",
      name: "MacBook Air 13 (M3)",
      brand: "Apple",
      category: "ultrabook",
      tagline: "",
      description: "",
      price: 114900,
      mrp: 119900,
      images: ["preset:ultrabook"],
      stock: 5,
      featured: true,
      specs: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "4b9a34b6-b096-413f-b1df-a9bb8fbd8726",
      slug: "asus-rog-zephyrus-g14",
      name: "ASUS ROG Zephyrus G14",
      brand: "ASUS",
      category: "gaming",
      tagline: "",
      description: "",
      price: 174990,
      mrp: 199990,
      images: ["preset:gaming"],
      stock: 7,
      featured: true,
      specs: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
}));

import { getCart, getWishlist, addToCart, setCartQuantity, toggleWishlist } from "./commerce";

describe("authenticated catalogue commerce persistence", () => {
  beforeEach(() => {
    state.currentUser = { id: "customer-1", role: "customer" };
    state.cartRows = [];
    state.wishlistRows = [];
    state.upserts = [];
  });

  it("stores a cart line by slug and increments its quantity without duplicating it", async () => {
    await addToCart("seed-macbook-air-13-m3", 1);
    await addToCart("seed-macbook-air-13-m3", 2);

    expect(await getCart()).toEqual([{ productId: "seed-macbook-air-13-m3", quantity: 3 }]);
    expect(state.cartRows).toHaveLength(1);
    expect(state.cartRows[0]).toMatchObject({
      user_id: "customer-1",
      product_id: null,
      product_slug: "macbook-air-13-m3",
      quantity: 3,
    });
    expect(state.upserts).toHaveLength(2);
    expect(state.upserts[1]).toMatchObject({
      table: "cart_items",
      value: {
        user_id: "customer-1",
        product_id: null,
        product_slug: "macbook-air-13-m3",
        quantity: 3,
      },
      options: { onConflict: "user_id,product_slug" },
    });

    await setCartQuantity("seed-macbook-air-13-m3", 4);
    expect(await getCart()).toEqual([{ productId: "seed-macbook-air-13-m3", quantity: 4 }]);
    await setCartQuantity("seed-macbook-air-13-m3", 0);
    expect(await getCart()).toEqual([]);
  });

  it("uses direct owner-scoped database writes rather than an extra cart RPC", async () => {
    await addToCart("seed-macbook-air-13-m3", 1);
    expect(state.upserts).toHaveLength(1);
    expect(await getCart()).toEqual([{ productId: "seed-macbook-air-13-m3", quantity: 1 }]);
  });

  it("toggles wishlist state and returns the app product ID expected by the heart", async () => {
    expect(await toggleWishlist("seed-macbook-air-13-m3")).toBe(true);
    expect(await getWishlist()).toEqual(["seed-macbook-air-13-m3"]);
    expect(await toggleWishlist("seed-macbook-air-13-m3")).toBe(false);
    expect(state.wishlistRows).toHaveLength(0);
  });

  it("keeps UUID-backed cart and wishlist rows editable without replacing them", async () => {
    const productId = "4b9a34b6-b096-413f-b1df-a9bb8fbd8726";
    state.cartRows.push({
      id: "existing-cart-row",
      user_id: "customer-1",
      product_id: productId,
      product_slug: null,
      quantity: 1,
    });
    state.wishlistRows.push({
      id: "existing-wishlist-row",
      user_id: "customer-1",
      product_id: productId,
      product_slug: null,
    });

    await addToCart(productId);
    expect(state.cartRows).toHaveLength(1);
    expect(state.cartRows[0]).toMatchObject({ id: "existing-cart-row", quantity: 2 });
    await setCartQuantity(productId, 4);
    expect(state.cartRows[0]?.quantity).toBe(4);
    await setCartQuantity(productId, 0);
    expect(state.cartRows).toHaveLength(0);

    expect(await toggleWishlist(productId)).toBe(false);
    expect(state.wishlistRows).toHaveLength(0);
  });

  it("stores new UUID-backed items using the existing product foreign key", async () => {
    const productId = "4b9a34b6-b096-413f-b1df-a9bb8fbd8726";
    await addToCart(productId);
    expect(state.cartRows).toEqual([
      {
        user_id: "customer-1",
        product_id: productId,
        product_slug: null,
        quantity: 1,
      },
    ]);
    expect(state.upserts[0]).toMatchObject({
      table: "cart_items",
      value: {
        user_id: "customer-1",
        product_id: productId,
        product_slug: null,
        quantity: 1,
      },
      options: { onConflict: "user_id,product_id" },
    });

    expect(await toggleWishlist(productId)).toBe(true);
    expect(state.wishlistRows).toMatchObject([{ product_id: productId, product_slug: null }]);
  });
});
