import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Boxes, IndianRupee, ShoppingCart, Users } from "lucide-react";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { KpiCard } from "@/components/admin/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { OrderStatusBadge } from "@/components/common/status-badge";
import { useAllOrders, useDashboardStats, useProducts } from "@/hooks/use-shop";
import { LOW_STOCK_THRESHOLD } from "@/lib/api/admin";
import { formatCompactINR, formatDate, formatINR } from "@/lib/format";
import { dailySeries } from "@/lib/reports";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

const chartConfig = { revenue: { label: "Revenue", color: "var(--chart-1)" } } satisfies ChartConfig;

function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: orders = [] } = useAllOrders();
  const { data: products = [] } = useProducts();
  const series = useMemo(() => dailySeries(orders, 14), [orders]);
  const low = products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD).sort((a, b) => a.stock - b.stock);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Overview" title="Dashboard" description="Live figures from your store's orders, customers and stock." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={IndianRupee} label="Revenue" loading={isLoading} value={formatCompactINR(stats?.revenue ?? 0)} hint="Excludes cancelled orders" />
        <KpiCard icon={ShoppingCart} label="Orders" loading={isLoading} value={String(stats?.orders ?? 0)} hint={`${stats?.openOrders ?? 0} open`} />
        <KpiCard icon={Users} label="Customers" loading={isLoading} value={String(stats?.customers ?? 0)} hint="Registered accounts" />
        <KpiCard icon={Boxes} label="Inventory" loading={isLoading} value={`${stats?.inventoryUnits ?? 0} units`} hint={`${formatCompactINR(stats?.inventoryValue ?? 0)} across ${stats?.products ?? 0} products`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-3xl border bg-card p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Revenue · last 14 days</h2>
            <Button variant="link" size="sm" asChild><Link to="/admin/reports">Full reports</Link></Button>
          </div>
          {orders.length === 0 ? (
            <div className="grid h-64 place-items-center rounded-2xl bg-secondary text-center text-sm text-muted-foreground">
              No orders yet. Revenue will chart here as customers place orders.
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <AreaChart data={series} margin={{ left: 4, right: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-revenue)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={60} tickFormatter={(v: number) => formatCompactINR(v)} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ChartContainer>
          )}
        </section>

        <section className="rounded-3xl border bg-card p-6 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-warning" /> Low stock</h2>
            <Button variant="link" size="sm" asChild><Link to="/admin/inventory">Manage</Link></Button>
          </div>
          {low.length === 0 ? (
            <p className="text-sm text-muted-foreground">All products have more than {LOW_STOCK_THRESHOLD} units.</p>
          ) : (
            <ul className="divide-y">
              {low.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="truncate pr-3">{p.name}</span>
                  <span className={p.stock === 0 ? "font-semibold text-destructive" : "font-semibold text-warning"}>{p.stock === 0 ? "Out" : `${p.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-3xl border bg-card shadow-soft">
        <div className="flex items-center justify-between p-6 pb-2">
          <h2 className="font-semibold">Recent orders</h2>
          <Button variant="link" size="sm" asChild><Link to="/admin/orders">All orders</Link></Button>
        </div>
        {orders.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No orders have been placed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-6 py-3">Order</th><th className="px-6 py-3">Customer</th><th className="px-6 py-3">Date</th><th className="px-6 py-3">Total</th><th className="px-6 py-3">Status</th></tr>
              </thead>
              <tbody>
                {orders.slice(0, 6).map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="px-6 py-3 font-medium">{o.orderNumber}</td>
                    <td className="px-6 py-3">{o.customerName}</td>
                    <td className="px-6 py-3 text-muted-foreground">{formatDate(o.createdAt)}</td>
                    <td className="px-6 py-3 tabular-nums">{formatINR(o.total)}</td>
                    <td className="px-6 py-3"><OrderStatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
