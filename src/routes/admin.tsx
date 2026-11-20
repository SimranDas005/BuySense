import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { BarChart3, Boxes, LayoutDashboard, LogOut, Menu, Package, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/common/logo";
import { useAuth } from "@/hooks/use-auth";
import { getCurrentUser } from "@/lib/api/auth";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const u = await getCurrentUser();
    if (!u) throw redirect({ to: "/login", search: { redirect: location.href } });
    if (u.role !== "admin") throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Admin — BuySense" },
      { name: "description", content: "BuySense store administration." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin — BuySense" },
      { property: "og:description", content: "BuySense store administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Products", icon: Package, exact: false },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart, exact: false },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes, exact: false },
  { to: "/admin/reports", label: "Reports", icon: BarChart3, exact: false },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, exact }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={{ exact }}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          activeProps={{ className: "bg-sidebar-accent text-foreground" }}
        >
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
    </nav>
  );
}

function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const out = async () => {
    await signOut();
    void navigate({ to: "/login", replace: true });
  };

  const footer = (
    <div className="space-y-2 border-t pt-4">
      <div className="px-3 text-xs text-muted-foreground"><p className="truncate font-semibold text-foreground">{user?.fullName}</p><p className="truncate">{user?.email}</p></div>
      <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={out}><LogOut /> Sign out</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-8 border-r bg-sidebar p-5 lg:flex">
        <div className="flex items-center gap-2"><Logo to="/admin" /><span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase text-ink-foreground">Admin</span></div>
        <div className="flex-1"><NavLinks /></div>
        {footer}
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 glass lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Open admin menu"><Menu /></Button></SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col p-5">
            <SheetHeader className="p-0"><SheetTitle className="text-left">Admin</SheetTitle></SheetHeader>
            <div className="flex-1"><NavLinks onNavigate={() => setOpen(false)} /></div>
            {footer}
          </SheetContent>
        </Sheet>
        <Logo to="/admin" />
      </header>
      <main className="min-w-0 p-5 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
