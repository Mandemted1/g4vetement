/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Daily demo-store simulator: adds 3–10 orders per missing day (through yesterday, UTC), moves open
 * demo orders forward (pending > processing > shipped > delivered), draws down stock, and adds matching
 * demo visitor traffic.
 *
 *   npm run daily                        catch up through yesterday (writes to Supabase if configured, else src/data/store.json)
 *   npm run daily -- --through 2026-11-12    simulate up to a given day
 *   npm run daily -- --dry               run everything but write nothing
 *
 * Only orders flagged sim=true are ever touched, so real customer orders are left alone.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { simVisitsForDay } from "./sim-visits.mjs"
import { evenSplit, readSizeStock } from "../src/lib/stock"

const DAY = 86_400_000
const FREE_SHIPPING_AT = 100
const SHIPPING = 9
const MIN_PER_DAY = 3
const MAX_PER_DAY = 10

const here = dirname(fileURLToPath(import.meta.url))
const jsonFile = join(here, "../src/data/store.json")
const store = JSON.parse(readFileSync(jsonFile, "utf8"))
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const live = Boolean(url && key)
const dry = process.argv.includes("--dry")
const db = live ? createClient(url!, key!, { auth: { persistSession: false } }) : null

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)
const pick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length)]
function weighted<T>(items: T[], w: (t: T) => number, r: () => number): T {
  let x = r() * items.reduce((s, i) => s + w(i), 0)
  for (const i of items) {
    x -= w(i)
    if (x <= 0) return i
  }
  return items[items.length - 1]
}

const FIRST = ["Marcus", "Aaliyah", "Jordan", "Imani", "Tyler", "Sofia", "Elijah", "Maya", "Devon", "Camille", "Noah", "Zara", "Isaiah", "Priya", "Caleb", "Nia", "Mateo", "Jasmine", "Andre", "Hannah", "Kofi", "Leila", "Xavier", "Chloe", "Omar", "Brianna", "Malik", "Emma", "Darius", "Tessa", "Jamal", "Olivia", "Ravi", "Simone", "Gabriel", "Naomi", "Trevor", "Amara", "Julian", "Keisha"]
const LAST = ["Johnson", "Williams", "Brown", "Davis", "Martinez", "Carter", "Nguyen", "Patel", "Thompson", "Robinson", "Clark", "Lewis", "Walker", "Hall", "Young", "Allen", "King", "Wright", "Scott", "Green", "Baker", "Adams", "Nelson", "Hill", "Campbell", "Mitchell", "Roberts", "Turner", "Phillips", "Evans", "Okafor", "Reyes", "Kim", "Bennett", "Foster", "Ramos", "Hughes", "Price", "Coleman", "Murray"]
const PLACES: [string, string][] = [["Brooklyn", "NY"], ["Los Angeles", "CA"], ["Atlanta", "GA"], ["Houston", "TX"], ["Chicago", "IL"], ["Miami", "FL"], ["Seattle", "WA"], ["Austin", "TX"], ["Philadelphia", "PA"], ["Denver", "CO"], ["Oakland", "CA"], ["Charlotte", "NC"], ["Washington", "DC"], ["Detroit", "MI"], ["Dallas", "TX"]]
const CHANNELS = [{ n: "Instagram", w: 32 }, { n: "TikTok", w: 22 }, { n: "Direct", w: 20 }, { n: "Google", w: 14 }, { n: "Email", w: 12 }]
const PAYMENTS = [{ n: "Visa", w: 34 }, { n: "Mastercard", w: 22 }, { n: "Apple Pay", w: 24 }, { n: "PayPal", w: 14 }, { n: "Amex", w: 6 }]

const dayStart = (iso: string) => {
  const d = new Date(iso)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10)
const argThrough = process.argv.includes("--through") ? process.argv[process.argv.indexOf("--through") + 1] : null
const through = argThrough ? dayStart(argThrough) : dayStart(new Date().toISOString()) - DAY
const shippingFor = (sub: number) => (sub >= FREE_SHIPPING_AT ? 0 : SHIPPING)
const PIPELINE = ["pending", "processing", "shipped", "delivered"]

