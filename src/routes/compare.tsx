import { createFileRoute, Link } from "@tanstack/react-router";
import { GitCompareArrows, Plus, Sparkles, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PriceBlock, StockBadge } from "@/components/product/product-bits";
import { useAddToCart, useProducts } from "@/hooks/use-shop";
import { compareStore, MAX_COMPARE, useCompareIds } from "@/lib/compare-store";
import { CRITERIA } from "@/lib/dss/criteria";
import { resolveImage } from "@/lib/images";
import { specRows } from "@/lib/spec-rows";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare Laptops — BuySense" },
      { name: "description", content: "Compare up to five laptops side by side with best-in-group highlights on every decision criterion." },
      { property: "og:title", content: "Compare Laptops — BuySense" },
      { property: "og:description", content: "Side-by-side comparison of up to five laptops." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const ids = useCompareIds();
  const { data: products = [], isLoading } = useProducts();
  const add = useAddToCart();
  const items = ids.map((id) => products.find((p) => p.id === id)).filter((p) => p != null);
  const available = products.filter((p) => !ids.includes(p.id));

  const best = (key: string) => {
    const c = CRITERIA.find((x) => x.key === key)!;
    const vals = items.map(c.value);
    const target = c.type === "cost" ? Math.min(...vals) : Math.max(...vals);
    return new Set(items.filter((p) => c.value(p) === target).map((p) => p.id));
  };

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Compare"
        title="Side-by-side comparison"
        description={`Pick up to ${MAX_COMPARE} laptops. The best value on each criterion is highlighted.`}
        actions={
          items.length >= 2 ? (
            <>
              <Button variant="outline" onClick={() => compareStore.clear()}>Clear all</Button>
              <Button variant="brand" asChild><Link to="/advisor"><Sparkles /> Rank these for me</Link></Button>
            </>
          ) : null
        }
      />

      {isLoading ? (
        <Skeleton className="mt-8 h-96 rounded-3xl" />
      ) : items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={GitCompareArrows}
            title="Nothing to compare yet"
            description="Tap the compare icon on any laptop to add it here."
            action={<Button asChild><Link to="/laptops">Browse laptops</Link></Button>}
          />
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-3xl border bg-card shadow-soft">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-40 bg-card p-4 text-left align-bottom text-xs font-semibold uppercase tracking-wider text-muted-foreground">Laptop</th>
                {items.map((p) => (
                  <th key={p.id} className="min-w-48 p-4 text-left align-top font-normal">
                    <div className="relative">
                      <button onClick={() => compareStore.remove(p.id)} aria-label={`Remove ${p.name}`} className="absolute right-0 top-0 z-10 grid h-7 w-7 place-items-center rounded-full bg-secondary text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <Link to="/laptops/$slug" params={{ slug: p.slug }}>
                        <img src={resolveImage(p.images[0])} alt={p.name} loading="lazy" className="aspect-[4/3] w-full rounded-2xl bg-surface object-cover" />
                        <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{p.brand}</p>
                        <p className="font-semibold leading-snug">{p.name}</p>
                      </Link>
                      <div className="mt-2"><PriceBlock product={p} /></div>
                      <div className="mt-2"><StockBadge stock={p.stock} /></div>
                      <Button size="sm" variant="ink" className="mt-3 w-full" disabled={p.stock <= 0} onClick={() => add.mutate({ productId: p.id, name: p.name })}>
                        Add to bag
                      </Button>
                    </div>
                  </th>
                ))}
                {items.length < MAX_COMPARE && (
                  <th className="min-w-48 p-4 align-top font-normal">
                    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-4">
                      <Plus className="h-5 w-5 text-muted-foreground" />
                      <Select
                        value=""
                        onValueChange={(id) => {
                          const res = compareStore.add(id);
                          if (!res.ok) toast.error(res.reason);
                        }}
                      >
                        <SelectTrigger className="w-full rounded-full" aria-label="Add a laptop to compare"><SelectValue placeholder="Add a laptop" /></SelectTrigger>
                        <SelectContent>
                          {available.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={items.length + 2} className="bg-secondary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decision criteria</td></tr>
              {CRITERIA.map((c) => {
                const winners = items.length > 1 ? best(c.key) : new Set<string>();
                return (
                  <tr key={c.key} className="border-t">
                    <td className="sticky left-0 bg-card p-4 font-medium">{c.label}<p className="text-xs font-normal text-muted-foreground">{c.description}</p></td>
                    {items.map((p) => (
                      <td key={p.id} className={cn("p-4 tabular-nums", winners.has(p.id) && "font-semibold text-success")}>
                        <span className="inline-flex items-center gap-1.5">
                          {winners.has(p.id) && <Trophy className="h-3.5 w-3.5" />}
                          {c.display(p)}
                        </span>
                      </td>
                    ))}
                    {items.length < MAX_COMPARE && <td />}
                  </tr>
                );
              })}
              <tr><td colSpan={items.length + 2} className="bg-secondary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full specifications</td></tr>
              {specRows(items[0]!).map(([label], rowIdx) => (
                <tr key={label} className="border-t">
                  <td className="sticky left-0 bg-card p-4 font-medium">{label}</td>
                  {items.map((p) => (
                    <td key={p.id} className="p-4 text-muted-foreground">{specRows(p)[rowIdx]?.[1]}</td>
                  ))}
                  {items.length < MAX_COMPARE && <td />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
