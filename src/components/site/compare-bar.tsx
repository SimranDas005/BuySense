import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-shop";
import { compareStore, MAX_COMPARE, useCompareIds } from "@/lib/compare-store";
import { resolveImage } from "@/lib/images";

export function CompareBar() {
  const ids = useCompareIds();
  const { data: products = [] } = useProducts();
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (!ids.length || path === "/compare" || path.startsWith("/checkout")) return null;
  const items = ids.map((id) => products.find((p) => p.id === id)).filter((p) => p != null);

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 animate-fade-up">
      <div className="flex w-full max-w-2xl items-center gap-3 rounded-full border bg-ink p-2 pl-4 text-ink-foreground shadow-lift">
        <div className="flex -space-x-2">
          {items.map((p) => (
            <button
              key={p.id}
              onClick={() => compareStore.remove(p.id)}
              className="group relative h-9 w-9 overflow-hidden rounded-full border-2 border-ink bg-card"
              aria-label={`Remove ${p.name} from comparison`}
            >
              <img src={resolveImage(p.images[0])} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-0 hidden place-items-center bg-ink/70 group-hover:grid"><X className="h-3.5 w-3.5" /></span>
            </button>
          ))}
        </div>
        <p className="flex-1 truncate text-sm">
          <span className="font-semibold">{ids.length}</span>
          <span className="opacity-70"> / {MAX_COMPARE} selected to compare</span>
        </p>
        <Button size="sm" variant="ghost" className="hidden text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground sm:inline-flex" onClick={() => compareStore.clear()}>
          Clear
        </Button>
        <Button size="sm" variant="brand" asChild>
          <Link to="/compare">Compare <ArrowRight /></Link>
        </Button>
      </div>
    </div>
  );
}
