import { CATEGORY_LABELS, ORDER_STATUSES, type Order, type Product } from "./types";

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const live = (orders: Order[]) => orders.filter((o) => o.status !== "cancelled");

export function filterByRange(orders: Order[], days: number | null, now = new Date()): Order[] {
  if (!days) return orders;
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (days - 1));
  return orders.filter((o) => new Date(o.createdAt) >= from);
}

export function dailySeries(orders: Order[], days: number, now = new Date()) {
  const map = new Map<string, { revenue: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    map.set(dayKey(d), { revenue: 0, orders: 0 });
  }
  for (const o of live(orders)) {
    const k = dayKey(new Date(o.createdAt));
    const e = map.get(k);
    if (e) {
      e.revenue += o.total;
      e.orders += 1;
    }
  }
  return [...map.entries()].map(([date, v]) => ({
    date,
    label: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    ...v,
  }));
}

export function revenueByCategory(orders: Order[], products: Product[]) {
  const map = new Map<string, number>();
  for (const o of live(orders)) {
    for (const it of o.items) {
      const p = products.find((x) => x.id === it.productId);
      const label = p ? CATEGORY_LABELS[p.category] : "Removed products";
      map.set(label, (map.get(label) ?? 0) + it.unitPrice * it.quantity);
    }
  }
  return [...map.entries()].map(([category, revenue]) => ({ category, revenue })).sort((a, b) => b.revenue - a.revenue);
}

export function ordersByStatus(orders: Order[]) {
  return ORDER_STATUSES.map((status) => ({ status, count: orders.filter((o) => o.status === status).length })).filter((s) => s.count > 0);
}

export function topProducts(orders: Order[], limit = 5) {
  const map = new Map<string, { name: string; units: number; revenue: number }>();
  for (const o of live(orders)) {
    for (const it of o.items) {
      const e = map.get(it.productId) ?? { name: it.name, units: 0, revenue: 0 };
      e.units += it.quantity;
      e.revenue += it.unitPrice * it.quantity;
      map.set(it.productId, e);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export function ordersToCsv(orders: Order[]): string {
  const head = ["Order number", "Date", "Customer", "Email", "Items", "Units", "Total (INR)", "Status", "City", "State"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = orders.map((o) =>
    [o.orderNumber, o.createdAt, o.customerName, o.customerEmail, o.items.map((i) => i.name).join("; "), o.items.reduce((s, i) => s + i.quantity, 0), o.total, o.status, o.address.city, o.address.state].map(esc).join(","),
  );
  return [head.map(esc).join(","), ...rows].join("\n");
}
