import type { ReactNode } from "react";
import heroImg from "@/assets/hero-laptop.jpg";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="container-page grid min-h-[calc(100vh-4rem)] items-center gap-10 py-10 lg:grid-cols-2">
      <div className="relative hidden h-full max-h-[640px] overflow-hidden rounded-[2rem] bg-ink-gradient p-10 text-ink-foreground lg:flex lg:flex-col">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">BuySense</p>
        <h2 className="mt-4 max-w-sm text-3xl font-semibold leading-tight">Smarter choices. Better laptops. Zero guesswork.</h2>
        <img src={heroImg} alt="" className="absolute -bottom-6 -right-16 w-[115%] max-w-none opacity-95 animate-float" />
      </div>
      <div className="mx-auto w-full max-w-md animate-fade-up">
        <h1 className="text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

export function safeRedirect(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}
