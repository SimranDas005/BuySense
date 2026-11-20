import { createFileRoute } from "@tanstack/react-router";
import { Eye, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/common/page-header";
import { OrderDetailCard } from "@/components/orders/order-detail";
import { useAllOrders, useUpdateOrderStatus } from "@/hooks/use-shop";
import { formatDate, formatINR } from "@/lib/format";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type Order, type OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/orders")({
  component: OrdersAdmin,
});

function OrdersAdmin() {
  const { data: orders = [], isLoading } = useAllOrders();
  const update = useUpdateOrderStatus();
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<Order | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return orders.filter(
      (o) => (filter === "all" || o.status === filter) && (!t || `${o.orderNumber} ${o.customerName} ${o.customerEmail}`.toLowerCase().includes(t)),
    );
  }, [orders, filter, q]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Sales" title="Orders" description="Update an order's status as it moves from placement to delivery." />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-full bg-secondary p-1">
          {(["all", ...ORDER_STATUSES] as const).map((s) => {
            const count = s === "all" ? orders.length : orders.filter((o) => o.status === s).length;
            return (
              <button key={s} onClick={() => setFilter(s)} className={cn("rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all", filter === s ? "bg-card shadow-soft" : "text-muted-foreground")}>
                {s === "all" ? "All" : ORDER_STATUS_LABELS[s]} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order number or customer" className="rounded-full bg-card pl-9" aria-label="Search orders" />
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-4">Order</th><th className="p-4">Customer</th><th className="p-4">Items</th><th className="p-4">Total</th><th className="p-4">Status</th><th className="p-4" /></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="p-4"><Skeleton className="h-20" /></td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">{orders.length ? "No orders match these filters." : "No orders have been placed yet."}</td></tr>
              ) : (
                list.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="p-4"><p className="font-semibold">{o.orderNumber}</p><p className="text-xs text-muted-foreground">{formatDate(o.createdAt, true)}</p></td>
                    <td className="p-4"><p>{o.customerName}</p><p className="text-xs text-muted-foreground">{o.customerEmail}</p></td>
                    <td className="p-4 text-muted-foreground">{o.items.reduce((s, i) => s + i.quantity, 0)} units</td>
                    <td className="p-4 tabular-nums font-medium">{formatINR(o.total)}<p className="text-xs font-normal text-muted-foreground">Cash on Delivery</p></td>
                    <td className="p-4">
                      <Select value={o.status} disabled={o.status === "cancelled" || o.status === "delivered" || update.isPending} onValueChange={(v) => update.mutate({ id: o.id, status: v as OrderStatus })}>
                        <SelectTrigger className="h-9 w-36 rounded-full" aria-label={`Status for ${o.orderNumber}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="p-4 text-right"><Button size="icon-sm" variant="ghost" aria-label={`View ${o.orderNumber}`} onClick={() => setViewing(o)}><Eye /></Button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>Order details</DialogTitle></DialogHeader>
          {viewing && <OrderDetailCard order={orders.find((o) => o.id === viewing.id) ?? viewing} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
