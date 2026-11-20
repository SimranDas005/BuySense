import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductFormDialog } from "@/components/admin/product-form-dialog";
import { PageHeader } from "@/components/common/page-header";
import { StockBadge } from "@/components/product/product-bits";
import { useDeleteProduct, useProducts } from "@/hooks/use-shop";
import { formatINR } from "@/lib/format";
import { resolveImage } from "@/lib/images";
import { CATEGORY_LABELS, type Product } from "@/lib/types";

export const Route = createFileRoute("/admin/products")({
  component: ProductsAdmin,
});

function ProductsAdmin() {
  const { data: products = [], isLoading } = useProducts();
  const del = useDeleteProduct();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? products.filter((p) => `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(t)) : products;
  }, [products, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description={`${products.length} laptops in the catalogue`}
        actions={<Button variant="ink" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Add laptop</Button>}
      />
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="rounded-full bg-card pl-9" aria-label="Search products" />
      </div>
      <div className="overflow-hidden rounded-3xl border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-4">Product</th><th className="p-4">Category</th><th className="p-4">Price</th><th className="p-4">Stock</th><th className="p-4 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }, (_, i) => <tr key={i} className="border-t"><td colSpan={5} className="p-4"><Skeleton className="h-10" /></td></tr>)
                : list.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img src={resolveImage(p.images[0])} alt="" className="h-11 w-14 rounded-lg bg-surface object-cover" />
                          <div>
                            <p className="flex items-center gap-1.5 font-semibold">{p.name}{p.featured && <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-label="Featured" />}</p>
                            <p className="text-xs text-muted-foreground">{p.brand}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{CATEGORY_LABELS[p.category]}</td>
                      <td className="p-4 tabular-nums">{formatINR(p.price)}</td>
                      <td className="p-4"><div className="flex items-center gap-2"><span className="tabular-nums">{p.stock}</span><StockBadge stock={p.stock} /></div></td>
                      <td className="p-4">
                        <div className="flex justify-end gap-1">
                          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => { setEditing(p); setFormOpen(true); }}><Pencil /></Button>
                          <Button size="icon-sm" variant="ghost" className="text-destructive" aria-label={`Delete ${p.name}`} onClick={() => setToDelete(p)}><Trash2 /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              {!isLoading && list.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No products match "{q}".</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>It will be removed from the store. Past orders keep their details.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => toDelete && del.mutate(toDelete.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
