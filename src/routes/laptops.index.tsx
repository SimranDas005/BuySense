import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X, SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ProductGrid } from "@/components/product/product-card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { useProducts } from "@/hooks/use-shop";
import { filterProducts, SORT_OPTIONS, type CatalogFilters, type SortValue } from "@/lib/catalog-filter";
import { formatINR } from "@/lib/format";
import { CATEGORIES, CATEGORY_LABELS, type Category, type Product } from "@/lib/types";
import { cn } from "@/lib/utils";

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export const Route = createFileRoute("/laptops/")({
  validateSearch: (s: Record<string, unknown>): CatalogFilters => {
    const out: CatalogFilters = {};
    if (typeof s["q"] === "string" && s["q"]) out.q = s["q"];
    if (typeof s["category"] === "string" && (CATEGORIES as readonly string[]).includes(s["category"])) out.category = s["category"] as Category;
    if (typeof s["brand"] === "string" && s["brand"]) out.brand = s["brand"];
    const minPrice = num(s["minPrice"]);
    if (minPrice) out.minPrice = minPrice;
    const maxPrice = num(s["maxPrice"]);
    if (maxPrice) out.maxPrice = maxPrice;
    const ram = num(s["ram"]);
    if (ram) out.ram = ram;
    if (s["inStock"] === true || s["inStock"] === "true") out.inStock = true;
    if (typeof s["sort"] === "string" && SORT_OPTIONS.some((o) => o.value === s["sort"])) out.sort = s["sort"] as SortValue;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Shop Laptops — BuySense" },
      { name: "description", content: "Browse gaming, business, creator, 2-in-1 and everyday laptops. Filter by price, brand and RAM, and sort by performance or battery." },
      { property: "og:title", content: "Shop Laptops — BuySense" },
      { property: "og:description", content: "Browse and filter every laptop in the BuySense catalogue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Catalog,
});

function Catalog() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/laptops/" });
  const { data: products = [], isLoading } = useProducts();
  const [q, setQ] = useState(search.q ?? "");

  useEffect(() => setQ(search.q ?? ""), [search.q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if ((search.q ?? "") !== q) void navigate({ search: (p) => ({ ...p, q: q || undefined }), replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [q, search.q, navigate]);

  const results = useMemo(() => filterProducts(products, search), [products, search]);
  const set = (patch: Partial<CatalogFilters>) => navigate({ search: (p) => ({ ...p, ...patch }) });
  const activeCount = [search.category, search.brand, search.minPrice, search.maxPrice, search.ram, search.inStock].filter(Boolean).length;

  const title = search.category ? CATEGORY_LABELS[search.category] : "All laptops";

  return (
    <div className="container-page py-10">
      <PageHeader eyebrow="Catalogue" title={title} description="Filter by what matters, then compare or let the Smart Advisor rank them for you." />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by model, brand, processor…" aria-label="Search laptops" className="h-11 rounded-full bg-card pl-10" />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="lg" className="lg:hidden">
              <SlidersHorizontal /> Filters {activeCount > 0 && `(${activeCount})`}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader><SheetTitle className="text-left">Filters</SheetTitle></SheetHeader>
            <div className="px-4 pb-8"><Filters products={products} search={search} set={set} /></div>
          </SheetContent>
        </Sheet>
        <Select value={search.sort ?? "featured"} onValueChange={(v) => set({ sort: v === "featured" ? undefined : (v as SortValue) })}>
          <SelectTrigger className="h-11 w-52 rounded-full bg-card" aria-label="Sort by"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl border bg-card p-5 shadow-soft">
            <Filters products={products} search={search} set={set} />
          </div>
        </aside>
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{isLoading ? "Loading…" : `${results.length} laptop${results.length === 1 ? "" : "s"}`}</span>
            {activeCount > 0 && (
              <Button variant="link" size="sm" className="h-auto px-1" onClick={() => navigate({ search: search.q ? { q: search.q } : {} })}>
                Clear filters
              </Button>
            )}
          </div>
          {!isLoading && results.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No laptops match"
              description="Try a broader search or remove a filter."
              action={<Button variant="outline" onClick={() => { setQ(""); void navigate({ search: {} }); }}>Reset search</Button>}
            />
          ) : (
            <ProductGrid products={results} loading={isLoading} skeletons={6} className="lg:grid-cols-2 xl:grid-cols-2" />
          )}
        </div>
      </div>
    </div>
  );
}

function Filters({ products, search, set }: { products: Product[]; search: CatalogFilters; set: (p: Partial<CatalogFilters>) => void }) {
  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))].sort(), [products]);
  const bounds = useMemo(() => {
    if (!products.length) return [0, 300000] as const;
    const prices = products.map((p) => p.price);
    return [Math.floor(Math.min(...prices) / 5000) * 5000, Math.ceil(Math.max(...prices) / 5000) * 5000] as const;
  }, [products]);
  const [range, setRange] = useState<number[]>([search.minPrice ?? bounds[0], search.maxPrice ?? bounds[1]]);
  useEffect(() => setRange([search.minPrice ?? bounds[0], search.maxPrice ?? bounds[1]]), [search.minPrice, search.maxPrice, bounds]);

  const chip = (active: boolean) =>
    cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-all", active ? "border-ink bg-ink text-ink-foreground" : "bg-card text-muted-foreground hover:text-foreground");

  return (
    <div className="space-y-7">
      <section>
        <p className="mb-3 text-sm font-semibold">Category</p>
        <div className="flex flex-wrap gap-2">
          <button className={chip(!search.category)} onClick={() => set({ category: undefined })}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} className={chip(search.category === c)} onClick={() => set({ category: search.category === c ? undefined : c })}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </section>
      <section>
        <p className="mb-3 text-sm font-semibold">Price</p>
        <Slider
          min={bounds[0]}
          max={bounds[1]}
          step={5000}
          value={range}
          onValueChange={setRange}
          onValueCommit={(v) =>
            set({
              minPrice: v[0] !== undefined && v[0] > bounds[0] ? v[0] : undefined,
              maxPrice: v[1] !== undefined && v[1] < bounds[1] ? v[1] : undefined,
            })
          }
          aria-label="Price range"
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{formatINR(range[0] ?? bounds[0])}</span>
          <span>{formatINR(range[1] ?? bounds[1])}</span>
        </div>
      </section>
      <section>
        <p className="mb-3 text-sm font-semibold">Brand</p>
        <div className="flex flex-wrap gap-2">
          {brands.map((b) => (
            <button key={b} className={chip(search.brand === b)} onClick={() => set({ brand: search.brand === b ? undefined : b })}>{b}</button>
          ))}
        </div>
      </section>
      <section>
        <p className="mb-3 text-sm font-semibold">Minimum RAM</p>
        <div className="flex flex-wrap gap-2">
          {[8, 16, 32].map((r) => (
            <button key={r} className={chip(search.ram === r)} onClick={() => set({ ram: search.ram === r ? undefined : r })}>{r} GB+</button>
          ))}
        </div>
      </section>
      <section className="flex items-center justify-between">
        <Label htmlFor="instock" className="text-sm font-semibold">In stock only</Label>
        <Switch id="instock" checked={!!search.inStock} onCheckedChange={(v) => set({ inStock: v || undefined })} />
      </section>
      {(search.category || search.brand || search.ram || search.minPrice || search.maxPrice || search.inStock) && (
        <Button variant="soft" className="w-full" onClick={() => set({ category: undefined, brand: undefined, ram: undefined, minPrice: undefined, maxPrice: undefined, inStock: undefined })}>
          <X /> Clear filters
        </Button>
      )}
    </div>
  );
}
