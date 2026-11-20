import { Separator } from "@/components/ui/separator";
import { formatINR } from "@/lib/format";

export function OrderSummaryRows({ subtotal, savings, shipping, total }: { subtotal: number; savings: number; shipping: number; total: number }) {
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatINR(subtotal)}</dd></div>
      {savings > 0 && <div className="flex justify-between text-success"><dt>You save</dt><dd className="tabular-nums">−{formatINR(savings)}</dd></div>}
      <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd>{shipping === 0 ? "Free" : formatINR(shipping)}</dd></div>
      <Separator />
      <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(total)}</dd></div>
    </dl>
  );
}

