import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Banknote, ShoppingBag, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { QuantityStepper } from "@/components/common/quantity-stepper";
import { OrderSummaryRows } from "@/components/common/order-summary";
import { useAuth } from "@/hooks/use-auth";
import { useCart, useSetCartQuantity } from "@/hooks/use-shop";
import { formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Bag — BuySense" },
      { name: "description", content: "Review the laptops in your bag, adjust quantities and check out with Cash on Delivery." },
      { property: "og:title", content: "Your Bag — BuySense" },
      { property: "og:description", content: "Review your bag and check out with Cash on Delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { summary, isLoading } = useCart();
  const setQty = useSetCartQuantity();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="container-page py-10"><Skeleton className="h-10 w-48" /><Skeleton className="mt-8 h-72 rounded-3xl" /></div>;
  }

  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Bag" title="Your bag" description={summary.itemCount ? `${summary.itemCount} item${summary.itemCount > 1 ? "s" : ""}` : undefined} />
      {summary.lines.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={ShoppingBag} title="Your bag is empty" description="Find a laptop you love, or let the Smart Advisor pick one for you." action={<div className="flex gap-2"><Button asChild><Link to="/laptops">Shop laptops</Link></Button><Button variant="outline" asChild><Link to="/advisor">Smart Advisor</Link></Button></div>} />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <ul className="space-y-4">
            {summary.lines.map(({ product, quantity, lineTotal, exceedsStock }) => (
              <li key={product.id} className="flex gap-4 rounded-3xl border bg-card p-4 shadow-soft animate-fade-up sm:gap-6 sm:p-5">
                <Link to="/laptops/$slug" params={{ slug: product.slug }} className="shrink-0">
                  <img src={resolveImage(product.images[0])} alt={product.name} loading="lazy" className="h-24 w-32 rounded-2xl bg-surface object-cover sm:h-28 sm:w-40" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">{product.brand}</p>
                      <Link to="/laptops/$slug" params={{ slug: product.slug }} className="font-semibold hover:text-brand">{product.name}</Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">{product.specs.cpu} · {product.specs.ramGb} GB</p>
                    </div>
                    <p className="font-semibold tabular-nums">{formatINR(lineTotal)}</p>
                  </div>
                  {exceedsStock && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {product.stock === 0 ? "Sold out — please remove" : `Only ${product.stock} available — reduce quantity`}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <QuantityStepper value={quantity} max={Math.max(product.stock, 1)} disabled={setQty.isPending || product.stock === 0} onChange={(q) => setQty.mutate({ productId: product.id, quantity: q })} />
                    <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setQty.mutate({ productId: product.id, quantity: 0 })}>
                      <Trash2 /> Remove
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="h-fit rounded-3xl border bg-card p-6 shadow-soft lg:sticky lg:top-24">
            <h2 className="mb-5 text-lg font-semibold">Order summary</h2>
            <OrderSummaryRows subtotal={summary.subtotal} savings={summary.savings} shipping={summary.shippingFee} total={summary.total} />
            <Button
              size="lg"
              variant="ink"
              className="mt-6 w-full"
              disabled={summary.hasIssues}
              onClick={() => (user ? navigate({ to: "/checkout" }) : navigate({ to: "/login", search: { redirect: "/checkout" } }))}
            >
              {user ? "Checkout" : "Sign in to checkout"} <ArrowRight />
            </Button>
            <div className="mt-5 space-y-2 text-xs text-muted-foreground">
              <p className="flex items-center gap-2"><Truck className="h-4 w-4" /> Free delivery across India</p>
              <p className="flex items-center gap-2"><Banknote className="h-4 w-4" /> Cash on Delivery</p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
