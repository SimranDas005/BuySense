import type { Criterion } from "@/lib/dss/criteria";

export function WeightsChart({ criteria, weights }: { criteria: Criterion[]; weights: number[] }) {
  const max = Math.max(...weights, 0.0001);
  return (
    <div className="space-y-3">
      {criteria.map((c, i) => {
        const w = weights[i] ?? 0;
        return (
          <div key={c.key} className="grid grid-cols-[96px_1fr_48px] items-center gap-3 text-sm">
            <span className="truncate font-medium">{c.label}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-brand-gradient transition-all duration-500" style={{ width: `${(w / max) * 100}%` }} />
            </div>
            <span className="text-right tabular-nums text-muted-foreground">{(w * 100).toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}
