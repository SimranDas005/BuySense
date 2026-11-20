import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { KpiCard } from "@/components/admin/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { StockBadge } from "@/components/product/product-bits";
import { useProducts, useSetStock } from "@/hooks/use-shop";
import { LOW_STOCK_THRESHOLD } from "@/lib/api/admin";
import { formatCompactINR, formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { AlertTriangle, Boxes, PackageX } from "lucide-react";
import type { Product } from "@/lib/types";

export const Route = createFileRoute("/admin/inventory")({
  component: Inventory,
});

function Inventory() {
  const { data: products = [], isLoading } = useProducts();
  const [lowOnly, setLowOnly] = useState(false);
  const list = useMemo(
    () => [...products].filter((p) => !lowOnly || p.stock <= LOW_STOCK_THRESHOLD).sort((a, b) => a.stock - b.stock),
    [products, lowOnly],
  );
  const units = products.reduce((s, p) => s + p.stock, 0);
  const value = products.reduce((s, p) => s + p.stock * p.price, 0);
  const low = products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length;
  const out = products.filter((p) => p.stock === 0).length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Stock" title="Inventory" description={`Products with ${LOW_STOCK_THRESHOLD} or fewer units are flagged as low stock.`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard icon={Boxes} label="Units in stock" value={String(units)} hint={`Worth ${formatCompactINR(value)}`} loading={isLoading} />
        <KpiCard icon={AlertTriangle} label="Low stock" value={String(low)} hint="Products to reorder soon" loading={isLoading} />
        <KpiCard icon={PackageX} label="Out of stock" value={String(out)} hint="Hidden from the advisor" loading={isLoading} />
      </div>
      <div className="flex items-center gap-3">
        <Switch id="low" checked={lowOnly} onCheckedChange={setLowOnly} />
        <Label htmlFor="low">Show low and out of stock only</Label>
      </div>
      <div className="overflow-hidden rounded-3xl border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-4">Product</th><th className="p-4">Status</th><th className="p-4">Stock value</th><th className="p-4">Update stock</th></tr>
            </thead>
            <tbody>
              {isLoading
                ? <tr><td colSpan={4} className="p-4"><Skeleton className="h-24" /></td></tr>
                : list.map((p) => <StockRow key={`${p.id}-${p.stock}`} product={p} />)}
              {!isLoading && list.length === 0 && <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">Everything is well stocked.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StockRow({ product }: { product: Product }) {
  const [value, setValue] = useState(String(product.stock));
  const save = useSetStock();
  const parsed = Number(value);
  const valid = value !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= 100000;
  const dirty = valid && parsed !== product.stock;
  const commit = () =>
    save.mutate({ id: product.id, stock: parsed }, { onSuccess: () => toast.success(`${product.name}: stock set to ${parsed}`) });

  return (
    <tr className="border-t">
      <td className="p-4">
        <div className="flex items-center gap-3">
          <img src={resolveImage(product.images[0])} alt="" className="h-10 w-14 rounded-lg bg-surface object-cover" />
          <div><p className="font-semibold">{product.name}</p><p className="text-xs text-muted-foreground">{formatINR(product.price)} each</p></div>
        </div>
      </td>
      <td className="p-4"><StockBadge stock={product.stock} /></td>
      <td className="p-4 tabular-nums text-muted-foreground">{formatINR(product.stock * product.price)}</td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <Button size="icon-sm" variant="outline" aria-label="Decrease" onClick={() => setValue(String(Math.max(0, (valid ? parsed : product.stock) - 1)))}><Minus /></Button>
          <Input value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className="h-8 w-20 rounded-full text-center" aria-label={`Stock for ${product.name}`} aria-invalid={!valid} />
          <Button size="icon-sm" variant="outline" aria-label="Increase" onClick={() => setValue(String((valid ? parsed : product.stock) + 1))}><Plus /></Button>
          <Button size="sm" variant="ink" disabled={!dirty || save.isPending} onClick={commit}><Save /> Save</Button>
        </div>
      </td>
    </tr>
  );
}
