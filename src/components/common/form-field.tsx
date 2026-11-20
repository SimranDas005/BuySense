import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | undefined; hint?: string };

export const FormField = forwardRef<HTMLInputElement, Props>(function FormField({ label, error, hint, id, className, ...rest }, ref) {
  const fid = id ?? rest.name;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={fid}>{label}</Label>
      <Input ref={ref} id={fid} aria-invalid={!!error} className={cn("h-11 rounded-xl bg-card", error && "border-destructive")} {...rest} />
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
});
