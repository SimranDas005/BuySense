import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  currentUser: { id: "customer-1", role: "customer" as "customer" | "admin" },
  cartRows: [] as {
    id: string;
    user_id: string;
    product_id: string | null;
    product_slug: string | null;
    quantity: number;
  }[],
  sessionToken: "valid-customer-access-token",
  serverProducts: [] as {
    id: string;
    slug: string;
    model: string;
    brand: string;
    image_url: string;
    price: number;
    stock: number;
  }[],
  orders: [] as Record<string, unknown>[],
  orderItems: [] as Record<string, unknown>[],
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  checkoutCalls: [] as { accessToken: string; items: { productId: string; quantity: number }[] }[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: state.sessionToken } },
        error: null,
      }),
    },
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      let operation = "select";
      let updateValues: Record<string, unknown> = {};
      const rows = () =>
        table === "cart_items"
          ? state.cartRows
          : table === "order_items"
            ? state.orderItems
            : state.orders;
      const matches = (row: Record<string, unknown>) =>
        Object.entries(filters).every(([key, value]) =>
          Array.isArray(value) ? value.includes(row[key]) : row[key] === value,
        );
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return query;
        },
        in: (key: string, value: unknown[]) => {
          filters[key] = value;
          return query;
        },
        order: () => query,
        maybeSingle: async () => ({ data: rows().find(matches) ?? null, error: null }),
        upsert: async (value: Record<string, unknown>, options: { onConflict: string }) => {
          const conflictField = options.onConflict.split(",")[1];
          const current = rows().find(
            (row) =>
              row["user_id"] === value["user_id"] && row[conflictField] === value[conflictField],
          );
          if (current) Object.assign(current, value);
          else rows().push({ ...value, id: `cart-row-${state.cartRows.length + 1}` });
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
          resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown,
          reject: (reason: unknown) => unknown,
        ) => {
          if (operation === "delete") {
            if (table === "cart_items") {
              state.cartRows = state.cartRows.filter((row) => !matches(row));
            } else if (table === "order_items") {
              state.orderItems = state.orderItems.filter((row) => !matches(row));
            } else {
              state.orders = state.orders.filter((row) => !matches(row));
            }
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
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      const order = state.orders.find((row) => row["id"] === args["p_order_id"]);
      if (!order) return { data: null, error: new Error("Order not found.") };
      order["order_status"] = args["p_status"];
      const history = order["status_history"] as { status: string; at: string }[];
      order["status_history"] = [
        ...history,
        { status: args["p_status"] as string, at: "2026-11-18T00:01:00.000Z" },
      ];
      return { data: order, error: null };
    },
  },
}));

