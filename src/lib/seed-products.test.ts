import { describe, expect, it } from "vitest";
import { CATEGORIES, type Category } from "./types";
import { PRESET_IMAGES } from "./images";
import { SEED_PRODUCTS } from "./seed-products";
import { filterProducts } from "./catalog-filter";

describe("seed catalogue", () => {
  it("has at least seven distinct products in every storefront category", () => {
    const counts = new Map<Category, number>(CATEGORIES.map((category) => [category, 0]));
    for (const product of SEED_PRODUCTS) {
      counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    }
    for (const category of CATEGORIES) {
      expect(counts.get(category), category).toBeGreaterThanOrEqual(7);
    }
  });

  it("uses unique slugs and bundled image presets for every seed product", () => {
    const slugs = SEED_PRODUCTS.map((product) => product.slug);
    const validImageRefs = new Set(Object.keys(PRESET_IMAGES).map((key) => `preset:${key}`));
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(SEED_PRODUCTS.every((product) => product.images.length > 0 && product.images.every((image) => validImageRefs.has(image)))).toBe(true);
  });

  it("reuses one category image consistently for each seed product", () => {
    const expectedPreset = {
      ultrabook: "preset:ultrabook",
      gaming: "preset:gaming",
      business: "preset:business",
      creator: "preset:creator",
      convertible: "preset:convertible",
      everyday: "preset:everyday",
    };
    for (const product of SEED_PRODUCTS) {
      expect(product.images[0], product.slug).toBe(expectedPreset[product.category]);
    }
  });

  it("contains 42 distinct sample laptops with no duplicate product ids", () => {
    expect(SEED_PRODUCTS).toHaveLength(42);
    const ids = SEED_PRODUCTS.map((p) => p.slug);
    expect(new Set(ids).size).toBe(42);
  });

  it("shows all 42 products with category filters matching each category", () => {
    expect(filterProducts(SEED_PRODUCTS as never, {}).length).toBe(42);
    for (const category of CATEGORIES) {
      const filtered = filterProducts(SEED_PRODUCTS as never, { category });
      expect(filtered).toHaveLength(7);
      expect(filtered.every((product) => product.category === category)).toBe(true);
    }
  });

  it("has complete specification fields on every product record", () => {
    for (const product of SEED_PRODUCTS) {
      expect(product.specs.cpu, product.slug).toBeTruthy();
      expect(product.specs.gpu, product.slug).toBeTruthy();
      expect(product.specs.ramGb, product.slug).toBeGreaterThan(0);
      expect(product.specs.storageGb, product.slug).toBeGreaterThan(0);
      expect(product.specs.displaySize, product.slug).toBeGreaterThan(0);
      expect(product.specs.displayResolution, product.slug).toBeTruthy();
      expect(product.specs.displayType, product.slug).toBeTruthy();
      expect(product.specs.refreshRate, product.slug).toBeGreaterThan(0);
      expect(product.specs.batteryHours, product.slug).toBeGreaterThan(0);
      expect(product.specs.weightKg, product.slug).toBeGreaterThan(0);
      expect(product.specs.os, product.slug).toBeTruthy();
      expect(product.specs.ports, product.slug).toBeTruthy();
    }
  });
});
