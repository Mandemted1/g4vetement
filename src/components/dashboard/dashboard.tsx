"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, Pie, PieChart, XAxis, YAxis } from "recharts"
import { ArrowDownRightIcon, ArrowUpRightIcon, AlertTriangleIcon, ArrowRightIcon, DollarSignIcon, ReceiptIcon, ShoppingBagIcon, UserPlusIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProductThumb } from "@/components/product-thumb"
import { CountUp } from "@/components/count-up"
import { StatusBadge } from "@/components/status-badge"
import { getBriefing, getDashboard, RANGES, type Range, type Kpi } from "@/lib/analytics"
import { stockState, ADMIN_NAME } from "@/lib/data"
import { useAdmin } from "@/components/admin-data"
import { compact, dateLabel, dayLabel, initials, int, longDate, money, moneyShort, pct, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
}

function Delta({ d, hasPrev }: { d: number | null; hasPrev: boolean }) {
  if (d === null) return <span className="text-xs text-muted-foreground">{hasPrev ? "—" : "All-time total"}</span>
  const up = d >= 0
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium", up ? "bg-positive/12 text-[oklch(0.42_0.12_155)] dark:text-positive" : "bg-negative/12 text-negative")}>
        <Icon className="size-3" />
        {pct(Math.abs(d)).replace("+", "")}
      </span>
      <span className="text-muted-foreground">vs previous period</span>
    </span>
  )
}

function KpiCard({ title, icon: Icon, kpi, format, hasPrev, i }: { title: string; icon: React.ElementType; kpi: Kpi; format: (n: number) => string; hasPrev: boolean; i: number }) {
  return (
    <Card className="rise" style={{ "--i": i } as React.CSSProperties}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="size-4" />
          {title}
        </div>
        <div className="text-3xl font-semibold tracking-tight">
          <CountUp value={kpi.value} format={format} />
        </div>
        <Delta d={kpi.delta} hasPrev={hasPrev} />
      </CardContent>
    </Card>
  )
}

const revConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  previous: { label: "Previous period", color: "var(--chart-3)" },
} satisfies ChartConfig

const CAT_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