vi.mock("./checkout.functions", () => ({
  placeCodOrder: async ({
    data,
  }: {
    data: {
      accessToken: string;
      address: Record<string, string>;
      items: { productId: string; quantity: number }[];
    };
  }) => {
    if (data.accessToken !== state.sessionToken) throw new Error("Invalid session.");
    if (state.currentUser.role !== "customer") throw new Error("Checkout is available to customer accounts only.");
    state.checkoutCalls.push({ accessToken: data.accessToken, items: data.items });
    const cartRows = state.cartRows.filter((row) => row.user_id === state.currentUser.id);
    if (cartRows.length !== data.items.length) {
      throw new Error("Your bag changed. Please review it and try again.");
    }

    const resolved = cartRows.map((row) => {
      const databaseProduct = row.product_id
        ? state.serverProducts.find((product) => product.id === row.product_id)
        : state.serverProducts.find((product) => product.slug === row.product_slug);
      const seedProduct = row.product_id
        ? undefined
        : row.product_slug === "macbook-air-13-m3"
          ? {
              id: `seed-${row.product_slug}`,
              name: "MacBook Air 13 (M3)",
              brand: "Apple",
              image: "preset:ultrabook",
              price: 114900,
              stock: 5,
            }
          : undefined;
      const product = databaseProduct
        ? {
            id: databaseProduct.id,
            name: databaseProduct.model,
            brand: databaseProduct.brand,
            image: databaseProduct.image_url,
            price: databaseProduct.price,
            stock: databaseProduct.stock,
          }
        : seedProduct;
      if (!product) throw new Error("A product in your bag is not in the catalogue.");
      if (product.stock < row.quantity) throw new Error(`${product.name} does not have enough stock.`);
      const expectedId = databaseProduct?.id ?? seedProduct?.id;
      if (
        !data.items.some(
          (item) => item.productId === expectedId && item.quantity === row.quantity,
        )
      ) {
        throw new Error("Your bag changed. Please review it and try again.");
      }
      return {
        productId: expectedId!,
        databaseProductId: databaseProduct?.id ?? null,
        name: product.name,
        brand: product.brand,
        image: product.image,
        unitPrice: product.price,
        quantity: row.quantity,
      };
    });

    const subtotal = resolved.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const orderId = `order-${state.orders.length + 1}`;
    const addressSnapshot = JSON.stringify({
      version: 1,
      address: data.address,
      customerEmail: "customer@example.com",
    });
    const order = {
      id: orderId,
      order_number: `BS-261118-${state.orders.length + 1}`,
      user_id: state.currentUser.id,
      order_status: "Pending",
      payment_status: "Pending",
      payment_method: "cod",
      subtotal,
      discount: 0,
      delivery_fee: 0,
      total_amount: subtotal,
      address: addressSnapshot,
      phone: data.address.phone,
      created_at: "2026-11-18T00:00:00.000Z",
      status_history: [{ status: "pending", at: "2026-11-18T00:00:00.000Z" }],
    };
    state.orders.push(order);
    state.orderItems.push(
      ...resolved.map((item, index) => ({
        id: `order-item-${index + 1}`,
        order_id: orderId,
        product_id: item.databaseProductId,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.unitPrice * item.quantity,
      })),
    );
    const processedIds = new Set(cartRows.map((row) => row.id));
    state.cartRows = state.cartRows.filter((row) => !processedIds.has(row.id));
    return {
      order,
      items: resolved,
      address: data.address,
      customerEmail: "customer@example.com",
      cartCleared: true,
    };
  },
}));

