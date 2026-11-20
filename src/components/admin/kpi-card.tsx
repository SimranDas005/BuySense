import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function KpiCard({ icon: Icon, label, value, hint, loading }: { icon: LucideIcon; label: string; value: string; hint?: string; loading?: boolean }) {
  return (
    <div className="rounded-3xl border bg-card p-5 shadow-soft animate-fade-up">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="h-4 w-4" /></div>
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-28" /> : <p className="mt-3 font-display text-2xl font-semibold tabular-nums md:text-3xl">{value}</p>}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
