import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, to = "/" }: { className?: string; to?: "/" | "/admin" }) {
  return (
    <Link to={to} className={cn("group flex items-center gap-2", className)} aria-label="BuySense home">
      <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-ink text-ink-foreground shadow-soft transition-transform group-hover:rotate-6">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 17h16" />
          <path d="M6 17V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9" />
          <path d="m9.5 12 2 2 3.5-4" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-background" />
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">
        Buy<span className="text-brand">Sense</span>
      </span>
    </Link>
  );
}
