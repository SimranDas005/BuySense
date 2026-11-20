import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  max,
  onChange,
  disabled,
  className,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center rounded-full border bg-card", className)}>
      <button
        type="button"
        aria-label="Decrease quantity"
        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 1}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
