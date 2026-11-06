import "server-only"
import { sessionClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"
import type { CodeStats, DiscountCode, Sale } from "./discount-types"

/* eslint-disable @typescript-eslint/no-explicit-any */

export const toCode = (r: any): DiscountCode => ({
  id: r.id, code: r.code, kind: r.kind, value: r.value, minSpend: r.min_spend, categories: r.categories ?? null,
  startsAt: r.starts_at, endsAt: r.ends_at, usageLimit: r.usage_limit, oncePerCustomer: r.once_per_customer,
  firstOrderOnly: r.first_order_only, active: r.active, note: r.note ?? "", createdAt: r.created_at,
})
export const toSale = (r: any): Sale => ({
  id: r.id, name: r.name, percent: r.percent, scope: r.scope, categories: r.categories ?? null, productIds: r.product_ids ?? null,
  startsAt: r.starts_at, endsAt: r.ends_at, active: r.active,
})

export interface DiscountsData {
  codes: DiscountCode[]
  stats: Record<string, CodeStats>
  sales: Sale[]
  tablesMissing: boolean
  demo: boolean
}

/** Everything the Discounts page shows. Uses the signed-in admin's session, so RLS applies. */
export async function getDiscounts(): Promise<DiscountsData> {
  if (!isLive) return { codes: [], stats: {}, sales: [], tablesMissing: false, demo: true }
  const db = await sessionClient()
  const [codes, sales] = await Promise.all([db.from("discount_codes").select("*").order("created_at", { ascending: false }), db.from("sales").select("*").order("created_at", { ascending: false })])
  if (codes.error || sales.error) return { codes: [], stats: {}, sales: [], tablesMissing: true, demo: false }

  // usage + revenue per code, straight from the orders that used it
  const stats: Record<string, CodeStats> = {}
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("orders").select("id, discount_code, total, discount, status, sim, created_at").not("discount_code", "is", null).order("created_at", { ascending: false }).range(from, from + 999)
    for (const o of (data ?? []) as any[]) {
      if (o.status === "cancelled") continue
      const key = String(o.discount_code).toUpperCase()
      const s = (stats[key] ??= { uses: 0, realUses: 0, revenue: 0, discounted: 0, recent: [] })
      s.uses++
      if (!o.sim) s.realUses++
      s.revenue += o.total
      s.discounted += o.discount
      if (s.recent.length < 5) s.recent.push({ id: o.id, date: o.created_at, total: o.total })
    }
    if (!data || data.length < 1000) break
  }
  return { codes: (codes.data ?? []).map(toCode), stats, sales: (sales.data ?? []).map(toSale), tablesMissing: false, demo: false }
}
