"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { EyeIcon, MousePointerClickIcon, UsersIcon, ShoppingBagIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { CountUp } from "@/components/count-up"
import { useAdmin } from "@/components/admin-data"
import { getLive, getOverview, type Live, type Overview } from "@/app/admin/(panel)/analytics/actions"
import { dayLabel, int } from "@/lib/format"

const config = { visitors: { label: "Visitors", color: "var(--chart-1)" }, views: { label: "Page views", color: "var(--chart-3)" } } satisfies ChartConfig
const DAY = 86_400_000

const flag = (cc: string) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : "🌐")
const names = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null
const country = (cc: string) => (names && /^[A-Z]{2}$/.test(cc) ? (names.of(cc) ?? cc) : cc)

export function AnalyticsView({ initial, initialError }: { initial: Overview | null; initialError: string | null }) {
  const { productById } = useAdmin()
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Overview | null>(initial)
  const [error, setError] = useState<string | null>(initialError)
  const [live, setLive] = useState<Live | null>(null)
  const [pending, start] = useTransition()

  const change = (d: number) => {
    setDays(d)
    start(async () => {
      const r = await getOverview(d)
      if (r.ok) {
        setData(r.data)
        setError(null)
      } else setError(r.error)
    })
  }

  // live visitors: poll every 15s
  useEffect(() => {
    let alive = true
    const tick = async () => {
      const l = await getLive()
      if (alive) setLive(l)
    }
    tick()
    const t = window.setInterval(tick, 15_000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])

  // fill days with no traffic so the chart has no gaps
  const series = useMemo(() => {
    if (!data) return []
    const map = new Map(data.daily.map((d) => [d.d, d]))
    const out: { label: string; visitors: number; views: number }[] = []
    const end = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
    for (let i = days - 1; i >= 0; i--) {
      const t = end - i * DAY
      const key = new Date(t).toISOString().slice(0, 10)
      const row = map.get(key)
      out.push({ label: dayLabel(t), visitors: row?.visitors ?? 0, views: row?.views ?? 0 })
    }
    return out
  }, [data, days])

  if (error && !data) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">{error}</p>
      </div>
    )
  }
  const d = data!
  const conv = d.funnel.visitors ? (d.funnel.purchase / d.funnel.visitors) * 100 : 0
  const steps = [
    { label: "Visitors", v: d.funnel.visitors },
    { label: "Viewed a product", v: d.funnel.product_view },
    { label: "Added to bag", v: d.funnel.add_to_cart },
    { label: "Started checkout", v: d.funnel.checkout_start },
    { label: "Purchased", v: d.funnel.purchase },
  ]
  const maxDev = Math.max(1, ...d.devices.map((x) => x.visitors))

  return (
    <div className="flex flex-col gap-6">
      <div className="rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Who&apos;s visiting the store and what they do. Anonymous and cookie-free.</p>
        </div>
        <Tabs value={String(days)} onValueChange={(v) => change(Number(v))}>
          <TabsList>
            {[7, 30, 90].map((n) => <TabsTrigger key={n} value={String(n)}>{n}D</TabsTrigger>)}
          </TabsList>
        </Tabs>
      </div>

      {/* live */}
      <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <CardContent className="grid gap-6 md:grid-cols-[auto_1fr_1fr_1fr] md:items-center">
          <div className="flex items-center gap-4">
            <span className="relative flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-60" />
              <span className="relative inline-flex size-3 rounded-full bg-positive" />
            </span>
            <div>
              <div className="text-4xl font-semibold tabular"><CountUp value={live?.visitors ?? 0} format={(n) => String(Math.round(n))} /></div>
              <div className="text-xs text-muted-foreground">on the store right now</div>
            </div>
          </div>
          <MiniList title="Looking at" rows={(live?.pages ?? []).map((p) => ({ k: p.path, v: p.visitors }))} empty="No one right now" />
          <MiniList title="From" rows={(live?.countries ?? []).map((c) => ({ k: `${flag(c.name)} ${country(c.name)}`, v: c.visitors }))} empty="–" />
          <div>
            <p className="text-xs text-muted-foreground">With items in bag</p>
            <p className="mt-1 text-2xl font-semibold tabular">{live?.carts ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 transition-opacity ${pending ? "opacity-60" : ""}`}>
        <Kpi i={2} icon={UsersIcon} label="Visitors" value={d.visitors} />
        <Kpi i={3} icon={EyeIcon} label="Page views" value={d.pageviews} />
        <Kpi i={4} icon={MousePointerClickIcon} label="Sessions" value={d.sessions} />
        <Kpi i={5} icon={ShoppingBagIcon} label="Conversion" value={conv} format={(n) => `${n.toFixed(1)}%`} />
      </div>

      <Card className="rise" style={{ "--i": 6 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle>Traffic</CardTitle>
          <CardDescription>Daily visitors and page views, last {days} days</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={config} className="h-[260px] w-full">
            <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="fillVis" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-visitors)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-visitors)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} />
              <YAxis tickLine={false} axisLine={false} width={36} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area dataKey="views" type="monotone" stroke="var(--color-views)" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
              <Area dataKey="visitors" type="monotone" stroke="var(--color-visitors)" strokeWidth={2} fill="url(#fillVis)" />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rise" style={{ "--i": 7 } as React.CSSProperties}>
          <CardHeader><CardTitle>Shopping funnel</CardTitle><CardDescription>Unique visitors at each step</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3.5">
            {steps.map((s, i) => (
              <div key={s.label}>
                <div className="mb-1 flex justify-between text-sm"><span>{s.label}</span><span className="tabular text-muted-foreground">{int(s.v)}{i > 0 && steps[i - 1].v ? ` · ${Math.round((s.v / steps[i - 1].v) * 100)}%` : ""}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground transition-all duration-700" style={{ width: `${steps[0].v ? (s.v / steps[0].v) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rise" style={{ "--i": 8 } as React.CSSProperties}>
          <CardHeader><CardTitle>Where they come from</CardTitle><CardDescription>Visitors by first touch</CardDescription></CardHeader>
          <CardContent><Bars rows={d.sources.map((s) => ({ k: s.name, v: s.visitors }))} /></CardContent>
        </Card>

        <Card className="rise" style={{ "--i": 9 } as React.CSSProperties}>
          <CardHeader><CardTitle>Countries</CardTitle><CardDescription>Needs the site hosted on Vercel</CardDescription></CardHeader>
          <CardContent><Bars rows={d.countries.map((c) => ({ k: `${flag(c.name)} ${country(c.name)}`, v: c.visitors }))} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rise lg:col-span-2" style={{ "--i": 10 } as React.CSSProperties}>
          <CardHeader><CardTitle>Top pages</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2 font-normal">Page</th><th className="pb-2 text-right font-normal">Visitors</th><th className="pb-2 text-right font-normal">Views</th></tr></thead>
              <tbody>
                {d.pages.map((p) => (
                  <tr key={p.path} className="border-t"><td className="max-w-[260px] truncate py-2.5">{p.path}</td><td className="py-2.5 text-right tabular">{int(p.visitors)}</td><td className="py-2.5 text-right tabular text-muted-foreground">{int(p.views)}</td></tr>
                ))}
                {d.pages.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No visits yet.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="rise" style={{ "--i": 11 } as React.CSSProperties}>
            <CardHeader><CardTitle>Devices</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {d.devices.map((x) => (
                <div key={x.name}>
                  <div className="mb-1 flex justify-between text-sm"><span>{x.name}</span><span className="tabular text-muted-foreground">{int(x.visitors)}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground" style={{ width: `${(x.visitors / maxDev) * 100}%` }} /></div>
                </div>
              ))}
              {d.devices.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
            </CardContent>
          </Card>
          <Card className="rise" style={{ "--i": 12 } as React.CSSProperties}>
            <CardHeader><CardTitle>Most viewed products</CardTitle></CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2.5 text-sm">
                {d.products.slice(0, 5).map((p) => (
                  <li key={p.product_id} className="flex items-center justify-between gap-3"><span className="truncate">{productById.get(p.product_id)?.name ?? p.product_id}</span><span className="shrink-0 text-xs text-muted-foreground tabular">{int(p.views)} views · {int(p.adds)} added</span></li>
                ))}
                {d.products.length === 0 && <li className="text-muted-foreground">No data yet.</li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Kpi({ i, icon: Icon, label, value, format = (n: number) => int(Math.round(n)) }: { i: number; icon: React.ElementType; label: string; value: number; format?: (n: number) => string }) {
  return (
    <Card className="rise" style={{ "--i": i } as React.CSSProperties}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" />{label}</div>
        <div className="text-3xl font-semibold tracking-tight"><CountUp value={value} format={format} /></div>
      </CardContent>
    </Card>
  )
}

function Bars({ rows }: { rows: { k: string; v: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.v))
  if (!rows.length) return <p className="text-sm text-muted-foreground">No data yet.</p>
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.k}>
          <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{r.k}</span><span className="tabular text-muted-foreground">{int(r.v)}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground transition-all duration-700" style={{ width: `${(r.v / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  )
}

function MiniList({ title, rows, empty }: { title: string; rows: { k: string; v: number }[]; empty: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{title}</p>
      <ul className="mt-1.5 space-y-1 text-sm">
        {rows.slice(0, 3).map((r) => <li key={r.k} className="flex justify-between gap-3"><span className="truncate">{r.k}</span><span className="tabular text-muted-foreground">{r.v}</span></li>)}
        {rows.length === 0 && <li className="text-muted-foreground">{empty}</li>}
      </ul>
    </div>
  )
}
