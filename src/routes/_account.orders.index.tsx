import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { OrderStatusBadge } from "@/components/common/status-badge";
import { useMyOrders } from "@/hooks/use-shop";
import { formatDate, formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";

export const Route = createFileRoute("/_account/orders/")({
  head: () => ({
    meta: [
      { title: "My orders — BuySense" },
      { name: "description", content: "Track your BuySense laptop orders and delivery status." },
      { property: "og:title", content: "My orders — BuySense" },
      { property: "og:description", content: "Track your BuySense orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Orders,
});

function Orders() {
  const { data: orders = [], isLoading } = useMyOrders();
  return (
    <div className="container-page max-w-4xl py-10">
      <PageHeader eyebrow="Account" title="My orders" />
      <div className="mt-8 space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28 rounded-3xl" />)
        ) : orders.length === 0 ? (
          <EmptyState icon={Package} title="No orders yet" description="When you place an order it will show up here." action={<Button asChild><Link to="/laptops">Start shopping</Link></Button>} />
        ) : (
          orders.map((o) => (
            <Link key={o.id} to="/orders/$orderId" params={{ orderId: o.id }} className="flex items-center gap-4 rounded-3xl border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex -space-x-3">
                {o.items.slice(0, 3).map((it) => (
                  <img key={it.productId} src={resolveImage(it.image)} alt="" className="h-14 w-14 rounded-2xl border-2 border-card bg-surface object-cover" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{o.orderNumber}</p>
                  <OrderStatusBadge status={o.status} />
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{o.items.map((i) => i.name).join(", ")}</p>
                <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
              </div>
              <p className="hidden font-semibold tabular-nums sm:block">{formatINR(o.total)}</p>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
