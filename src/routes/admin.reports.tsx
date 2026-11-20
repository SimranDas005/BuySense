import { createFileRoute } from "@tanstack/react-router";
import { Download, IndianRupee, Receipt, ShoppingCart, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/admin/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { useAllOrders, useProducts } from "@/hooks/use-shop";
import { formatCompactINR, formatINR } from "@/lib/format";
import { dailySeries, filterByRange, ordersByStatus, ordersToCsv, revenueByCategory, topProducts } from "@/lib/reports";
import { ORDER_STATUS_LABELS } from "@/lib/types";

export const Route = createFileRoute("/admin/reports")({
  component: Reports,
});

const RANGES = [
  { v: "7", label: "Last 7 days" },
  { v: "30", label: "Last 30 days" },
  { v: "90", label: "Last 90 days" },
  { v: "all", label: "All time" },
] as const;

const lineConfig = { revenue: { label: "Revenue", color: "var(--chart-1)" }, orders: { label: "Orders", color: "var(--chart-3)" } } satisfies ChartConfig;
const barConfig = { revenue: { label: "Revenue", color: "var(--chart-2)" } } satisfies ChartConfig;
const STATUS_COLORS = ["var(--chart-3)", "var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--chart-5)"];

function Reports() {
  const { data: orders = [] } = useAllOrders();
  const { data: products = [] } = useProducts();
  const [range, setRange] = useState<(typeof RANGES)[number]["v"]>("30");
  const days = range === "all" ? null : Number(range);

  const inRange = useMemo(() => filterByRange(orders, days), [orders, days]);
  const live = inRange.filter((o) => o.status !== "cancelled");
  const revenue = live.reduce((s, o) => s + o.total, 0);
  const units = live.reduce((s, o) => s + o.items.reduce((u, i) => u + i.quantity, 0), 0);
  const seriesDays = useMemo(() => {
    if (days) return days;
    const first = orders.at(-1);
    if (!first) return 30;
    return Math.max(7, Math.ceil((Date.now() - new Date(first.createdAt).getTime()) / 86_400_000) + 1);
  }, [days, orders]);
  const series = useMemo(() => dailySeries(inRange, seriesDays), [inRange, seriesDays]);
  const byCat = useMemo(() => revenueByCategory(inRange, products), [inRange, products]);
  const byStatus = useMemo(() => ordersByStatus(inRange), [inRange]);
  const top = useMemo(() => topProducts(inRange), [inRange]);
  const statusConfig = Object.fromEntries(
    byStatus.map((s, i) => [s.status, { label: ORDER_STATUS_LABELS[s.status], color: STATUS_COLORS[i % 5] ?? "#888888" }]),
  ) satisfies ChartConfig;

  const exportCsv = () => {
    const blob = new Blob([ordersToCsv(inRange)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `buysense-orders-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const empty = inRange.length === 0;
  const Empty = () => <div className="grid h-64 place-items-center rounded-2xl bg-secondary text-sm text-muted-foreground">No orders in this period.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Sales reports"
        actions={
          <>
            <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
              <SelectTrigger className="w-40 rounded-full bg-card" aria-label="Report period"><SelectValue /></SelectTrigger>
              <SelectContent>{RANGES.map((r) => <SelectItem key={r.v} value={r.v}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv} disabled={empty}><Download /> Export CSV</Button>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={IndianRupee} label="Revenue" value={formatCompactINR(revenue)} hint="Excludes cancelled orders" />
        <KpiCard icon={ShoppingCart} label="Orders" value={String(inRange.length)} hint={`${inRange.length - live.length} cancelled`} />
        <KpiCard icon={Receipt} label="Average order value" value={live.length ? formatINR(revenue / live.length) : "—"} />
        <KpiCard icon={TrendingUp} label="Units sold" value={String(units)} />
      </div>

      <section className="rounded-3xl border bg-card p-6 shadow-soft">
        <h2 className="mb-4 font-semibold">Revenue over time</h2>
        {empty ? <Empty /> : (
          <ChartContainer config={lineConfig} className="h-72 w-full">
            <LineChart data={series} margin={{ left: 4, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={16} />
              <YAxis yAxisId="r" tickLine={false} axisLine={false} fontSize={11} width={60} tickFormatter={(v: number) => formatCompactINR(v)} />
              <YAxis yAxisId="o" orientation="right" tickLine={false} axisLine={false} fontSize={11} width={30} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line yAxisId="r" type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2.5} dot={false} />
              <Line yAxisId="o" type="monotone" dataKey="orders" stroke="var(--color-orders)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border bg-card p-6 shadow-soft">
          <h2 className="mb-4 font-semibold">Revenue by category</h2>
          {byCat.length === 0 ? <Empty /> : (
            <ChartContainer config={barConfig} className="h-64 w-full">
              <BarChart data={byCat} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v: number) => formatCompactINR(v)} />
                <YAxis type="category" dataKey="category" tickLine={false} axisLine={false} fontSize={12} width={90} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatINR(Number(v))} />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </section>
        <section className="rounded-3xl border bg-card p-6 shadow-soft">
          <h2 className="mb-4 font-semibold">Orders by status</h2>
          {byStatus.length === 0 ? <Empty /> : (
            <ChartContainer config={statusConfig} className="mx-auto h-64 w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
                <Pie data={byStatus} dataKey="count" nameKey="status" innerRadius={60} outerRadius={95} paddingAngle={3}>
                  {byStatus.map((s, i) => <Cell key={s.status} fill={STATUS_COLORS[i % 5]} />)}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="status" />} />
              </PieChart>
            </ChartContainer>
          )}
        </section>
      </div>

      <section className="rounded-3xl border bg-card shadow-soft">
        <h2 className="p-6 pb-2 font-semibold">Top products</h2>
        {top.length === 0 ? <p className="px-6 pb-6 text-sm text-muted-foreground">No sales in this period.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-6 py-3">#</th><th className="px-6 py-3">Product</th><th className="px-6 py-3">Units</th><th className="px-6 py-3 text-right">Revenue</th></tr></thead>
            <tbody>
              {top.map((t, i) => (
                <tr key={t.name} className="border-t"><td className="px-6 py-3 text-muted-foreground">{i + 1}</td><td className="px-6 py-3 font-medium">{t.name}</td><td className="px-6 py-3 tabular-nums">{t.units}</td><td className="px-6 py-3 text-right tabular-nums">{formatINR(t.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
