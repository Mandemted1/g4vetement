/**
 * Generates believable demo visitor traffic for one day, shaped around that day's orders.
 * Rows are flagged sim=true so they're easy to tell apart (and to delete) later.
 */

export interface VisitRow {
  ts: string
  visitor_id: string
  session_id: string
  event: string
  path: string
  referrer: string | null
  source: string | null
  entry: boolean
  country: string | null
  device: string
  browser: string
  os: string
  product_id: string | null
  sim: boolean
}

type R = () => number
const pickW = <T,>(items: [T, number][], r: R): T => {
  let x = r() * items.reduce((s, [, w]) => s + w, 0)
  for (const [v, w] of items) {
    x -= w
    if (x <= 0) return v
  }
  return items[items.length - 1][0]
}
const id = (r: R) => Math.floor(r() * 36 ** 8).toString(36).padStart(8, "0") + Math.floor(r() * 36 ** 4).toString(36).padStart(4, "0")

const SOURCES: [string | null, number][] = [[null, 30], ["Instagram", 26], ["TikTok", 17], ["Google", 14], ["Email", 8], ["Facebook", 3], ["Pinterest", 2]]
const COUNTRIES: [string, number][] = [["US", 70], ["GB", 8], ["CA", 7], ["GH", 5], ["NG", 3], ["DE", 3], ["AU", 2], ["FR", 2]]

/** @param dayStart UTC midnight (ms) @param orders how many real orders landed that day @param productIds ids to browse @param weights popularity per id */
export function simVisitsForDay(dayStart: number, orders: number, productIds: string[], weights: number[], r: R): VisitRow[] {
  const visitors = Math.max(30, Math.round((orders / 0.03) * (0.8 + r() * 0.4)))
  const buyers = new Set<number>()
  while (buyers.size < Math.min(orders, visitors)) buyers.add(Math.floor(r() * visitors))
  const rows: VisitRow[] = []
  const hourW: [number, number][] = Array.from({ length: 24 }, (_, h) => [h, h >= 18 && h <= 23 ? 4 : h >= 11 && h <= 17 ? 3 : h >= 7 ? 1.5 : 0.4])

  for (let v = 0; v < visitors; v++) {
    const vid = id(r)
    const sid = id(r)
    const device = pickW<string>([["Mobile", 62], ["Desktop", 33], ["Tablet", 5]], r)
    const browser = device === "Desktop" ? pickW<string>([["Chrome", 62], ["Safari", 20], ["Edge", 10], ["Firefox", 8]], r) : pickW<string>([["Safari", 58], ["Chrome", 42]], r)
    const os = device === "Desktop" ? pickW<string>([["Windows", 52], ["macOS", 40], ["Linux", 8]], r) : device === "Tablet" ? "iOS" : pickW<string>([["iOS", 60], ["Android", 40]], r)
    const country = pickW<string>(COUNTRIES, r)
    const source = pickW<string | null>(SOURCES, r)
    let t = dayStart + pickW<number>(hourW, r) * 3_600_000 + Math.floor(r() * 3_600_000)
    const base = { visitor_id: vid, session_id: sid, country, device, browser, os, sim: true }
    const push = (event: string, path: string, entry = false, product_id: string | null = null) => {
      rows.push({ ts: new Date(t).toISOString(), event, path, referrer: entry && source ? `https://${source.toLowerCase()}.com/` : null, source: entry ? source : null, entry, product_id, ...base })
      t += 8_000 + Math.floor(r() * 70_000)
    }

    const buyer = buyers.has(v)
    push("pageview", "/", true)
    if (r() < 0.72 || buyer) push("pageview", "/shop")
    const browsing = buyer ? 1 + Math.floor(r() * 3) : r() < 0.42 ? 1 + Math.floor(r() * 3) : 0
    let carted = false
    for (let k = 0; k < browsing; k++) {
      let x = r() * weights.reduce((s, w) => s + w, 0)
      let idx = 0
      for (; idx < weights.length - 1; idx++) {
        x -= weights[idx]
        if (x <= 0) break
      }
      const pid = productIds[idx]
      push("pageview", `/product/${pid}`, false, pid)
      push("product_view", `/product/${pid}`, false, pid)
      if (!carted && (buyer || r() < 0.2)) {
        push("add_to_cart", `/product/${pid}`, false, pid)
        carted = true
      }
    }
    if (carted && (buyer || r() < 0.5)) push("checkout_start", "/")
    if (buyer) push("purchase", "/")
  }
  return rows
}
