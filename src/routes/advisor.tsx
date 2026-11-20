import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Award, Info, Minus, RotateCcw, ShoppingBag, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/common/page-header";
import { PairwisePanel } from "@/components/dss/pairwise-panel";
import { WeightsChart } from "@/components/dss/weights-chart";
import { PriceBlock } from "@/components/product/product-bits";
import { useAddToCart, useProducts } from "@/hooks/use-shop";
import { useCompareIds } from "@/lib/compare-store";
import { ahpWeights, buildPairwiseMatrix, normalizeWeights, type Judgments } from "@/lib/dss/ahp";
import { CRITERIA } from "@/lib/dss/criteria";
import { PRESETS, presetJudgments, rankLaptops, type RankedLaptop } from "@/lib/dss/engine";
import { formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/advisor")({
  head: () => ({
    meta: [
      { title: "Smart Advisor — AHP + TOPSIS Laptop Recommendations | BuySense" },
      { name: "description", content: "Weight your priorities with AHP, rank laptops with TOPSIS and explore a What-If simulator to find your best laptop." },
      { property: "og:title", content: "Smart Advisor — BuySense" },
      { property: "og:description", content: "AHP criteria weighting, TOPSIS ranking and a What-If simulator for laptops." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Advisor,
});

type Source = "catalog" | "compare";

function Advisor() {
  const { data: products = [], isLoading } = useProducts();
  const compareIds = useCompareIds();
  const [source, setSource] = useState<Source>("catalog");
  const [category, setCategory] = useState<Category | "all">("all");
  const [budget, setBudget] = useState<number | null>(null);
  const [presetId, setPresetId] = useState<string>("balanced");
  const [judgments, setJudgments] = useState<Judgments>(() => presetJudgments("balanced"));

  useEffect(() => {
    if (compareIds.length >= 2) setSource("compare");
  }, [compareIds.length]);

  const maxPrice = useMemo(() => Math.ceil(Math.max(0, ...products.map((p) => p.price)) / 5000) * 5000, [products]);
  const minPrice = useMemo(() => (products.length ? Math.floor(Math.min(...products.map((p) => p.price)) / 5000) * 5000 : 0), [products]);
  const effectiveBudget = budget ?? maxPrice;

  const alternatives = useMemo(() => {
    if (source === "compare") return products.filter((p) => compareIds.includes(p.id));
    return products.filter((p) => p.stock > 0 && p.price <= effectiveBudget && (category === "all" || p.category === category));
  }, [products, source, compareIds, effectiveBudget, category]);

  const ahp = useMemo(() => ahpWeights(buildPairwiseMatrix(CRITERIA.length, judgments)), [judgments]);
  const baseline = useMemo(() => (alternatives.length ? rankLaptops(alternatives, ahp.weights) : []), [alternatives, ahp.weights]);

  const [whatIf, setWhatIf] = useState<number[]>(() => ahp.weights.map((w) => Math.round(w * 100)));
  useEffect(() => setWhatIf(ahp.weights.map((w) => Math.round(w * 100))), [ahp.weights]);
  const whatIfWeights = useMemo(() => normalizeWeights(whatIf), [whatIf]);
  const simulated = useMemo(() => (alternatives.length ? rankLaptops(alternatives, whatIfWeights) : []), [alternatives, whatIfWeights]);

  const applyPreset = (id: string) => {
    setPresetId(id);
    setJudgments(presetJudgments(id));
  };

  return (
    <div className="container-page py-10">
      <PageHeader
        eyebrow="Decision Support System"
        title={<>Smart Advisor <Sparkles className="inline h-7 w-7 text-brand" /></>}
        description="Tell us what matters by comparing criteria in pairs (AHP). We rank every laptop by closeness to your ideal (TOPSIS) and explain each result."
      />

      {isLoading ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[400px_1fr]"><Skeleton className="h-[600px] rounded-3xl" /><Skeleton className="h-[600px] rounded-3xl" /></div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[400px_1fr]">
          <div className="space-y-6">
            <Panel step="1" title="Choose alternatives">
              <div className="grid grid-cols-2 gap-2 rounded-full bg-secondary p-1">
                {(["catalog", "compare"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    className={cn("rounded-full py-2 text-sm font-semibold transition-all", source === s ? "bg-card shadow-soft" : "text-muted-foreground")}
                  >
                    {s === "catalog" ? "From catalogue" : `Compare list (${compareIds.length})`}
                  </button>
                ))}
              </div>
              {source === "catalog" ? (
                <div className="mt-5 space-y-5">
                  <div>
                    <Label className="mb-2 block text-sm">Category</Label>
                    <Select value={category} onValueChange={(v) => setCategory(v as Category | "all")}>
                      <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <Label>Maximum budget</Label>
                      <span className="font-semibold tabular-nums">{formatINR(effectiveBudget)}</span>
                    </div>
                    <Slider min={minPrice} max={maxPrice} step={5000} value={[effectiveBudget]} onValueChange={(v) => setBudget(v[0] ?? maxPrice)} aria-label="Maximum budget" />
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Ranking the laptops in your compare list.{" "}
                  <Link to="/compare" className="font-semibold text-brand hover:underline">Edit list</Link>
                </p>
              )}
              <p className="mt-4 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{alternatives.length}</span> laptops will be ranked.</p>
            </Panel>

            <Panel step="2" title="Set your priorities (AHP)">
              <p className="mb-3 text-sm text-muted-foreground">Start from a profile, then fine-tune each pair.</p>
              <div className="mb-5 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Tooltip key={p.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => applyPreset(p.id)}
                        className={cn("rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all", presetId === p.id ? "border-ink bg-ink text-ink-foreground" : "bg-card text-muted-foreground hover:text-foreground")}
                      >
                        {p.label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{p.description}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <PairwisePanel
                criteria={CRITERIA}
                judgments={judgments}
                ahp={ahp}
                onChange={(key, v) => {
                  setPresetId("custom");
                  setJudgments((j) => ({ ...j, [key]: v }));
                }}
              />
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel step="3" title="Criteria weights">
              <WeightsChart criteria={CRITERIA} weights={ahp.weights} />
            </Panel>

            {alternatives.length < 2 ? (
              <div className="rounded-3xl border border-dashed bg-card p-10 text-center text-muted-foreground">
                <Info className="mx-auto mb-3 h-6 w-6" />
                Select at least two laptops to rank. Widen your budget or category, or add laptops to your compare list.
              </div>
            ) : (
              <Tabs defaultValue="ranking">
                <TabsList className="h-11 rounded-full p-1">
                  <TabsTrigger value="ranking" className="rounded-full px-5">TOPSIS ranking</TabsTrigger>
                  <TabsTrigger value="whatif" className="rounded-full px-5">What-If simulator</TabsTrigger>
                </TabsList>
                <TabsContent value="ranking" className="mt-6 space-y-6">
                  <TopPick r={baseline[0]!} />
                  <RankingTable rows={baseline} />
                </TabsContent>
                <TabsContent value="whatif" className="mt-6">
                  <WhatIf
                    weights={whatIf}
                    normalized={whatIfWeights}
                    onChange={(i, v) => setWhatIf((w) => w.map((x, k) => (k === i ? v : x)))}
                    onReset={() => setWhatIf(ahp.weights.map((w) => Math.round(w * 100)))}
                    baseline={baseline}
                    simulated={simulated}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ step, title, children }: { step: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border bg-card p-6 shadow-soft animate-fade-up">
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function TopPick({ r }: { r: RankedLaptop }) {
  const add = useAddToCart();
  return (
    <div className="overflow-hidden rounded-3xl bg-ink-gradient text-ink-foreground shadow-lift animate-fade-up">
      <div className="grid gap-6 p-6 md:grid-cols-[220px_1fr] md:p-8">
        <img src={resolveImage(r.product.images[0])} alt={r.product.name} className="aspect-[4/3] w-full rounded-2xl object-cover" />
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold text-brand-foreground"><Award className="h-3.5 w-3.5" /> Best match for you</p>
          <h3 className="mt-3 text-2xl font-semibold">{r.product.name}</h3>
          <div className="mt-2 [&_*]:text-ink-foreground"><PriceBlock product={r.product} /></div>
          <p className="mt-3 text-sm leading-relaxed opacity-80">{r.explanation}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="brand" disabled={r.product.stock <= 0} onClick={() => add.mutate({ productId: r.product.id, name: r.product.name })}><ShoppingBag /> Add to bag</Button>
            <Button variant="outline" className="border-ink-foreground/20 bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground" asChild>
              <Link to="/laptops/$slug" params={{ slug: r.product.slug }}>View details</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RankingTable({ rows }: { rows: RankedLaptop[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-4">Rank</th>
              <th className="p-4">Laptop</th>
              <th className="p-4">Closeness (C*)</th>
              <th className="p-4">
                <Tooltip><TooltipTrigger className="underline decoration-dotted">S⁺ / S⁻</TooltipTrigger><TooltipContent>Distance to the ideal (S⁺) and anti-ideal (S⁻) solutions</TooltipContent></Tooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product.id} className="border-t align-top">
                <td className="p-4">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-full text-sm font-bold", r.rank === 1 ? "bg-brand text-brand-foreground" : "bg-secondary")}>{r.rank}</span>
                </td>
                <td className="p-4">
                  <Link to="/laptops/$slug" params={{ slug: r.product.slug }} className="flex gap-3">
                    <img src={resolveImage(r.product.images[0])} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded-lg bg-surface object-cover" />
                    <div>
                      <p className="font-semibold hover:text-brand">{r.product.name}</p>
                      <p className="text-xs text-muted-foreground">{formatINR(r.product.price)}</p>
                      <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">{r.explanation}</p>
                    </div>
                  </Link>
                </td>
                <td className="w-44 p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-brand-gradient" style={{ width: `${r.score * 100}%` }} /></div>
                    <span className="tabular-nums font-semibold">{r.score.toFixed(3)}</span>
                  </div>
                </td>
                <td className="p-4 tabular-nums text-muted-foreground">{r.distanceToIdeal.toFixed(4)} / {r.distanceToAntiIdeal.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WhatIf({
  weights,
  normalized,
  onChange,
  onReset,
  baseline,
  simulated,
}: {
  weights: number[];
  normalized: number[];
  onChange: (i: number, v: number) => void;
  onReset: () => void;
  baseline: RankedLaptop[];
  simulated: RankedLaptop[];
}) {
  const baseRank = new Map(baseline.map((r) => [r.product.id, r.rank]));
  const leaderChanged = baseline[0]?.product.id !== simulated[0]?.product.id;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Adjust weights</h3>
            <p className="text-xs text-muted-foreground">Weights are normalised to 100%.</p>
          </div>
          <Button size="sm" variant="soft" onClick={onReset}><RotateCcw /> Reset to AHP</Button>
        </div>
        <div className="space-y-5">
          {CRITERIA.map((c, i) => (
            <div key={c.key}>
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-medium">{c.label}</span>
                <span className="tabular-nums text-muted-foreground">{((normalized[i] ?? 0) * 100).toFixed(1)}%</span>
              </div>
              <Slider min={0} max={100} step={1} value={[weights[i] ?? 0]} onValueChange={(v) => onChange(i, v[0] ?? 0)} aria-label={`${c.label} weight`} />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border bg-card p-6 shadow-soft">
        <h3 className="font-semibold">Simulated ranking</h3>
        <p className={cn("mb-4 text-xs", leaderChanged ? "font-semibold text-brand" : "text-muted-foreground")}>
          {leaderChanged ? `New leader: ${simulated[0]?.product.name}` : "The top pick is unchanged."}
        </p>
        <ol className="space-y-2">
          {simulated.map((r) => {
            const delta = (baseRank.get(r.product.id) ?? r.rank) - r.rank;
            return (
              <li key={r.product.id} className="flex items-center gap-3 rounded-2xl border p-3 transition-all">
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold", r.rank === 1 ? "bg-brand text-brand-foreground" : "bg-secondary")}>{r.rank}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.product.name}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-brand-gradient transition-all duration-500" style={{ width: `${r.score * 100}%` }} /></div>
                </div>
                <span className="w-12 text-right text-xs tabular-nums">{r.score.toFixed(3)}</span>
                <span className={cn("flex w-10 items-center justify-end gap-0.5 text-xs font-semibold", delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground")}>
                  {delta > 0 ? <ArrowUp className="h-3 w-3" /> : delta < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  {delta !== 0 && Math.abs(delta)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
