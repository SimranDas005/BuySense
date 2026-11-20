import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Battery, ChevronRight, Cpu, HardDrive, Laptop, MemoryStick, Monitor, ShoppingBag, Truck, Banknote, Weight, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { QuantityStepper } from "@/components/common/quantity-stepper";
import { EmptyState } from "@/components/common/empty-state";
import { CompareButton, PriceBlock, StockBadge, WishlistButton } from "@/components/product/product-bits";
import { ProductGrid } from "@/components/product/product-card";
import { useAddToCart, useProduct, useProducts } from "@/hooks/use-shop";
import { CRITERIA } from "@/lib/dss/criteria";
import { formatStorage } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { CATEGORY_LABELS, type Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { specRows } from "@/lib/spec-rows";

export const Route = createFileRoute("/laptops/$slug")({
  head: () => ({
    meta: [
      { title: "Laptop details — BuySense" },
      { name: "description", content: "Full specifications, BuySense scorecard and Cash on Delivery checkout for this laptop." },
      { property: "og:title", content: "Laptop details — BuySense" },
      { property: "og:description", content: "Full specifications and BuySense scorecard." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: product, isLoading } = useProduct(slug);

  if (isLoading) return <DetailSkeleton />;
  if (!product) {
    return (
      <div className="container-page py-16">
        <EmptyState icon={Laptop} title="Laptop not found" description="It may have been removed from the catalogue." action={<Button asChild><Link to="/laptops">Browse laptops</Link></Button>} />
      </div>
    );
  }
  return <ProductDetail product={product} />;
}

function ProductDetail({ product }: { product: Product }) {
  const [active, setActive] = useState(0);
  const [qty, setQty] = useState(1);
  const add = useAddToCart();
  const navigate = useNavigate();
  const { data: all = [] } = useProducts();
  const images = product.images.length ? product.images : ["preset:everyday"];
  const similar = all.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  const s = product.specs;

  const highlights = [
    { icon: Cpu, label: "Processor", value: s.cpu },
    { icon: Zap, label: "Graphics", value: s.gpu },
    { icon: MemoryStick, label: "Memory", value: `${s.ramGb} GB` },
    { icon: HardDrive, label: "Storage", value: `${formatStorage(s.storageGb)} ${s.storageType}` },
    { icon: Monitor, label: "Display", value: `${s.displaySize}″ ${s.displayType}` },
    { icon: Battery, label: "Battery", value: `Up to ${s.batteryHours} h` },
  ];

  const addToBag = async (thenCart: boolean) => {
    await add.mutateAsync({ productId: product.id, quantity: qty, name: product.name });
    if (thenCart) void navigate({ to: "/cart" });
  };

  return (
    <div className="container-page py-8">
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/laptops" className="hover:text-foreground">Laptops</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/laptops" search={{ category: product.category }} className="hover:text-foreground">{CATEGORY_LABELS[product.category]}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div className="animate-fade-up">
          <div className="relative overflow-hidden rounded-[2rem] border bg-surface">
            <img key={active} src={resolveImage(images[active])} alt={product.name} width={1024} height={768} className="aspect-[4/3] w-full object-cover animate-in fade-in duration-500" />
            <div className="absolute right-4 top-4 flex gap-2">
              <WishlistButton productId={product.id} />
            </div>
          </div>
          {images.length > 1 && (
            <div className="mt-4 flex gap-3">
              {images.map((img, i) => (
                <button key={img + i} onClick={() => setActive(i)} aria-label={`Show image ${i + 1}`} className={cn("h-20 w-24 overflow-hidden rounded-2xl border-2 bg-surface transition-all", i === active ? "border-brand" : "border-transparent opacity-70 hover:opacity-100")}>
                  <img src={resolveImage(img)} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="animate-fade-up [animation-delay:80ms]">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{product.brand}</p>
          <h1 className="mt-1 text-3xl font-semibold md:text-4xl">{product.name}</h1>
          <p className="mt-2 text-lg text-muted-foreground">{product.tagline}</p>
          <div className="mt-6"><PriceBlock product={product} size="lg" /></div>
          <p className="mt-1 text-xs text-muted-foreground">Inclusive of all taxes</p>
          <div className="mt-4"><StockBadge stock={product.stock} /></div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {product.stock > 0 && <QuantityStepper value={qty} max={product.stock} onChange={setQty} />}
            <Button size="lg" variant="ink" disabled={product.stock <= 0 || add.isPending} onClick={() => addToBag(false)}>
              <ShoppingBag /> Add to bag
            </Button>
            <Button size="lg" variant="brand" disabled={product.stock <= 0 || add.isPending} onClick={() => addToBag(true)}>
              Buy now
            </Button>
            <CompareButton productId={product.id} withLabel />
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {highlights.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-2xl border bg-card p-4">
                <Icon className="h-4 w-4 text-brand" />
                <p className="mt-2 text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold leading-snug">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2 rounded-2xl bg-secondary p-4 text-sm">
            <p className="flex items-center gap-2"><Truck className="h-4 w-4 text-brand" /> Free delivery across India</p>
            <p className="flex items-center gap-2"><Banknote className="h-4 w-4 text-brand" /> Pay with Cash on Delivery</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="specs" className="mt-16">
        <TabsList className="h-11 rounded-full p-1">
          <TabsTrigger value="specs" className="rounded-full px-5">Specifications</TabsTrigger>
          <TabsTrigger value="overview" className="rounded-full px-5">Overview</TabsTrigger>
          <TabsTrigger value="score" className="rounded-full px-5">BuySense scorecard</TabsTrigger>
        </TabsList>
        <TabsContent value="specs" className="mt-6">
          <SpecTable product={product} />
        </TabsContent>
        <TabsContent value="overview" className="mt-6">
          <div className="max-w-3xl rounded-3xl border bg-card p-8 text-lg leading-relaxed text-muted-foreground">{product.description}</div>
        </TabsContent>
        <TabsContent value="score" className="mt-6">
          <Scorecard product={product} all={all} />
        </TabsContent>
      </Tabs>

      {similar.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-2xl font-semibold">More {CATEGORY_LABELS[product.category].toLowerCase()} laptops</h2>
          <ProductGrid products={similar} />
        </section>
      )}
    </div>
  );
}

function SpecTable({ product }: { product: Product }) {
  return (
    <dl className="divide-y overflow-hidden rounded-3xl border bg-card">
      {specRows(product).map(([k, v]) => (
        <div key={k} className="grid gap-1 px-6 py-4 sm:grid-cols-[220px_1fr]">
          <dt className="text-sm text-muted-foreground">{k}</dt>
          <dd className="text-sm font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Scorecard({ product, all }: { product: Product; all: Product[] }) {
  const rows = useMemo(
    () =>
      CRITERIA.map((c) => {
        const vals = all.map(c.value);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const v = c.value(product);
        const raw = max === min ? 1 : (v - min) / (max - min);
        const pos = c.type === "cost" ? 1 - raw : raw;
        return { c, pct: Math.round(pos * 100) };
      }),
    [all, product],
  );
  return (
    <div className="grid gap-6 rounded-3xl border bg-card p-6 md:grid-cols-2 md:p-8">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold">How it stacks up</h3>
        <p className="text-sm text-muted-foreground">
          Position on each decision criterion relative to the {all.length} laptops in our catalogue. 100 means best in catalogue.
        </p>
        <Button variant="outline" className="mt-4" asChild><Link to="/advisor">Rank it with Smart Advisor</Link></Button>
      </div>
      <div className="space-y-4">
        {rows.map(({ c, pct }) => (
          <div key={c.key}>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="font-medium">{c.label} <span className="text-muted-foreground">· {c.display(product)}</span></span>
              <span className="tabular-nums text-muted-foreground">{pct}</span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.15fr_1fr]">
      <Skeleton className="aspect-[4/3] rounded-[2rem]" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
