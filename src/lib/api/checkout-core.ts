import { SEED_PRODUCTS } from "../seed-products";

export type CheckoutRequestItem = { productId: string; quantity: number };
export type CartDatabaseRow = {
  id: string;
  product_id: string | null;
  product_slug: string | null;
  quantity: number;
};
export type DatabaseProduct = {
  id: string;
  slug: string | null;
  model: string | null;
  brand: string | null;
  image_url: string | null;
  price: number;
  stock: number;
  is_active: boolean;
};
export type PreparedOrderItem = {
  productId: string;
  databaseProductId: string | null;
  name: string;
  brand: string;
  image: string;
  unitPrice: number;
  quantity: number;
};

const isSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function prepareOrderItems(
  cartRows: CartDatabaseRow[],
  requestedItems: CheckoutRequestItem[],
  products: DatabaseProduct[],
): PreparedOrderItem[] {
  if (!cartRows.length) throw new Error("Your bag is empty.");
  if (requestedItems.length !== cartRows.length) {
    throw new Error("Your bag changed. Please review it and try again.");
  }
  if (
    requestedItems.some(
      (item) =>
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        (item.productId.startsWith("seed-")
          ? !isSlug(item.productId.slice(5))
          : !isUuid(item.productId)),
    )
  ) {
    throw new Error("Your bag contains an invalid item.");
  }

  const requestedById = new Map<string, number>();
  for (const item of requestedItems) {
    if (requestedById.has(item.productId)) {
      throw new Error("Your bag contains a duplicate item.");
    }
    requestedById.set(item.productId, item.quantity);
  }

  const productsById = new Map(products.map((product) => [product.id, product]));
  const productsBySlug = new Map(
    products.filter((product) => product.slug).map((product) => [product.slug!, product]),
  );
  const seedsBySlug = new Map(SEED_PRODUCTS.map((product) => [product.slug, product]));
  const resolvedIds = new Set<string>();

  return cartRows.map((row) => {
    if (!Number.isSafeInteger(row.quantity) || row.quantity < 1) {
      throw new Error("Your bag contains an invalid quantity.");
    }

    let databaseProduct: DatabaseProduct | undefined;
    let seedProduct: (typeof SEED_PRODUCTS)[number] | undefined;
    let submittedId: string;

    if (row.product_id) {
      databaseProduct = productsById.get(row.product_id);
      if (!databaseProduct?.is_active) {
        throw new Error("A product in your bag is no longer available.");
      }
      submittedId = databaseProduct.id;
    } else {
      const slug = row.product_slug;
      if (!slug || !isSlug(slug)) {
        throw new Error("A product in your bag has an invalid catalogue reference.");
      }
      databaseProduct = productsBySlug.get(slug);
      if (databaseProduct && !databaseProduct.is_active) {
        throw new Error("A product in your bag is no longer available.");
      }
      if (databaseProduct) {
        submittedId = databaseProduct.id;
      } else {
        seedProduct = seedsBySlug.get(slug);
        if (!seedProduct) throw new Error("A product in your bag is not in the catalogue.");
        submittedId = `seed-${slug}`;
      }
    }

    if (requestedById.get(submittedId) !== row.quantity) {
      throw new Error("Your bag changed. Please review it and try again.");
    }
    if (resolvedIds.has(submittedId)) {
      throw new Error("Your bag contains the same product more than once.");
    }
    resolvedIds.add(submittedId);

    const name = databaseProduct?.model?.trim() || seedProduct?.name;
    const price = databaseProduct?.price ?? seedProduct?.price;
    const stock = databaseProduct?.stock ?? seedProduct?.stock;
    if (!name || !Number.isFinite(price) || price <= 0) {
      throw new Error("A product in your bag has invalid trusted catalogue data.");
    }
    if (!Number.isSafeInteger(stock) || stock < row.quantity) {
      throw new Error(`${name} does not have enough stock for this order.`);
    }

    return {
      productId: submittedId,
      databaseProductId: databaseProduct?.id ?? null,
      name,
      brand: databaseProduct?.brand ?? seedProduct?.brand ?? "",
      image:
        databaseProduct?.image_url ??
        seedProduct?.images[0] ??
        "",
      unitPrice: price,
      quantity: row.quantity,
    };
  });
}
