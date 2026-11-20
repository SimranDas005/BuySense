import { Link, useNavigate } from "@tanstack/react-router";
import {
  GitCompareArrows,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  User,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/common/logo";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-shop";
import { useCompareIds } from "@/lib/compare-store";

const NAV = [
  { to: "/laptops", label: "Laptops" },
  { to: "/advisor", label: "Smart Advisor" },
  { to: "/compare", label: "Compare" },
] as const;

function CountDot({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground">
      {n}
    </span>
  );
}

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const { summary } = useCart();
  const compareIds = useCompareIds();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    void navigate({ to: "/laptops", search: { q: q.trim() || undefined } });
    setOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/login", replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b glass">
      <div className="container-page flex h-16 items-center gap-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <SheetHeader>
              <SheetTitle className="text-left">Menu</SheetTitle>
            </SheetHeader>
            <form onSubmit={onSearch} className="relative mt-4 px-4">
              <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search laptops" className="rounded-full pl-9" />
            </form>
            <nav className="mt-4 flex flex-col px-2">
              {NAV.map((n) => (
                <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-base font-medium hover:bg-secondary" activeProps={{ className: "bg-secondary" }}>
                  {n.label}
                </Link>
              ))}
              <Link to="/wishlist" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-base font-medium hover:bg-secondary">Wishlist</Link>
              <Link to="/orders" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-base font-medium hover:bg-secondary">My orders</Link>
              {isAdmin && (
                <Link to="/admin" onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-base font-medium hover:bg-secondary">Admin dashboard</Link>
              )}
            </nav>
          </SheetContent>
        </Sheet>

        <Logo />

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              {n.to === "/advisor" && <Sparkles className="mr-1 inline h-3.5 w-3.5 text-brand" />}
              {n.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={onSearch} className="relative ml-auto hidden w-full max-w-xs lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search laptops, brands, chips…"
            aria-label="Search laptops"
            className="h-9 rounded-full border-transparent bg-secondary pl-9 focus-visible:bg-card"
          />
        </form>

        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          <Button variant="ghost" size="icon" className="relative hidden sm:inline-flex" asChild>
            <Link to="/compare" aria-label="Compare laptops">
              <GitCompareArrows />
              <CountDot n={compareIds.length} />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" asChild>
            <Link to="/wishlist" aria-label="Wishlist">
              <Heart />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link to="/cart" aria-label="Shopping bag">
              <ShoppingBag />
              <CountDot n={summary.itemCount} />
            </Link>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Account menu">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-bold text-ink-foreground">
                    {(user.fullName || user.email).slice(0, 1).toUpperCase()}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate font-semibold">{user.fullName || "My account"}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/account"><User />Profile</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/orders"><Package />My orders</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/wishlist"><Heart />Wishlist</Link></DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link to="/admin"><LayoutDashboard />Admin dashboard</Link></DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}><LogOut />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" variant="ink" className="ml-1" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
