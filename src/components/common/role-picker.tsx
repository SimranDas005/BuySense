import { Check, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/types";

interface RolePickerProps {
  value: AppRole;
  onChange: (role: AppRole) => void;
  label?: string;
}

const OPTIONS = [
  {
    role: "customer" as const,
    title: "Customer",
    description: "Shop laptops, save favourites and track orders.",
    icon: UserRound,
  },
  {
    role: "admin" as const,
    title: "Admin",
    description: "Manage the catalogue, orders and store reports.",
    icon: ShieldCheck,
  },
];

/** Selectable Customer / Admin cards shared by the sign-in and sign-up pages. */
export function RolePicker({ value, onChange, label = "I am a" }: RolePickerProps) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">{label}</legend>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={label}>
        {OPTIONS.map(({ role, title, description, icon: Icon }) => {
          const selected = value === role;
          return (
            <button
              key={role}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(role)}
              className={cn(
                "relative rounded-2xl border p-4 text-left transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                selected
                  ? "border-brand bg-brand/5 shadow-soft"
                  : "bg-card hover:border-brand/50 hover:bg-secondary/40",
              )}
            >
              <span className="flex items-center justify-between">
                <Icon
                  className={cn("h-5 w-5", selected ? "text-brand" : "text-muted-foreground")}
                />
                {selected && (
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-brand-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </span>
              <span className="mt-3 block text-sm font-semibold">{title}</span>
              <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                {description}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