vi.mock("./auth", () => ({
  getCurrentUser: async () => state.currentUser,
  requireCustomer: async () => {
    if (state.currentUser.role !== "customer") throw new Error("Customer access required.");
    return state.currentUser;
  },
  requireAdmin: async () => {
    if (state.currentUser.role !== "admin") throw new Error("Administrator access required.");
    return state.currentUser;
  },
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

import {
  addToCart,
  getCart,
  listAllOrders,
  listMyOrders,
  placeOrder,
  updateOrderStatus,
} from "./commerce";

describe("customer and admin order workflows", () => {
  beforeEach(() => {
    state.currentUser = { id: "customer-1", role: "customer" };
    state.cartRows = [];
    state.serverProducts = [
      {
        id: "4b9a34b6-b096-413f-b1df-a9bb8fbd8726",
        slug: "asus-rog-zephyrus-g14",
        model: "ASUS ROG Zephyrus G14",
        brand: "ASUS",
        image_url: "preset:gaming",
        price: 174990,
        stock: 7,
      },
    ];
    state.orders = [];
    state.orderItems = [];
    state.rpcCalls = [];
    state.checkoutCalls = [];
  });

  it("checks out, records order items, exposes customer history, and lets admins manage status", async () => {
    const productId = "4b9a34b6-b096-413f-b1df-a9bb8fbd8726";
    const address = {
      fullName: "Demo Customer",
      phone: "9876543210",
      line1: "12 College Road",
      line2: "",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
    };

    await addToCart(productId, 2);
    await addToCart("seed-macbook-air-13-m3", 1);
    const order = await placeOrder(address);
    expect(order).toMatchObject({
      id: "order-1",
      userId: "customer-1",
      status: "pending",
      total: 464880,
      address,
    });
    expect(state.orders[0]?.["order_status"]).toBe("Pending");
    expect(state.orders[0]?.["payment_status"]).toBe("Pending");
    expect(state.checkoutCalls[0]?.items).toEqual([
      { productId, quantity: 2 },
      { productId: "seed-macbook-air-13-m3", quantity: 1 },
    ]);
    expect(state.orderItems).toEqual([
      {
        id: "order-item-1",
        order_id: "order-1",
        product_id: productId,
        product_name: "ASUS ROG Zephyrus G14",
        quantity: 2,
        unit_price: 174990,
        subtotal: 349980,
      },
      {
        id: "order-item-2",
        order_id: "order-1",
        product_id: null,
        product_name: "MacBook Air 13 (M3)",
        quantity: 1,
        unit_price: 114900,
        subtotal: 114900,
      },
    ]);
    expect(order.items).toMatchObject([
      { name: "ASUS ROG Zephyrus G14", brand: "ASUS", image: "preset:gaming" },
      { name: "MacBook Air 13 (M3)", brand: "Apple", image: "preset:ultrabook" },
    ]);
    expect(await getCart()).toEqual([]);
    expect(await listMyOrders()).toEqual([order]);

    await expect(listAllOrders()).rejects.toThrow("Administrator access required.");
    state.currentUser = { id: "admin-1", role: "admin" };
    expect(await listAllOrders()).toHaveLength(1);
    expect(await updateOrderStatus(order.id, "confirmed")).toMatchObject({
      id: order.id,
      status: "confirmed",
    });
    expect(state.rpcCalls[0]).toMatchObject({
      name: "change_order_status",
      args: { p_order_id: order.id, p_status: "Confirmed" },
    });
    expect(await updateOrderStatus(order.id, "processing")).toMatchObject({
      status: "processing",
    });
    expect(state.orders[0]?.["order_status"]).toBe("Processing");
    expect(state.rpcCalls[1]?.args["p_status"]).toBe("Processing");
    expect(state.rpcCalls.map((call) => call.name)).toEqual([
      "change_order_status",
      "change_order_status",
    ]);
  });

  it("checks out seed products using trusted local price and stock", async () => {
    state.serverProducts = [];
    await addToCart("seed-macbook-air-13-m3", 1);
    const order = await placeOrder({
      fullName: "Demo Customer",
      phone: "9876543210",
      line1: "12 College Road",
      line2: "",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
    });
    expect(order.total).toBe(114900);
    expect(order.items[0]).toMatchObject({
      name: "MacBook Air 13 (M3)",
      brand: "Apple",
      image: "preset:ultrabook",
      unitPrice: 114900,
    });
    expect(state.orders).toHaveLength(1);
    expect(state.orderItems[0]?.product_id).toBeNull();
    expect(state.cartRows).toHaveLength(0);
  });

  it("checks database stock without reserving or changing it", async () => {
    const productId = "4b9a34b6-b096-413f-b1df-a9bb8fbd8726";
    state.serverProducts[0]!.stock = 1;
    await addToCart(productId, 2);

    await expect(
      placeOrder({
        fullName: "Demo Customer",
        phone: "9876543210",
        line1: "12 College Road",
        line2: "",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
      }),
    ).rejects.toThrow("does not have enough stock");
    expect(state.orders).toHaveLength(0);
    expect(state.cartRows).toHaveLength(1);
  });

  it("does not allow an admin account to place a customer order", async () => {
    state.currentUser = { id: "admin-1", role: "admin" };
    await expect(
      placeOrder({
        fullName: "Admin",
        phone: "9876543210",
        line1: "12 College Road",
        line2: "",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
      }),
    ).rejects.toThrow("Customer access required.");
    expect(state.checkoutCalls).toHaveLength(0);
  });
});
