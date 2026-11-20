import { Link } from "@tanstack/react-router";
import { Battery, Cpu, MemoryStick, ShoppingBag, Weight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddToCart } from "@/hooks/use-shop";
import { resolveImage } from "@/lib/images";
import { CATEGORY_LABELS, type Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CompareButton, PriceBlock, StockBadge, WishlistButton } from "./product-bits";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const add = useAddToCart();
  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-3xl border bg-card shadow-soft transition-all duration-500 hover:-translate-y-1 hover:shadow-lift animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <Link to="/laptops/$slug" params={{ slug: product.slug }} className="absolute inset-0 z-0" aria-label={product.name} />
      <div className="relative aspect-[4/3] overflow-hidden bg-surface">
        <img
          src={resolveImage(product.images[0])}
          alt={product.name}
          loading="lazy"
          width={1024}
          height={768}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
            {CATEGORY_LABELS[product.category]}
          </span>
        </div>
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
          <WishlistButton productId={product.id} />
          <CompareButton productId={product.id} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{product.brand}</p>
          <h3 className="mt-0.5 line-clamp-1 text-base font-semibold">{product.name}</h3>
        </div>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5 truncate"><Cpu className="h-3.5 w-3.5 shrink-0" />{product.specs.cpu.split(" (")[0]}</li>
          <li className="flex items-center gap-1.5"><MemoryStick className="h-3.5 w-3.5 shrink-0" />{product.specs.ramGb} GB RAM</li>
          <li className="flex items-center gap-1.5"><Battery className="h-3.5 w-3.5 shrink-0" />{product.specs.batteryHours} h battery</li>
          <li className="flex items-center gap-1.5"><Weight className="h-3.5 w-3.5 shrink-0" />{product.specs.weightKg} kg</li>
        </ul>
        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div className="space-y-1.5">
            <PriceBlock product={product} />
            <StockBadge stock={product.stock} />
          </div>
          <Button
            size="icon"
            variant="ink"
            className="relative z-10 shrink-0"
            aria-label={`Add ${product.name} to bag`}
            disabled={product.stock <= 0 || add.isPending}
            onClick={() => add.mutate({ productId: product.id, name: product.name })}
          >
            <ShoppingBag />
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border bg-card">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-6 w-1/2" />
      </div>
    </div>
  );
}

export function ProductGrid({ products, loading, skeletons = 8, className }: { products: Product[]; loading?: boolean; skeletons?: number; className?: string }) {
  return (
    <div className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>
      {loading
        ? Array.from({ length: skeletons }, (_, i) => <ProductCardSkeleton key={i} />)
        : products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
    </div>
  );
}
