import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/common/form-field";
import { useSaveProduct } from "@/hooks/use-shop";
import { PRESET_IMAGE_OPTIONS, resolveImage } from "@/lib/images";
import { CATEGORIES, CATEGORY_LABELS, type Product } from "@/lib/types";

const n = (label: string, min = 0, max = 10_000_000) => z.coerce.number({ invalid_type_error: `${label} must be a number` }).min(min, `${label} must be at least ${min}`).max(max);

const schema = z
  .object({
    name: z.string().trim().min(3, "Enter a product name").max(100),
    brand: z.string().trim().min(2, "Enter a brand").max(40),
    category: z.enum(CATEGORIES),
    tagline: z.string().trim().min(3, "Add a short tagline").max(120),
    description: z.string().trim().min(10, "Add a description").max(1500),
    price: n("Price", 1),
    mrp: n("MRP", 1),
    stock: z.coerce.number().int("Stock must be a whole number").min(0),
    featured: z.boolean(),
    presetImage: z.string(),
    imageUrls: z.string().max(2000),
    cpu: z.string().trim().min(2, "Required"),
    cpuScore: n("CPU index", 1, 100),
    gpu: z.string().trim().min(2, "Required"),
    gpuScore: n("GPU index", 1, 100),
    ramGb: n("RAM", 1, 512),
    storageGb: n("Storage", 32, 16384),
    storageType: z.string().trim().min(2),
    displaySize: n("Display size", 10, 20),
    displayResolution: z.string().trim().regex(/^\d{3,4}\s*[×x]\s*\d{3,4}$/, "Use the format 1920 × 1080"),
    displayType: z.string().trim().min(2, "Required"),
    refreshRate: n("Refresh rate", 30, 500),
    batteryHours: n("Battery", 1, 40),
    weightKg: n("Weight", 0.5, 6),
    os: z.string().trim().min(2, "Required"),
    ports: z.string().trim().min(2, "Required"),
  })
  .refine((v) => v.mrp >= v.price, { path: ["mrp"], message: "MRP can't be lower than the selling price" })
  .refine(
    (v) => v.imageUrls.split(/\n+/).map((s) => s.trim()).filter(Boolean).every((u) => /^https:\/\/\S+$/.test(u)),
    { path: ["imageUrls"], message: "Each image link must start with https://" },
  );

type FormValues = z.infer<typeof schema>;

function toForm(p: Product | null): FormValues {
  const preset = p?.images.find((i) => i.startsWith("preset:"))?.slice(7) ?? "everyday";
  return {
    name: p?.name ?? "",
    brand: p?.brand ?? "",
    category: p?.category ?? "everyday",
    tagline: p?.tagline ?? "",
    description: p?.description ?? "",
    price: p?.price ?? 0,
    mrp: p?.mrp ?? 0,
    stock: p?.stock ?? 0,
    featured: p?.featured ?? false,
    presetImage: preset,
    imageUrls: p?.images.filter((i) => !i.startsWith("preset:")).join("\n") ?? "",
    cpu: p?.specs.cpu ?? "",
    cpuScore: p?.specs.cpuScore ?? 50,
    gpu: p?.specs.gpu ?? "",
    gpuScore: p?.specs.gpuScore ?? 30,
    ramGb: p?.specs.ramGb ?? 16,
    storageGb: p?.specs.storageGb ?? 512,
    storageType: p?.specs.storageType ?? "SSD",
    displaySize: p?.specs.displaySize ?? 14,
    displayResolution: p?.specs.displayResolution ?? "1920 × 1080",
    displayType: p?.specs.displayType ?? "IPS",
    refreshRate: p?.specs.refreshRate ?? 60,
    batteryHours: p?.specs.batteryHours ?? 8,
    weightKg: p?.specs.weightKg ?? 1.5,
    os: p?.specs.os ?? "Windows 11 Home",
    ports: p?.specs.ports ?? "",
  };
}

