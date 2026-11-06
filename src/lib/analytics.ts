import { isBooked, DAY, type AdminData, type Order } from "./data"
import { dayLabel, monthLabel } from "./format"

export type Range = "7d" | "30d" | "90d" | "all"
export const RANGES: { value: Range; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "All" },
]

const startOf = (r: Range, d: AdminData) => (r === "all" ? d.dataStart : d.today - ({ "7d": 6, "30d": 29, "90d": 89 }[r]) * DAY)
const spanDays = (r: Range, d: AdminData) => Math.round((d.today - startOf(r, d)) / DAY) + 1
const ts = (o: Order) => new Date(o.date).getTime()
const inWindow = (o: Order, from: number, to: number) => ts(o) >= from && ts(o) < to + DAY

const sum = (os: Order[]) => os.reduce((s, o) => s + o.total, 0)

export interface Kpi {
  value: number
  /** % change vs previous equal-length window, or null when no full prior window exists */
  delta: number | null
}
const delta = (cur: number, prev: number | null) => (prev === null ? null : prev === 0 ? null : ((cur - prev) / prev) * 100)

export function getDashboard(range: Range, data: AdminData) {
  const { orders, customers, products, today: TODAY, dataStart: DATA_START } = data
  // first order date per customer (any status) – used for "new customers"
  const firstOrder = new Map(customers.map((c) => [c.id, new Date(c.firstOrder).getTime()]))
  const productById = new Map(products.map((p) => [p.id, p]))
  const from = startOf(range, data)
  const days = spanDays(range, data)
  const prevFrom = from - days * DAY
  const hasPrev = range !== "all" && prevFrom >= DATA_START
  const cur = orders.filter((o) => inWindow(o, from, TODAY))
  const prev = hasPrev ? orders.filter((o) => inWindow(o, prevFrom, from - DAY)) : []
  const curB = cur.filter(isBooked)
  const prevB = prev.filter(isBooked)

  const newCust = (a: number, b: number) =>
    customers.filter((c) => {
      const f = firstOrder.get(c.id)!
      return f >= a && f < b + DAY
    }).length

  const revenue = sum(curB)
  const aov = curB.length ? revenue / curB.length : 0
  const prevRevenue = hasPrev ? sum(prevB) : null
  const prevAov = hasPrev && prevB.length ? sum(prevB) / prevB.length : null
  const refunds = cur.filter((o) => o.status === "refunded")
  const units = curB.reduce((s, o) => s + o.items.reduce((q, i) => q + i.qty, 0), 0)
  const newNow = newCust(from, TODAY)
  const newPrev = hasPrev ? newCust(prevFrom, from - DAY) : null

  const kpis = {
    revenue: { value: revenue, delta: delta(revenue, prevRevenue) } satisfies Kpi,
    orders: { value: curB.length, delta: delta(curB.length, hasPrev ? prevB.length : null) } satisfies Kpi,
    aov: { value: aov, delta: delta(aov, prevAov) } satisfies Kpi,
    newCustomers: { value: newNow, delta: delta(newNow, newPrev) } satisfies Kpi,
  }

  // ---- time series ----
  const bucketDays = range === "7d" || range === "30d" ? 1 : 7
  const buckets = Math.ceil(days / bucketDays)
  const series = Array.from({ length: buckets }, (_, i) => {
    const a = from + i * bucketDays * DAY
    const b = Math.min(a + bucketDays * DAY - DAY, TODAY)
    const curRev = sum(curB.filter((o) => inWindow(o, a, b)))
    const prevRev = hasPrev ? sum(prevB.filter((o) => inWindow(o, a - days * DAY, b - days * DAY))) : null
    const ordersN = curB.filter((o) => inWindow(o, a, b)).length
    const label = bucketDays === 1 ? dayLabel(a) : `${dayLabel(a)} – ${dayLabel(b)}`
    return {
      key: a,
      label,
      short: bucketDays === 1 ? dayLabel(a) : dayLabel(a),
      revenue: curRev,
      previous: prevRev,
      orders: ordersN,
    }
  })

  // ---- status (all orders in window) ----
  const statusCounts = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, refunded: 0 }
  cur.forEach((o) => statusCounts[o.status]++)

  // ---- categories ----
  const catMap = new Map<string, { revenue: number; units: number }>()
  const prodMap = new Map<string, { revenue: number; units: number }>()
  curB.forEach((o) => {
    // allocate order discounts proportionally so category totals tie out to revenue minus shipping
    o.items.forEach((i) => {
      const p = productById.get(i.productId)
      if (!p) return
      const gross = i.price * i.qty
      const net = gross - (o.discount * gross) / o.subtotal
      const c = catMap.get(p.category) ?? { revenue: 0, units: 0 }
      c.revenue += net
      c.units += i.qty
      catMap.set(p.category, c)
      const q = prodMap.get(p.id) ?? { revenue: 0, units: 0 }
      q.revenue += net
      q.units += i.qty
      prodMap.set(p.id, q)
    })
  })
  const categories = [...catMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
  const topProducts = [...prodMap.entries()]
    .map(([id, v]) => ({ product: productById.get(id)!, ...v }))
    .sort((a, b) => b.revenue - a.revenue)

  // ---- channels ----
  const chMap = new Map<string, { revenue: number; orders: number }>()
  curB.forEach((o) => {
    const c = chMap.get(o.channel) ?? { revenue: 0, orders: 0 }
    c.revenue += o.total
    c.orders++
    chMap.set(o.channel, c)
  })
  const channels = [...chMap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue)

  const grossSales = curB.reduce((s, o) => s + o.subtotal, 0)
  const discounts = curB.reduce((s, o) => s + o.discount, 0)
  const shipping = curB.reduce((s, o) => s + o.shipping, 0)

  return {
    from,
    to: TODAY,
    hasPrev,
    kpis,
    series,
    statusCounts,
    categories,
    topProducts,
    channels,
    summary: {
      grossSales,
      discounts,
      shipping,
      refundsCount: refunds.length,
      refundsValue: sum(refunds),
      cancelledCount: statusCounts.cancelled,
      units,
    },
  }
}

export function getBriefing(data: AdminData) {
  const { orders, products, today: TODAY } = data
  const toFulfill = orders.filter((o) => o.status === "pending" || o.status === "processing")
  const lowStock = products.filter((p) => p.stock <= p.reorderLevel)
  const today = orders.filter((o) => ts(o) >= TODAY && isBooked(o))
  return {
    toFulfill: toFulfill.length,
    pending: orders.filter((o) => o.status === "pending").length,
    lowStock: lowStock.length,
    outOfStock: products.filter((p) => p.stock === 0).length,
    todayOrders: today.length,
    todayRevenue: sum(today),
  }
}

export { monthLabel }
