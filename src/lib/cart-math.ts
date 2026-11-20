import type { CartLine, Product } from "./types";

export interface DetailedCartLine {
  product: Product;
  quantity: number;
  lineTotal: number;
  /** Requested quantity is more than is in stock. */
  exceedsStock: boolean;
}

export interface CartSummary {
  lines: DetailedCartLine[];
  itemCount: number;
  subtotal: number;
  savings: number;
  shippingFee: number;
  total: number;
  hasIssues: boolean;
}

/** Shipping is free on every order; payment is Cash on Delivery. */
export const SHIPPING_FEE = 0;

export function clampQuantity(requested: number, stock: number): number {
  if (stock <= 0) return 0;
  return Math.max(1, Math.min(Math.floor(requested), stock));
}

export function summarizeCart(lines: CartLine[], products: Product[]): CartSummary {
  const detailed: DetailedCartLine[] = [];
  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId);
    if (!product) continue;
    detailed.push({
      product,
      quantity: line.quantity,
      lineTotal: product.price * line.quantity,
      exceedsStock: line.quantity > product.stock,
    });
  }
  const subtotal = detailed.reduce((s, l) => s + l.lineTotal, 0);
  const savings = detailed.reduce(
    (s, l) => s + Math.max(0, l.product.mrp - l.product.price) * l.quantity,
    0,
  );
  const shippingFee = detailed.length ? SHIPPING_FEE : 0;
  return {
    lines: detailed,
    itemCount: detailed.reduce((s, l) => s + l.quantity, 0),
    subtotal,
    savings,
    shippingFee,
    total: subtotal + shippingFee,
    hasIssues: detailed.some((l) => l.exceedsStock),
  };
}