export function ProductFormDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (o: boolean) => void; product: Product | null }) {
  const save = useSaveProduct();
  const { register, handleSubmit, control, reset, watch, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toForm(product) });
  useEffect(() => {
    if (open) reset(toForm(product));
  }, [open, product, reset]);
  const e = formState.errors;
  const preset = watch("presetImage");

  const onSubmit = handleSubmit(async (v) => {
    const urls = v.imageUrls.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    try {
      await save.mutateAsync({
        id: product?.id ?? null,
        input: {
          slug: product?.slug ?? "",
          name: v.name,
          brand: v.brand,
          category: v.category,
          tagline: v.tagline,
          description: v.description,
          price: v.price,
          mrp: v.mrp,
          stock: v.stock,
          featured: v.featured,
          images: [`preset:${v.presetImage}`, ...urls],
          specs: {
            cpu: v.cpu, cpuScore: v.cpuScore, gpu: v.gpu, gpuScore: v.gpuScore, ramGb: v.ramGb, storageGb: v.storageGb, storageType: v.storageType,
            displaySize: v.displaySize, displayResolution: v.displayResolution.replace(/\s*[x×]\s*/, " × "), displayType: v.displayType, refreshRate: v.refreshRate,
            batteryHours: v.batteryHours, weightKg: v.weightKg, os: v.os, ports: v.ports,
          },
        },
      });
      onOpenChange(false);
    } catch {
      /* notification already shown */
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{product ? `Edit ${product.name}` : "Add a laptop"}</DialogTitle>
          <DialogDescription>Fields marked with an index (1–100) feed the BuySense decision engine.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Basics</legend>
            <FormField label="Product name" error={e.name?.message} {...register("name")} />
            <FormField label="Brand" error={e.brand?.message} {...register("brand")} />
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Controller control={control} name="category" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
            <FormField label="Tagline" error={e.tagline?.message} {...register("tagline")} />
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} className="rounded-xl" {...register("description")} />
              {e.description && <p className="text-xs font-medium text-destructive">{e.description.message}</p>}
            </div>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-semibold">Pricing & stock</legend>
            <FormField label="Selling price (₹)" type="number" inputMode="numeric" error={e.price?.message} {...register("price")} />
            <FormField label="MRP (₹)" type="number" inputMode="numeric" error={e.mrp?.message} {...register("mrp")} />
            <FormField label="Stock (units)" type="number" inputMode="numeric" error={e.stock?.message} {...register("stock")} />
            <label className="flex items-center gap-3 text-sm sm:col-span-3">
              <Controller control={control} name="featured" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              Feature on the home page
            </label>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <legend className="mb-2 text-sm font-semibold">Images</legend>
            <img src={resolveImage(`preset:${preset}`)} alt="" className="aspect-[4/3] w-full rounded-2xl bg-surface object-cover" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Main photo</Label>
                <Controller control={control} name="presetImage" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{PRESET_IMAGE_OPTIONS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="imageUrls">Extra image links (optional, one per line)</Label>
                <Textarea id="imageUrls" rows={2} placeholder="https://…" className="rounded-xl" {...register("imageUrls")} />
                {e.imageUrls && <p className="text-xs font-medium text-destructive">{e.imageUrls.message}</p>}
              </div>
            </div>
          </fieldset>

          <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <legend className="mb-2 text-sm font-semibold">Specifications</legend>
            <FormField label="Processor" error={e.cpu?.message} {...register("cpu")} />
            <FormField label="CPU index (1–100)" type="number" error={e.cpuScore?.message} {...register("cpuScore")} />
            <FormField label="Graphics" error={e.gpu?.message} {...register("gpu")} />
            <FormField label="GPU index (1–100)" type="number" error={e.gpuScore?.message} {...register("gpuScore")} />
            <FormField label="RAM (GB)" type="number" error={e.ramGb?.message} {...register("ramGb")} />
            <FormField label="Storage (GB)" type="number" error={e.storageGb?.message} {...register("storageGb")} />
            <FormField label="Storage type" error={e.storageType?.message} {...register("storageType")} />
            <FormField label="Display size (inches)" type="number" step="0.1" error={e.displaySize?.message} {...register("displaySize")} />
            <FormField label="Resolution" placeholder="1920 × 1080" error={e.displayResolution?.message} {...register("displayResolution")} />
            <FormField label="Panel type" error={e.displayType?.message} {...register("displayType")} />
            <FormField label="Refresh rate (Hz)" type="number" error={e.refreshRate?.message} {...register("refreshRate")} />
            <FormField label="Battery (hours)" type="number" step="0.5" error={e.batteryHours?.message} {...register("batteryHours")} />
            <FormField label="Weight (kg)" type="number" step="0.01" error={e.weightKg?.message} {...register("weightKg")} />
            <FormField label="Operating system" error={e.os?.message} {...register("os")} />
            <FormField className="sm:col-span-2 lg:col-span-3" label="Ports" error={e.ports?.message} {...register("ports")} />
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="ink" disabled={formState.isSubmitting}>{formState.isSubmitting && <Loader2 className="animate-spin" />} {product ? "Save changes" : "Add laptop"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
