import { Link } from "@tanstack/react-router";
import { Banknote, ShieldCheck, Truck } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/types";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t bg-surface">
      <div className="container-page grid gap-6 border-b py-8 sm:grid-cols-3">
        {[
          { icon: Truck, t: "Free delivery", d: "On every order, across India" },
          { icon: Banknote, t: "Cash on Delivery", d: "Pay when your laptop arrives" },
          { icon: ShieldCheck, t: "Decisions you can trust", d: "Transparent AHP + TOPSIS rankings" },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft"><Icon className="h-5 w-5 text-brand" /></div>
            <div>
              <p className="text-sm font-semibold">{t}</p>
              <p className="text-xs text-muted-foreground">{d}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="space-y-3 md:col-span-2">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            Smart shopping intelligence for laptops. Compare specifications, weigh what matters to you, and buy with confidence.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Shop</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {CATEGORIES.map((c) => (
              <li key={c}>
                <Link to="/laptops" search={{ category: c }} className="hover:text-foreground">{CATEGORY_LABELS[c]}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">BuySense</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/advisor" className="hover:text-foreground">Smart Advisor</Link></li>
            <li><Link to="/compare" className="hover:text-foreground">Compare laptops</Link></li>
            <li><Link to="/orders" className="hover:text-foreground">Track orders</Link></li>
            <li><Link to="/account" className="hover:text-foreground">My account</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-page border-t py-6 text-xs text-muted-foreground">
        © {new Date().getFullYear()} BuySense. Prices include GST.
      </div>
    </footer>
  );
}
