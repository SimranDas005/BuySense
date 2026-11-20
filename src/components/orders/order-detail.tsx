import { Link } from "@tanstack/react-router";
import { Banknote, Check, MapPin } from "lucide-react";
import { OrderStatusBadge } from "@/components/common/status-badge";
import { formatDate, formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { ORDER_STATUS_LABELS, type Order, type OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const FLOW: OrderStatus[] = ["pending", "confirmed", "processing", "shipped", "delivered"];

export function OrderTimeline({ order }: { order: Order }) {
  if (order.status === "cancelled") {
    return <p className="rounded-2xl bg-destructive/10 p-4 text-sm font-medium text-destructive">This order was cancelled on {formatDate(order.statusHistory.at(-1)?.at ?? order.createdAt, true)}.</p>;
  }
  const current = FLOW.indexOf(order.status);
  return (
    <ol className="grid grid-cols-5 gap-2">
      {FLOW.map((s, i) => {
        const done = i <= current;
        const at = order.statusHistory.find((h) => h.status === s)?.at;
        return (
          <li key={s} className="flex flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : done ? "bg-brand" : "bg-border")} />
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition-all", done ? "border-brand bg-brand text-brand-foreground" : "bg-card text-muted-foreground")}>
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <div className={cn("h-0.5 flex-1", i === FLOW.length - 1 ? "opacity-0" : i < current ? "bg-brand" : "bg-border")} />
            </div>
            <p className={cn("mt-2 text-xs font-semibold", !done && "text-muted-foreground")}>{ORDER_STATUS_LABELS[s]}</p>
            {at && <p className="text-[11px] text-muted-foreground">{formatDate(at)}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDetailCard({ order }: { order: Order }) {
  const a = order.address;
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Order</p>
            <p className="font-display text-lg font-semibold">{order.orderNumber}</p>
            <p className="text-xs text-muted-foreground">Placed {formatDate(order.createdAt, true)}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <OrderTimeline order={order} />
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="rounded-3xl border bg-card p-6 shadow-soft">
          <h3 className="mb-4 font-semibold">Items</h3>
          <ul className="divide-y">
            {order.items.map((it) => (
              <li key={it.productId} className="flex items-center gap-4 py-3">
                <img src={resolveImage(it.image)} alt="" className="h-14 w-20 rounded-xl bg-surface object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{it.name}</p>
                  <p className="text-xs text-muted-foreground">{it.brand} · {formatINR(it.unitPrice)} × {it.quantity}</p>
                </div>
                <p className="tabular-nums font-semibold">{formatINR(it.unitPrice * it.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatINR(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd>{order.shippingFee ? formatINR(order.shippingFee) : "Free"}</dd></div>
            <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(order.total)}</dd></div>
          </dl>
        </div>
        <div className="space-y-4">
          <div className="rounded-3xl border bg-card p-5 shadow-soft">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-brand" /> Delivering to</p>
            <p className="text-sm">{a.fullName}</p>
            <p className="text-sm text-muted-foreground">{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</p>
          </div>
          <div className="rounded-3xl border bg-card p-5 shadow-soft">
            <p className="mb-1 flex items-center gap-2 text-sm font-semibold"><Banknote className="h-4 w-4 text-brand" /> Cash on Delivery</p>
            <p className="text-sm text-muted-foreground">Pay {formatINR(order.total)} on delivery.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrderNotFound() {
  return (
    <div className="rounded-3xl border border-dashed bg-card p-12 text-center">
      <p className="font-semibold">Order not found</p>
      <Link to="/orders" className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">View all orders</Link>
    </div>
  );
}