async function pageAll(build: (a: number, b: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const out: any[] = []
  for (let i = 0; ; i += 1000) {
    const { data, error } = await build(i, i + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

// ---------------- load state ----------------
const weightById = new Map<string, number>(store.products.map((p: any) => [p.id, p.weight ?? 5]))
let products: any[]
let customers: any[]
let orders: any[]
if (!live) {
  ;({ products, customers, orders } = store)
  orders.forEach((o: any) => (o.sim = true))
} else {
  products = (await pageAll((a, b) => db!.from("products").select("*").range(a, b))).map((p) => ({ id: p.id, name: p.name, price: p.price, stock: p.stock, sizeStock: readSizeStock(p.size_stock, p.stock, p.sizes), reorderLevel: p.reorder_level, colors: p.colors, sizes: p.sizes, weight: weightById.get(p.id) ?? 5 }))
  customers = await pageAll((a, b) => db!.from("customers").select("id, name, email, city, state").range(a, b))
  let rows: any[]
  try {
    rows = await pageAll((a, b) => db!.from("orders").select("id, customer_id, created_at, status, sim, number").range(a, b))
  } catch {
    // migration 003 not applied yet: demo history is everything below the real-checkout range
    rows = (await pageAll((a, b) => db!.from("orders").select("id, customer_id, created_at, status, number").range(a, b))).map((o) => ({ ...o, sim: o.number < 2001 }))
  }
  orders = rows.map((o) => ({ id: o.id, customerId: o.customer_id, date: o.created_at, status: o.status, sim: o.sim }))
}
// stock is tracked per size; the bundled demo JSON only has totals, so it is split evenly
products.forEach((p) => { p.sizeStock ??= evenSplit(p.stock, p.sizes) })
const startStock = new Map<string, number>(products.map((p) => [p.id, p.stock]))
const startSizes = new Map<string, string>(products.map((p) => [p.id, JSON.stringify(p.sizeStock)]))
const startStatus = new Map<string, string>(orders.map((o: any) => [o.id, o.status]))

const simOrders = orders.filter((o: any) => o.sim)
const lastDay = Math.max(...simOrders.map((o: any) => dayStart(o.date)))

function statusFor(ageDays: number, r: () => number) {
  const roll = r()
  if (ageDays <= 2) return roll < 0.4 ? "pending" : "processing"
  if (ageDays <= 4) return roll < 0.25 ? "processing" : "shipped"
  if (ageDays <= 7) return roll < 0.55 ? "shipped" : "delivered"
  return "delivered"
}

// ---------------- simulate ----------------
const newOrders: any[] = []
const newCustomers: any[] = []
const perDay = new Map<number, number>()
let tmp = 0
const known = new Set(customers.map((c: any) => c.name))
const hasOrdered = new Set(orders.map((o: any) => o.customerId))

for (let d = lastDay + DAY; d <= through; d += DAY) {
  const r = mulberry32(hash(ymd(d)))
  const n = MIN_PER_DAY + Math.floor(r() * (MAX_PER_DAY - MIN_PER_DAY + 1))
  perDay.set(d, 0)

  // weekly restock (Mondays): anything at/below reorder level is topped up
  if (new Date(d).getUTCDay() === 1) {
    products.forEach((p) => {
      if (p.stock > p.reorderLevel) return
      const add = evenSplit(p.reorderLevel * 3, p.sizes)
      for (const sz of p.sizes) p.sizeStock[sz] = (p.sizeStock[sz] ?? 0) + add[sz]
      p.stock += p.reorderLevel * 3
    })
  }

  const times = Array.from({ length: n }, () => ({
    h: weighted([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], (h) => (h >= 19 ? 3 : h >= 12 ? 2 : 1), r),
    m: Math.floor(r() * 60),
  })).sort((a, b) => a.h - b.h || a.m - b.m)

  for (const t of times) {
    let customer: any
    if (r() < 0.28) {
      let name = ""
      do name = `${pick(FIRST, r)} ${pick(LAST, r)}`
      while (known.has(name))
      known.add(name)
      const [city, state] = pick(PLACES, r)
      const [f, l] = name.split(" ")
      customer = { id: `TMP-C-${++tmp}`, name, email: `${f}.${l}.${Math.floor(r() * 900 + 100)}@${pick(["gmail.com", "icloud.com", "outlook.com", "yahoo.com"], r)}`.toLowerCase(), city, state }
      customers.push(customer)
      newCustomers.push(customer)
    } else {
      const pool = customers.filter((c: any) => hasOrdered.has(c.id))
      customer = pool[Math.min(pool.length - 1, Math.floor(pool.length * Math.pow(r(), 1.9)))]
    }
    const first = !hasOrdered.has(customer.id)
    hasOrdered.add(customer.id)

    const units = weighted([1, 2, 3, 4, 5], (k) => [40, 32, 16, 8, 4][k - 1], r)
    const lines: Record<string, number> = {}
    for (let i = 0; i < units; i++) {
      const avail = products.filter((p) => p.stock - (lines[p.id] ?? 0) > 0)
      if (!avail.length) break
      const p = weighted(avail, (x) => x.weight ?? 5, r)
      lines[p.id] = (lines[p.id] ?? 0) + 1
    }
    const entries = Object.entries(lines)
    if (!entries.length) continue
    const items = entries.map(([id, want]) => {
      const p = products.find((x) => x.id === id)!
      const color = pick(p.colors as any[], r)
      // only sizes that are still in stock can be bought, and never more than that size has left
      const open = (p.sizes as string[]).filter((s) => (p.sizeStock[s] ?? 0) > 0)
      const size = open.length === 1 ? open[0] : weighted(open, (s) => (["M", "L", "32", "34"].includes(s) ? 3 : 2), r)
      const qty = Math.min(want, p.sizeStock[size])
      p.sizeStock[size] -= qty
      p.stock -= qty
      return { productId: id, name: p.name, size, color: color.name, colorHex: color.hex, qty, price: p.price }
    })
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
    const dr = r()
    let discount = 0
    let code: string | null = null
    if (first && dr < 0.45 && subtotal >= 50) { discount = 10; code = "WELCOME10" }
    else if (!first && subtotal >= 150 && dr < 0.35) { discount = 20; code = "VIP20" }
    else if (subtotal >= 100 && dr < 0.12) { discount = 15; code = "SAVE15" }
    const shipping = shippingFor(subtotal)
    const o = {
      id: `TMP-${++tmp}`,
      number: 0,
      date: new Date(d + t.h * 3_600_000 + t.m * 60_000).toISOString(),
      customerId: customer.id,
      items, subtotal, discount, discountCode: code, shipping,
      total: subtotal - discount + shipping,
      status: r() < 0.04 ? "cancelled" : "pending",
      channel: weighted(CHANNELS, (c) => c.w, r).n,
      payment: weighted(PAYMENTS, (c) => c.w, r).n,
      sim: true,
    }
    orders.push(o)
    newOrders.push(o)
    perDay.set(d, (perDay.get(d) ?? 0) + 1)
  }
}

if (newOrders.length === 0) {
  console.log(`Up to date (last simulated day ${ymd(lastDay)}). Nothing to add.`)
  process.exit(0)
}

// move open demo orders forward as of the end of the final simulated day (never backwards)
const now = through + DAY
const sr = mulberry32(hash(`status-${ymd(through)}`))
for (const o of orders) {
  if (!o.sim || o.status === "cancelled" || o.status === "refunded") continue
  const age = (now - new Date(o.date).getTime()) / DAY
  const target = statusFor(age, sr)
  if (PIPELINE.indexOf(target) > PIPELINE.indexOf(o.status)) o.status = target
  if (o.status === "delivered" && age > 7 && age <= 8 && sr() < 0.03) o.status = "refunded"
}

const stockChanges = products.filter((p) => p.stock !== startStock.get(p.id) || JSON.stringify(p.sizeStock) !== startSizes.get(p.id))
const statusChanges = orders.filter((o: any) => startStatus.has(o.id) && startStatus.get(o.id) !== o.status)
console.log(`${live ? "Supabase" : "JSON"}: +${newOrders.length} orders (${newCustomers.length} new customers) through ${ymd(through)}; ${statusChanges.length} status updates; ${stockChanges.length} products restocked/drawn down.`)
if (dry) {
  console.log("Dry run: nothing written.")
  process.exit(0)
}

// ---------------- write ----------------
if (!live) {
  let n = Math.max(...store.orders.map((o: any) => o.number)) + 1
  let c = Math.max(...store.customers.map((x: any) => +x.id.slice(2))) + 1
  const cmap = new Map<string, string>()
  for (const nc of newCustomers) cmap.set(nc.id, `C-${String(c++).padStart(4, "0")}`), (nc.id = cmap.get(nc.id)!)
  for (const o of newOrders.sort((a, b) => a.date.localeCompare(b.date))) {
    o.number = n++
    o.id = `G4-${o.number}`
    o.customerId = cmap.get(o.customerId) ?? o.customerId
  }
  store.generatedAt = ymd(through)
  writeFileSync(jsonFile, JSON.stringify(store))
  console.log(`Wrote ${jsonFile}`)
  process.exit(0)
}

const fail = (label: string, error: any) => {
  console.error(`✗ ${label}: ${error.message}`)
  process.exit(1)
}
newOrders.sort((a, b) => a.date.localeCompare(b.date))
const numbers: number[] = ((await db!.rpc("next_order_numbers", { n: newOrders.length })).data ?? []) as number[]
const cids: string[] = newCustomers.length ? (((await db!.rpc("next_customer_ids", { n: newCustomers.length })).data ?? []) as string[]) : []
if (numbers.length !== newOrders.length || cids.length !== newCustomers.length) {
  console.error("✗ Couldn't get order numbers from the database. Did you run the 003 migration? (npm run migrate)")
  process.exit(1)
}
const cmap = new Map<string, string>()
newCustomers.forEach((c, i) => cmap.set(c.id, cids[i]))
newOrders.forEach((o, i) => {
  o.number = numbers[i]
  o.id = `G4-${o.number}`
  o.customerId = cmap.get(o.customerId) ?? o.customerId
})

if (newCustomers.length) {
  const { error } = await db!.from("customers").insert(newCustomers.map((c) => ({ id: cmap.get(c.id), name: c.name, email: c.email, city: c.city, state: c.state })))
  if (error) fail("customers", error)
}
for (let i = 0; i < newOrders.length; i += 200) {
  const part = newOrders.slice(i, i + 200)
  const { error } = await db!.from("orders").insert(part.map((o) => ({ id: o.id, number: o.number, customer_id: o.customerId, status: o.status, subtotal: o.subtotal, discount: o.discount, discount_code: o.discountCode, shipping: o.shipping, total: o.total, channel: o.channel, payment: o.payment, created_at: o.date, sim: true })))
  if (error) fail("orders", error)
}
const items = newOrders.flatMap((o) => o.items.map((i: any) => ({ order_id: o.id, product_id: i.productId, name: i.name, size: i.size, color: i.color, color_hex: i.colorHex, qty: i.qty, price: i.price })))
for (let i = 0; i < items.length; i += 500) {
  const { error } = await db!.from("order_items").insert(items.slice(i, i + 500))
  if (error) fail("order items", error)
}
for (const p of stockChanges) {
  // the database keeps `stock` equal to the sum of the sizes; if the size column isn't there yet (migration 007), fall back to the total
  let { error } = await db!.from("products").update({ size_stock: p.sizeStock }).eq("id", p.id)
  if (error && /size_stock/.test(error.message)) ({ error } = await db!.from("products").update({ stock: p.stock }).eq("id", p.id))
  if (error) fail("stock", error)
}
const byStatus = new Map<string, string[]>()
for (const o of statusChanges) byStatus.set(o.status, [...(byStatus.get(o.status) ?? []), o.id])
for (const [status, ids] of byStatus) {
  const { error } = await db!.from("orders").update({ status }).in("id", ids).eq("sim", true)
  if (error) fail("statuses", error)
}
const prodIds = products.map((p) => p.id)
const prodW = products.map((p) => p.weight ?? 5)
const visits = [...perDay].flatMap(([d, n]) => simVisitsForDay(d, n, prodIds, prodW, mulberry32(d / DAY)))
for (let i = 0; i < visits.length; i += 1000) {
  const { error } = await db!.from("visits").insert(visits.slice(i, i + 1000))
  if (error) console.warn(`(visits skipped: ${error.message})`)
  if (error) break
}
await db!.rpc("prune_visits", { p_days: 90 })
console.log(`✓ Done. ${newOrders.length} orders, ${visits.length} demo visits.`)
