import { describe, expect, it } from "vitest";
import {
  prepareOrderItems,
  type CartDatabaseRow,
  type DatabaseProduct,
} from "./checkout-core";

const seedCart: CartDatabaseRow = {
  id: "cart-seed-1",
  product_id: null,
  product_slug: "macbook-air-13-m3",
  quantity: 2,
};

const databaseCart: CartDatabaseRow = {
  id: "cart-db-1",
  product_id: "4b9a34b6-b096-413f-b1df-a9bb8fbd8726",
  product_slug: null,
  quantity: 1,
};

const databaseProduct: DatabaseProduct = {
  id: "4b9a34b6-b096-413f-b1df-a9bb8fbd8726",
  slug: "asus-rog-zephyrus-g14",
  model: "ASUS ROG Zephyrus G14",
  brand: "ASUS",
  image_url: "preset:gaming",
  price: 174990,
  stock: 7,
  is_active: true,
};

describe("trusted COD order item preparation", () => {
  it("uses the local seed catalogue for seed product data, ignoring client prices", () => {
    const [item] = prepareOrderItems(
      [seedCart],
      [{ productId: "seed-macbook-air-13-m3", quantity: 2 }],
      [],
    );
    expect(item).toMatchObject({
      productId: "seed-macbook-air-13-m3",
      databaseProductId: null,
      name: "MacBook Air 13 (M3)",
      brand: "Apple",
      image: "preset:ultrabook",
      unitPrice: 114900,
      quantity: 2,
    });
  });

  it("keeps database-backed products using their database price and stock", () => {
    const [item] = prepareOrderItems(
      [databaseCart],
      [{ productId: databaseProduct.id, quantity: 1 }],
      [databaseProduct],
    );
    expect(item).toMatchObject({
      databaseProductId: databaseProduct.id,
      name: "ASUS ROG Zephyrus G14",
      unitPrice: 174990,
      quantity: 1,
    });
  });

  it("rejects unknown or malformed seed slugs", () => {
    expect(() =>
      prepareOrderItems(
        [{ ...seedCart, product_slug: "not-in-the-seed-catalogue" }],
        [{ productId: "seed-not-in-the-seed-catalogue", quantity: 2 }],
        [],
      ),
    ).toThrow("not in the catalogue");

    expect(() =>
      prepareOrderItems(
        [seedCart],
        [{ productId: "seed-MacBook", quantity: 2 }],
        [],
      ),
    ).toThrow("invalid item");
  });

  it("rejects duplicate items, changed quantities, and unavailable stock", () => {
    expect(() =>
      prepareOrderItems(
        [seedCart],
        [
          { productId: "seed-macbook-air-13-m3", quantity: 2 },
          { productId: "seed-macbook-air-13-m3", quantity: 2 },
        ],
        [],
      ),
    ).toThrow("changed");

    expect(() =>
      prepareOrderItems(
        [seedCart],
        [{ productId: "seed-macbook-air-13-m3", quantity: 1 }],
        [],
      ),
    ).toThrow("changed");

    expect(() =>
      prepareOrderItems(
        [{ ...seedCart, quantity: 100 }],
        [{ productId: "seed-macbook-air-13-m3", quantity: 100 }],
        [],
      ),
    ).toThrow("not have enough stock");
  });

  it("rejects duplicate cart lines and inactive or missing database products", () => {
    expect(() =>
      prepareOrderItems(
        [seedCart, { ...seedCart, id: "cart-seed-2" }],
        [
          { productId: "seed-macbook-air-13-m3", quantity: 2 },
          { productId: "seed-macbook-air-13-m3", quantity: 2 },
        ],
        [],
      ),
    ).toThrow("duplicate");

    expect(() =>
      prepareOrderItems(
        [databaseCart],
        [{ productId: databaseProduct.id, quantity: 1 }],
        [],
      ),
    ).toThrow("no longer available");
    expect(() =>
      prepareOrderItems(
        [databaseCart],
        [{ productId: databaseProduct.id, quantity: 1 }],
        [{ ...databaseProduct, is_active: false }],
      ),
    ).toThrow("no longer available");
  });
});
