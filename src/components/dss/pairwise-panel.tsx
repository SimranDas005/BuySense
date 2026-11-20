import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { pairKey, sliderToSaaty, type AhpResult, type Judgments } from "@/lib/dss/ahp";
import type { Criterion } from "@/lib/dss/criteria";
import { cn } from "@/lib/utils";

const INTENSITY: Record<number, string> = { 1: "Equal", 2: "Slightly", 3: "Moderately", 4: "Moderately+", 5: "Strongly", 6: "Strongly+", 7: "Very strongly", 8: "Very strongly+", 9: "Extremely" };

export function PairwisePanel({
  criteria,
  judgments,
  onChange,
  ahp,
}: {
  criteria: Criterion[];
  judgments: Judgments;
  onChange: (key: string, v: number) => void;
  ahp: AhpResult;
}) {
  const pairs: [number, number][] = [];
  for (let i = 0; i < criteria.length; i++) for (let j = i + 1; j < criteria.length; j++) pairs.push([i, j]);

  return (
    <div>
      <div
        className={cn(
          "mb-4 flex items-start gap-3 rounded-2xl p-3 text-sm",
          ahp.consistent ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
        )}
      >
        {ahp.consistent ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        <div>
          <p className="font-semibold">
            Consistency ratio {ahp.cr.toFixed(3)} · {ahp.consistent ? "Consistent" : "Inconsistent"}
          </p>
          <p className="text-xs opacity-80">
            λmax {ahp.lambdaMax.toFixed(3)} · CI {ahp.ci.toFixed(3)}.{" "}
            {ahp.consistent ? "Your judgments are coherent (CR < 0.10)." : "Some judgments contradict each other — consider revising them (CR should be < 0.10)."}
          </p>
        </div>
      </div>
      <div className="max-h-[560px] space-y-1 overflow-y-auto pr-1">
        {pairs.map(([i, j]) => {
          const key = pairKey(i, j);
          const judgment = judgments[key] ?? 0; // >0 means left (i) more important
          const a = criteria[i]!;
          const b = criteria[j]!;
          const sv = sliderToSaaty(Math.abs(judgment));
          const label =
            judgment === 0 ? "Equally important" : `${judgment > 0 ? a.label : b.label} is ${INTENSITY[sv]?.toLowerCase()} more important (${sv}×)`;
          return (
            <div key={key} className="rounded-2xl px-2 py-3 transition-colors hover:bg-secondary">
              <div className="flex items-center justify-between text-sm">
                <span className={cn("font-medium", judgment > 0 && "text-brand")}>{a.label}</span>
                <span className={cn("font-medium", judgment < 0 && "text-brand")}>{b.label}</span>
              </div>
              <Slider
                className="my-2.5"
                min={-8}
                max={8}
                step={1}
                value={[-judgment]}
                onValueChange={(v) => onChange(key, -(v[0] ?? 0))}
                aria-label={`${a.label} versus ${b.label}`}
              />
              <p className="text-center text-xs text-muted-foreground">{label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