export function Dashboard() {
  const [range, setRange] = useState<Range>("all")
  const admin = useAdmin()
  const { orders, products, customerById, today: TODAY } = admin
  const d = useMemo(() => getDashboard(range, admin), [range, admin])
  const b = useMemo(() => getBriefing(admin), [admin])
  const k = d.kpis

  const recent = useMemo(() => orders.slice(-8).reverse(), [orders])
  const lowStock = useMemo(() => products.filter((p) => stockState(p) !== "ok").sort((a, b) => a.stock - b.stock), [products])
  const catTotal = d.categories.reduce((s, c) => s + c.revenue, 0)
  const statusTotal = d.statusCounts.pending + d.statusCounts.processing + d.statusCounts.shipped + d.statusCounts.delivered
  const statusBars = [
    { key: "delivered", label: "Delivered", color: "var(--chart-1)" },
    { key: "shipped", label: "Shipped", color: "var(--chart-2)" },
    { key: "processing", label: "Processing", color: "var(--chart-3)" },
    { key: "pending", label: "Pending", color: "var(--chart-4)" },
  ] as const
  const maxProd = d.topProducts[0]?.revenue ?? 1
  const rangeLabel = range === "all" ? `${dateLabel(d.from)} – ${dateLabel(d.to)}` : `${dayLabel(d.from)} – ${dateLabel(d.to)}`

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting + briefing */}
      <div className="rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <span suppressHydrationWarning>{greeting()}</span>, {ADMIN_NAME}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            It&apos;s {longDate(TODAY)}. You have <b className="font-medium text-foreground">{b.toFulfill} orders</b> to fulfill
            {b.pending ? ` (${b.pending} still pending)` : ""} and <b className="font-medium text-foreground">{b.lowStock} products</b> low on stock
            {b.outOfStock ? `, ${b.outOfStock} sold out` : ""}. Today so far: {b.todayOrders} orders, {money(b.todayRevenue)}.
          </p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList>
            {RANGES.map((r) => (
              <TabsTrigger key={r.value} value={r.value}>{r.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">Showing {rangeLabel}</p>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard i={1} title="Total revenue" icon={DollarSignIcon} kpi={k.revenue} format={(n) => money(n)} hasPrev={d.hasPrev} />
        <KpiCard i={2} title="Orders" icon={ShoppingBagIcon} kpi={k.orders} format={(n) => int(Math.round(n))} hasPrev={d.hasPrev} />
        <KpiCard i={3} title="Avg. order value" icon={ReceiptIcon} kpi={k.aov} format={(n) => money(n)} hasPrev={d.hasPrev} />
        <KpiCard i={4} title="New customers" icon={UserPlusIcon} kpi={k.newCustomers} format={(n) => int(Math.round(n))} hasPrev={d.hasPrev} />
      </div>

      {/* Revenue chart + status */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rise xl:col-span-2" style={{ "--i": 5 } as React.CSSProperties}>
          <CardHeader>
            <CardTitle>Revenue</CardTitle>
            <CardDescription>{range === "7d" || range === "30d" ? "Daily" : "Weekly"} booked revenue{d.hasPrev ? " vs previous period" : ""}</CardDescription>
            <CardAction className="text-right">
              <div className="text-2xl font-semibold tabular">{money(k.revenue.value)}</div>
              <div className="text-xs text-muted-foreground">{int(k.orders.value)} orders</div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revConfig} className="h-[280px] w-full">
              <AreaChart data={d.series} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fillRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="short" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
                <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => compact(v)} />
                <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltipContent labelFormatter={(_, p) => p?.[0]?.payload?.label} formatter={(v, n) => (
                  <div className="flex w-full items-center justify-between gap-6">
                    <span className="text-muted-foreground">{revConfig[n as keyof typeof revConfig]?.label}</span>
                    <span className="font-mono font-medium tabular">{money(Number(v))}</span>
                  </div>
                )} />} />
                <Area dataKey="revenue" type="monotone" stroke="var(--color-revenue)" strokeWidth={2} fill="url(#fillRev)" animationDuration={700} />
                {d.hasPrev && <Line dataKey="previous" type="monotone" stroke="var(--color-previous)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} animationDuration={700} />}
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rise" style={{ "--i": 6 } as React.CSSProperties}>
          <CardHeader>
            <CardTitle>Order status</CardTitle>
            <CardDescription>{int(statusTotal)} fulfilled-or-open orders</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              {statusBars.map((s) => (
                <div key={s.key} className="h-full transition-all duration-700" style={{ width: `${statusTotal ? (d.statusCounts[s.key] / statusTotal) * 100 : 0}%`, background: s.color }} />
              ))}
            </div>
            <ul className="flex flex-col gap-2.5 text-sm">
              {statusBars.map((s) => (
                <li key={s.key} className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
                  <span className="tabular text-muted-foreground">{int(d.statusCounts[s.key])} <span className="text-xs">({statusTotal ? ((d.statusCounts[s.key] / statusTotal) * 100).toFixed(1) : 0}%)</span></span>
                </li>
              ))}
            </ul>
            <div className="mt-1 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
              <div><div className="text-xs text-muted-foreground">Cancelled</div><div className="font-medium tabular">{d.statusCounts.cancelled}</div></div>
              <div><div className="text-xs text-muted-foreground">Refunded</div><div className="font-medium tabular">{d.summary.refundsCount} · {money(d.summary.refundsValue)}</div></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue breakdown + category + channel */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rise" style={{ "--i": 7 } as React.CSSProperties}>
          <CardHeader>
            <CardTitle>How revenue adds up</CardTitle>
            <CardDescription>Gross sales to booked revenue</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Row label="Gross sales" value={money(d.summary.grossSales)} />
            <Row label="Discounts" value={`−${money(d.summary.discounts)}`} muted />
            <Row label="Shipping collected" value={`+${money(d.summary.shipping)}`} muted />
            <div className="flex items-center justify-between border-t pt-3 font-semibold">
              <span>Total revenue</span>
              <span className="tabular">{money(d.summary.grossSales - d.summary.discounts + d.summary.shipping)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{int(d.summary.units)} units sold · excludes cancelled and refunded orders.</p>
          </CardContent>
        </Card>

        <Card className="rise" style={{ "--i": 8 } as React.CSSProperties}>
          <CardHeader>
            <CardTitle>Sales by category</CardTitle>
            <CardDescription>Net of discounts, excl. shipping</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <ChartContainer config={{}} className="aspect-square h-[150px] shrink-0">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel formatter={(v, n) => <span className="flex w-full justify-between gap-4"><span>{n}</span><span className="font-mono font-medium">{money(Number(v))}</span></span>} />} />
                <Pie data={d.categories} dataKey="revenue" nameKey="name" innerRadius={44} outerRadius={70} strokeWidth={2} paddingAngle={1} animationDuration={700}>
                  {d.categories.map((c, i) => <Cell key={c.name} fill={CAT_COLORS[i % 5]} />)}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
              {d.categories.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2"><span className="size-2.5 shrink-0 rounded-full border" style={{ background: CAT_COLORS[i % 5] }} /><span className="truncate">{c.name}</span></span>
                  <span className="tabular text-muted-foreground">{moneyShort(c.revenue)} · {catTotal ? Math.round((c.revenue / catTotal) * 100) : 0}%</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rise" style={{ "--i": 9 } as React.CSSProperties}>
          <CardHeader>
            <CardTitle>Traffic sources</CardTitle>
            <CardDescription>Revenue by acquisition channel</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ revenue: { label: "Revenue", color: "var(--chart-1)" } }} className="h-[150px] w-full">
              <BarChart data={d.channels} layout="vertical" margin={{ left: 0, right: 8 }}>
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={68} />
                <XAxis type="number" hide />
                <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent hideLabel formatter={(v, n, item) => <span className="flex w-full justify-between gap-4"><span>{item.payload.name}</span><span className="font-mono font-medium">{money(Number(v))}</span></span>} />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} barSize={14} animationDuration={700} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top products + low stock */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rise lg:col-span-2" style={{ "--i": 10 } as React.CSSProperties}>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
            <CardDescription>Best sellers by revenue</CardDescription>
            <CardAction><Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/products" />}>View all <ArrowRightIcon /></Button></CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {d.topProducts.slice(0, 6).map((t, i) => (
              <div key={t.product.id} className="flex items-center gap-3">
                <span className="w-4 text-xs text-muted-foreground tabular">{i + 1}</span>
                <ProductThumb image={t.product.images[0]} color={t.product.colors[0]?.hex ?? "#999"} className="size-9 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{t.product.name}</span>
                    <span className="tabular font-medium">{money(t.revenue)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground transition-all duration-700" style={{ width: `${(t.revenue / maxProd) * 100}%` }} /></div>
                    <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular">{t.units} sold</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rise" style={{ "--i": 11 } as React.CSSProperties}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangleIcon className="size-4 text-warning" /> Stock alerts</CardTitle>
            <CardDescription>{lowStock.length} products at or below reorder level</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {lowStock.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <ProductThumb image={p.images[0]} color={p.colors[0]?.hex ?? "#999"} className="size-8 rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">Reorder at {p.reorderLevel}</div>
                </div>
                <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium tabular", p.stock === 0 ? "bg-negative/12 text-negative" : "bg-warning/15 text-[oklch(0.5_0.12_70)] dark:text-warning")}>
                  {p.stock === 0 ? "Sold out" : `${p.stock} left`}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card className="rise" style={{ "--i": 12 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
          <CardDescription>The latest 8 orders across the store</CardDescription>
          <CardAction><Button variant="outline" size="sm" nativeButton={false} render={<Link href="/admin/orders" />}>All orders <ArrowRightIcon /></Button></CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Placed</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((o) => {
                const c = customerById.get(o.customerId) ?? { name: "Guest", email: "" }
                return (
                  <TableRow key={o.id} className="transition-colors">
                    <TableCell className="font-medium">#{o.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-7"><AvatarFallback className="text-[10px]">{initials(c.name)}</AvatarFallback></Avatar>
                        <span className="truncate">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{plural(o.items.reduce((s, i) => s + i.qty, 0), "item")}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{relativeTime(o.date, TODAY + 86_399_000)}</TableCell>
                    <TableCell className="text-right font-medium tabular">{money(o.total)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  )
}
