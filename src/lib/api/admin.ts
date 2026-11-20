import type { Order, OrderStatus } from "../types";
import { listCustomers, requireAdmin } from "./auth";
import { listProducts } from "./catalog";
import { listAllOrders as fetchAllOrders, updateOrderStatus as updateOrderStatusRpc } from "./commerce";

export const LOW_STOCK_THRESHOLD = 5;

export async function listAllOrders(): Promise<Order[]> {
  await requireAdmin();
  return fetchAllOrders();
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  await requireAdmin();
  return updateOrderStatusRpc(id, status);
}

export interface DashboardStats {
  revenue: number;
  orders: number;
  openOrders: number;
  customers: number;
  inventoryUnits: number;
  inventoryValue: number;
  products: number;
  lowStock: number;
  outOfStock: number;
}

/** COD revenue counts delivered orders; open orders have not been paid yet. */
export function computeStats(orders: Order[], customers: number, products: Awaited<ReturnType<typeof listProducts>>): DashboardStats {
  const delivered = orders.filter((o) => o.status === "delivered");
  return {
    revenue: delivered.reduce((s, o) => s + o.total, 0),
    orders: orders.length,
    openOrders: orders.filter((o) => ["pending", "confirmed", "shipped"].includes(o.status)).length,
    customers,
    inventoryUnits: products.reduce((s, p) => s + p.stock, 0),
    inventoryValue: products.reduce((s, p) => s + p.stock * p.price, 0),
    products: products.length,
    lowStock: products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length,
    outOfStock: products.filter((p) => p.stock === 0).length,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdmin();
  const [customers, orders, products] = await Promise.all([
    listCustomers(),
    fetchAllOrders(),
    listProducts(),
  ]);
  return computeStats(orders, customers.length, products);
}

export { listCustomers };
