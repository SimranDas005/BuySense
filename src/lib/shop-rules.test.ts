import { describe, expect, it } from "vitest";
import { addToCompareList, MAX_COMPARE } from "./compare-store";
import { summarizeCart } from "./cart-math";
import type { Product } from "./types";

const product = (id: string, price: number, stock: number): Product => ({
  id,
  slug: id,
  name: id,
  brand: "Test",
  category: "everyday",
  tagline: "",
  description: "",
  price,
  mrp: price,
  images: [],
  stock,
  featured: false,
  specs: {
    cpu: "Test", cpuScore: 50, gpu: "Test", gpuScore: 50,
    ramGb: 16, storageGb: 512, storageType: "SSD", displaySize: 14,
    displayResolution: "1920x1080", displayType: "IPS", refreshRate: 60,
    batteryHours: 10, weightKg: 1.5, os: "Test", ports: "Test",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("compare", () => {
  it("allows at most 5 laptops", () => {
    expect(MAX_COMPARE).toBe(5);
    let ids: string[] = [];
    for (const id of ["a", "b", "c", "d", "e"]) ids = addToCompareList(ids, id).ids;
    const sixth = addToCompareList(ids, "f");
    expect(sixth.ok).toBe(false);
    expect(sixth.ids).toHaveLength(5);
  });
});

describe("cart totals", () => {
  it("keeps Cash on Delivery shipping free and clamps to stock", () => {
    const products = [product("a", 1000, 3)];
    const summary = summarizeCart([{ productId: "a", quantity: 2 }], products);
    expect(summary.subtotal).toBe(2000);
    expect(summary.shippingFee).toBe(0);
    expect(summary.total).toBe(2000);

    const over = summarizeCart([{ productId: "a", quantity: 10 }], products);
    expect(over.lines[0]!.exceedsStock).toBe(true);
  });
});
