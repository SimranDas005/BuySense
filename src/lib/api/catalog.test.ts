import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        then: (
          resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown,
          reject: (reason: unknown) => unknown,
        ) => Promise.resolve({ data: state.rows, error: null }).then(resolve, reject),
      };
      return query;
    },
  },
}));

import { listProducts } from "./catalog";

describe("legacy database catalogue checkout pricing", () => {
  beforeEach(() => {
    state.rows = [
      {
        id: "9be8b8c4-06a8-490c-a27d-312383cdc887",
        slug: "macbook-air-13-m3",
        model: "MacBook Air 13 (M3)",
        brand: "Apple",
        price: 110000,
        original_price: 119000,
        stock: 14,
        image_url: "preset:ultrabook",
        is_active: true,
      },
    ];
  });

  it("shows database price and stock for matching seed products", async () => {
    const products = await listProducts();
    expect(products.find((product) => product.slug === "macbook-air-13-m3")).toMatchObject({
      id: "9be8b8c4-06a8-490c-a27d-312383cdc887",
      name: "MacBook Air 13 (M3)",
      price: 110000,
      stock: 14,
    });
  });

  it("does not treat an unmatched seed product as database-backed", async () => {
    const products = await listProducts();
    expect(products.find((product) => product.slug === "lenovo-yoga-slim-7i")?.id).toBe(
      "seed-lenovo-yoga-slim-7i",
    );
  });
});
