import { GitCompareArrows, Heart } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToggleWishlist, useWishlist } from "@/hooks/use-shop";
import { compareStore, useCompareIds } from "@/lib/compare-store";
import { discountPercent, formatINR } from "@/lib/format";
import { LOW_STOCK_THRESHOLD } from "@/lib/api/admin";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

export function PriceBlock({ product, size = "md" }: { product: Product; size?: "md" | "lg" }) {
  const off = discountPercent(product.price, product.mrp);
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={cn("font-display font-semibold tabular-nums", size === "lg" ? "text-3xl" : "text-lg")}>
        {formatINR(product.price)}
      </span>
      {off > 0 && (
        <>
          <span className="text-sm text-muted-foreground line-through tabular-nums">{formatINR(product.mrp)}</span>
          <span className="text-sm font-semibold text-success">{off}% off</span>
        </>
      )}
    </div>
  );
}

export function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <Badge variant="destructive">Out of stock</Badge>;
  if (stock <= LOW_STOCK_THRESHOLD) return <Badge variant="warning">Only {stock} left</Badge>;
  return <Badge variant="success">In stock</Badge>;
}

export function WishlistButton({ productId, className }: { productId: string; className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const wishlist = useWishlist();
  const toggle = useToggleWishlist();
  const saved = wishlist.data?.includes(productId) ?? false;
  return (
    <button
      type="button"
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) {
          toast("Sign in to save laptops to your wishlist");
          void navigate({ to: "/login" });
          return;
        }
        toggle.mutate(productId);
      }}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full border bg-card/90 shadow-soft backdrop-blur transition-all hover:scale-105",
        saved ? "text-destructive" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", saved && "fill-current")} />
    </button>
  );
}

export function CompareButton({ productId, className, withLabel }: { productId: string; className?: string; withLabel?: boolean }) {
  const ids = useCompareIds();
  const active = ids.includes(productId);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Remove from comparison" : "Add to comparison"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (active) {
          compareStore.remove(productId);
          return;
        }
        const res = compareStore.add(productId);
        if (!res.ok) toast.error(res.reason);
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-all",
        withLabel ? "h-9 px-4" : "h-9 w-9 justify-center px-0",
        active ? "border-brand bg-brand-soft text-brand" : "bg-card/90 text-muted-foreground shadow-soft backdrop-blur hover:text-foreground",
        className,
      )}
    >
      <GitCompareArrows className="h-4 w-4" />
      {withLabel && (active ? "Comparing" : "Compare")}
    </button>
  );
}
