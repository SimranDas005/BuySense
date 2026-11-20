import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Scale, SlidersHorizontal, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProductCard, ProductCardSkeleton, ProductGrid } from "@/components/product/product-card";
import { useProducts } from "@/hooks/use-shop";
import heroImg from "@/assets/hero-laptop.jpg";
import { PRESET_IMAGES } from "@/lib/images";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/types";
import { PRESETS, presetJudgments, rankLaptops } from "@/lib/dss/engine";
import { ahpWeights, buildPairwiseMatrix } from "@/lib/dss/ahp";
import { CRITERIA } from "@/lib/dss/criteria";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BuySense — Smart Laptop Shopping & Decision Support" },
      { name: "description", content: "Discover, compare and buy laptops with data-driven AHP and TOPSIS recommendations. Free delivery and Cash on Delivery." },
      { property: "og:title", content: "BuySense — Smart Laptop Shopping & Decision Support" },
      { property: "og:description", content: "Discover, compare and buy laptops with data-driven AHP and TOPSIS recommendations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const CATEGORY_IMAGE: Record<Category, string> = {
  ultrabook: PRESET_IMAGES.ultrabook,
  gaming: PRESET_IMAGES.gaming,
  business: PRESET_IMAGES.business,
  creator: PRESET_IMAGES.creator,
  convertible: PRESET_IMAGES.convertible,
  everyday: PRESET_IMAGES.everyday,
};

const CATEGORY_BLURB: Record<Category, string> = {
  ultrabook: "Thin, light, all-day",
  gaming: "High refresh, RTX power",
  business: "Secure and durable",
  creator: "Colour-true performance",
  convertible: "Touch, pen, flip",
  everyday: "Great value daily",
};

function Home() {
  const { data: products = [], isLoading } = useProducts();
  const featured = products.filter((p) => p.featured).slice(0, 4);

  return (
    <>
      <section className="relative overflow-hidden bg-hero">
        <div className="container-page grid items-center gap-10 pb-16 pt-14 md:grid-cols-[1.05fr_1fr] md:pb-24 md:pt-20">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-brand" /> Smart Shopping Intelligence
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
              The right laptop.
              <br />
              <span className="text-brand-gradient">Decided by data.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Tell BuySense what matters to you. Our decision engine weighs every spec with AHP and ranks every laptop with TOPSIS — then explains why.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="xl" variant="ink" asChild>
                <Link to="/advisor">Find my match <ArrowRight /></Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link to="/laptops">Shop all laptops</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-10 rounded-full bg-brand/20 blur-3xl" aria-hidden />
            <img
              src={heroImg}
              alt="A thin aluminium BuySense laptop floating above a soft surface"
              width={1600}
              height={1008}
              className="relative w-full animate-float drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      <section className="container-page mt-16">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-semibold md:text-3xl">Shop by category</h2>
          <Link to="/laptops" className="text-sm font-semibold text-brand hover:underline">View all</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((c, i) => (
            <Link
              key={c}
              to="/laptops"
              search={{ category: c }}
              className="group overflow-hidden rounded-3xl border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="aspect-square overflow-hidden bg-surface">
                <img src={CATEGORY_IMAGE[c]} alt="" loading="lazy" width={1024} height={768} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
              </div>
              <div className="p-4">
                <p className="font-semibold">{CATEGORY_LABELS[c]}</p>
                <p className="text-xs text-muted-foreground">{CATEGORY_BLURB[c]}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page mt-20">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Featured</p>
            <h2 className="mt-1 text-2xl font-semibold md:text-3xl">Standout laptops</h2>
          </div>
          <Link to="/laptops" className="text-sm font-semibold text-brand hover:underline">Browse catalogue</Link>
        </div>
        <ProductGrid products={featured} loading={isLoading} skeletons={4} />
      </section>

      <Recommendations />

      <section className="container-page mt-20">
        <div className="overflow-hidden rounded-[2rem] bg-ink-gradient p-8 text-ink-foreground md:p-14">
          <div className="grid gap-10 md:grid-cols-[1fr_1.3fr] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Decision Support System</p>
              <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Transparent recommendations, not guesswork.</h2>
              <p className="mt-4 opacity-75">
                Every ranking is reproducible. See the weights, the scores and the reasons — then change them and watch the ranking move.
              </p>
              <Button size="lg" variant="brand" className="mt-8" asChild>
                <Link to="/advisor">Open Smart Advisor <ArrowRight /></Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: Scale, t: "1 · AHP weighting", d: "Compare criteria in pairs to derive consistent importance weights." },
                { icon: BarChart3, t: "2 · TOPSIS ranking", d: "Rank laptops by closeness to the ideal on every weighted criterion." },
                { icon: SlidersHorizontal, t: "3 · What-If", d: "Shift any weight and see the ranking respond instantly." },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="rounded-2xl border border-ink-foreground/10 bg-ink-foreground/5 p-5">
                  <Icon className="h-5 w-5 text-brand" />
                  <p className="mt-3 font-semibold">{t}</p>
                  <p className="mt-1 text-sm opacity-70">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Recommendations() {
  const { data: products = [], isLoading } = useProducts();
  const [preset, setPreset] = useState("student");
  const ranked = useMemo(() => {
    const inStock = products.filter((p) => p.stock > 0);
    if (!inStock.length) return [];
    const { weights } = ahpWeights(buildPairwiseMatrix(CRITERIA.length, presetJudgments(preset)));
    return rankLaptops(inStock, weights).slice(0, 4);
  }, [products, preset]);
  const options = PRESETS.filter((p) => p.id !== "balanced");

  return (
    <section className="container-page mt-20">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Recommended for you</p>
          <h2 className="mt-1 text-2xl font-semibold md:text-3xl">Top picks by profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ranked live by TOPSIS using AHP weights for each profile.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist">
          {options.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={preset === p.id}
              onClick={() => setPreset(p.id)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                preset === p.id ? "border-ink bg-ink text-ink-foreground" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)
          : ranked.map((r, i) => (
              <div key={`${preset}-${r.product.id}`} className="relative">
                <span className="absolute -left-2 -top-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-bold text-brand-foreground shadow-glow">
                  {r.rank}
                </span>
                <ProductCard product={r.product} index={i} />
              </div>
            ))}
      </div>
    </section>
  );
}
