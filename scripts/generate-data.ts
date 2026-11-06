/**
 * Generates the G4 demo dataset (products + orders) into src/data/store.json.
 *
 * Run:  npm run data
 *
 * Guarantees (asserted at the end):
 *   - Booked revenue (all orders except cancelled / refunded) === $55,000.00 exactly
 *   - Every order total === subtotal - discount + shipping
 *   - Every subtotal === sum of its line items
 * Everything in the UI is derived from this one file, so numbers always match.
 */
import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const TARGET_REVENUE = 55_000
const START = Date.UTC(2026, 4, 1) // May 1 2026
const END = Date.UTC(2026, 10, 5) // Nov 5 2026 (the "today" of the demo)
const DAY = 86_400_000
const FREE_SHIPPING_AT = 100
const SHIPPING = 9

// ---------- seeded rng ----------
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
const rand = mulberry32(20261105)
const pick = <T,>(arr: T[], r = rand) => arr[Math.floor(r() * arr.length)]
function weighted<T>(items: T[], w: (t: T) => number, r = rand): T {
  const total = items.reduce((s, i) => s + w(i), 0)
  let x = r() * total
  for (const i of items) {
    x -= w(i)
    if (x <= 0) return i
  }
  return items[items.length - 1]
}

// ---------- catalog ----------
type Cat = "Tees" | "Hoodies & Sweats" | "Bottoms" | "Outerwear" | "Accessories"
interface P {
  id: string
  sku: string
  name: string
  category: Cat
  price: number
  colors: { name: string; hex: string }[]
  sizes: string[]
  stock: number
  reorderLevel: number
  weight: number // popularity
}
const TOP = ["S", "M", "L", "XL"]
const BOT = ["28", "30", "32", "34", "36"]
const ONE = ["One Size"]
const BLACK = { name: "Black", hex: "#141414" }
const WHITE = { name: "Off White", hex: "#f1efe9" }
const SAND = { name: "Sand", hex: "#d4c5a3" }
const OLIVE = { name: "Olive", hex: "#5b6140" }
const NAVY = { name: "Navy", hex: "#1f2a44" }
const GREY = { name: "Heather Grey", hex: "#a3a3a3" }
const BROWN = { name: "Chocolate", hex: "#4a3328" }
const INDIGO = { name: "Indigo", hex: "#2f3e5c" }

const products: P[] = [
  { id: "p01", sku: "G4-TEE-001", name: "Essential Heavyweight Tee", category: "Tees", price: 32, colors: [BLACK, WHITE, SAND], sizes: TOP, stock: 142, reorderLevel: 30, weight: 10 },
  { id: "p02", sku: "G4-TEE-002", name: "Boxy Graphic Tee", category: "Tees", price: 38, colors: [BLACK, WHITE], sizes: TOP, stock: 96, reorderLevel: 30, weight: 8 },
  { id: "p03", sku: "G4-TEE-003", name: "Oversized Pocket Tee", category: "Tees", price: 42, colors: [SAND, OLIVE, BLACK], sizes: TOP, stock: 18, reorderLevel: 25, weight: 6 },
  { id: "p04", sku: "G4-TEE-004", name: "Long Sleeve Rib Tee", category: "Tees", price: 36, colors: [BLACK, GREY], sizes: TOP, stock: 64, reorderLevel: 25, weight: 5 },
  { id: "p05", sku: "G4-HDY-001", name: "Classic Pullover Hoodie", category: "Hoodies & Sweats", price: 78, colors: [BLACK, GREY, NAVY], sizes: TOP, stock: 71, reorderLevel: 25, weight: 9 },
  { id: "p06", sku: "G4-HDY-002", name: "Zip-Up Hoodie", category: "Hoodies & Sweats", price: 88, colors: [BLACK, OLIVE], sizes: TOP, stock: 12, reorderLevel: 20, weight: 6 },
  { id: "p07", sku: "G4-HDY-003", name: "Crewneck Sweatshirt", category: "Hoodies & Sweats", price: 64, colors: [GREY, BROWN, BLACK], sizes: TOP, stock: 55, reorderLevel: 20, weight: 6 },
  { id: "p08", sku: "G4-HDY-004", name: "Fleece Joggers", category: "Hoodies & Sweats", price: 68, colors: [BLACK, GREY], sizes: TOP, stock: 83, reorderLevel: 25, weight: 7 },
  { id: "p09", sku: "G4-BTM-001", name: "Utility Cargo Pants", category: "Bottoms", price: 84, colors: [OLIVE, BLACK, SAND], sizes: BOT, stock: 47, reorderLevel: 20, weight: 7 },
  { id: "p10", sku: "G4-BTM-002", name: "Straight Fit Denim", category: "Bottoms", price: 96, colors: [INDIGO, BLACK], sizes: BOT, stock: 0, reorderLevel: 20, weight: 5 },
  { id: "p11", sku: "G4-BTM-003", name: "Everyday Shorts", category: "Bottoms", price: 48, colors: [BLACK, SAND, NAVY], sizes: BOT, stock: 60, reorderLevel: 20, weight: 5 },
  { id: "p12", sku: "G4-BTM-004", name: "Wide Leg Trousers", category: "Bottoms", price: 92, colors: [BLACK, BROWN], sizes: BOT, stock: 29, reorderLevel: 15, weight: 3 },
  { id: "p13", sku: "G4-OUT-001", name: "Coach Jacket", category: "Outerwear", price: 118, colors: [BLACK, NAVY], sizes: TOP, stock: 22, reorderLevel: 12, weight: 3 },
  { id: "p14", sku: "G4-OUT-002", name: "Varsity Bomber", category: "Outerwear", price: 145, colors: [BLACK, OLIVE], sizes: TOP, stock: 14, reorderLevel: 15, weight: 2 },
  { id: "p15", sku: "G4-OUT-003", name: "Quilted Puffer", category: "Outerwear", price: 185, colors: [BLACK, SAND], sizes: TOP, stock: 19, reorderLevel: 10, weight: 1.6 },
  { id: "p16", sku: "G4-ACC-001", name: "Ribbed Beanie", category: "Accessories", price: 24, colors: [BLACK, GREY, OLIVE], sizes: ONE, stock: 210, reorderLevel: 40, weight: 6 },
  { id: "p17", sku: "G4-ACC-002", name: "Logo Dad Cap", category: "Accessories", price: 30, colors: [BLACK, SAND, NAVY], sizes: ONE, stock: 118, reorderLevel: 40, weight: 6 },
  { id: "p18", sku: "G4-ACC-003", name: "Canvas Tote", category: "Accessories", price: 28, colors: [SAND, BLACK], sizes: ONE, stock: 77, reorderLevel: 30, weight: 4 },
  { id: "p19", sku: "G4-ACC-004", name: "Crew Socks 3-Pack", category: "Accessories", price: 18, colors: [WHITE, BLACK], sizes: ONE, stock: 301, reorderLevel: 60, weight: 7 },
]
const byId = new Map(products.map((p) => [p.id, p]))

// ---------- people ----------
const FIRST = ["Marcus", "Aaliyah", "Jordan", "Imani", "Tyler", "Sofia", "Elijah", "Maya", "Devon", "Camille", "Noah", "Zara", "Isaiah", "Priya", "Caleb", "Nia", "Mateo", "Jasmine", "Andre", "Hannah", "Kofi", "Leila", "Xavier", "Chloe", "Omar", "Brianna", "Malik", "Emma", "Darius", "Tessa", "Jamal", "Olivia", "Ravi", "Simone", "Gabriel", "Naomi", "Trevor", "Amara", "Julian", "Keisha"]
const LAST = ["Johnson", "Williams", "Brown", "Davis", "Martinez", "Carter", "Nguyen", "Patel", "Thompson", "Robinson", "Clark", "Lewis", "Walker", "Hall", "Young", "Allen", "King", "Wright", "Scott", "Green", "Baker", "Adams", "Nelson", "Hill", "Campbell", "Mitchell", "Roberts", "Turner", "Phillips", "Evans", "Okafor", "Reyes", "Kim", "Bennett", "Foster", "Ramos", "Hughes", "Price", "Coleman", "Murray"]
const PLACES: [string, string][] = [
  ["Brooklyn", "NY"], ["Los Angeles", "CA"], ["Atlanta", "GA"], ["Houston", "TX"], ["Chicago", "IL"],
  ["Miami", "FL"], ["Seattle", "WA"], ["Austin", "TX"], ["Philadelphia", "PA"], ["Denver", "CO"],
  ["Oakland", "CA"], ["Charlotte", "NC"], ["Washington", "DC"], ["Detroit", "MI"], ["Dallas", "TX"],
]
const CHANNELS = [
  { name: "Instagram", w: 32 }, { name: "TikTok", w: 22 }, { name: "Direct", w: 20 },
  { name: "Google", w: 14 }, { name: "Email", w: 12 },
]
const PAYMENTS = [
  { name: "Visa", w: 34 }, { name: "Mastercard", w: 22 }, { name: "Apple Pay", w: 24 },
  { name: "PayPal", w: 14 }, { name: "Amex", w: 6 },
]

const customers: { name: string; email: string; city: string; state: string }[] = []
{
  const used = new Set<string>()
  while (customers.length < 330) {
    const f = pick(FIRST), l = pick(LAST)
    const key = `${f} ${l}`
    if (used.has(key)) continue
    used.add(key)
    const [city, state] = pick(PLACES)
    const email = `${f}.${l}${rand() < 0.3 ? Math.floor(rand() * 90 + 10) : ""}@${pick(["gmail.com", "gmail.com", "icloud.com", "outlook.com", "yahoo.com"])}`.toLowerCase()
    customers.push({ name: key, email, city, state })
  }
}

// ---------- day weights (growth + weekday + promos) ----------
const nDays = Math.round((END - START) / DAY) + 1
const dayW: number[] = []
for (let i = 0; i < nDays; i++) {
  const t = i / (nDays - 1)
  const d = new Date(START + i * DAY)
  const dow = d.getUTCDay()
  const week = [1.12, 0.88, 0.86, 0.92, 0.98, 1.12, 1.2][dow]
  let w = (0.8 + 1.15 * t) * week * (0.78 + rand() * 0.44)
  const m = d.getUTCMonth(), dm = d.getUTCDate()
  if (m === 6 && dm >= 1 && dm <= 5) w *= 1.45 // July 4th sale
  if (m === 8 && dm >= 10 && dm <= 13) w *= 1.9 // Sept drop
  if (m === 9 && dm >= 29) w *= 1.35 // Halloween / fall push
  if (m === 10 && dm <= 2) w *= 1.5 // November launch
  dayW.push(w)
}
const dayCum: number[] = []
dayW.reduce((s, w, i) => (dayCum[i] = s + w), 0)
function sampleDay(r: () => number) {
  const x = r() * dayCum[dayCum.length - 1]
  let lo = 0, hi = dayCum.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (dayCum[mid] < x) lo = mid + 1
    else hi = mid
  }
  return lo
}
function sampleHour(r: () => number) {
  // evening-skewed
  const hr = weighted([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], (h) => (h >= 19 ? 3 : h >= 12 ? 2 : 1), r)
  return hr
}

// ---------- baskets ----------
const shippingFor = (sub: number) => (sub >= FREE_SHIPPING_AT ? 0 : SHIPPING)
function randomBasket(r: () => number): { productId: string; qty: number }[] {
  const n = weighted([1, 2, 3, 4, 5], (k) => [40, 32, 16, 8, 4][k - 1], r)
  const lines: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const p = weighted(products, (x) => x.weight, r)
    lines[p.id] = (lines[p.id] ?? 0) + 1
  }
  return Object.entries(lines).map(([productId, qty]) => ({ productId, qty }))
}

// Every achievable no-discount order total with up to 4 units -> baskets
const combos = new Map<number, string[][]>()
{
  const rec = (start: number, chosen: string[], sum: number) => {
    if (chosen.length) {
      const total = sum + shippingFor(sum)
      const arr = combos.get(total) ?? []
      arr.push([...chosen])
      combos.set(total, arr)
    }
    if (chosen.length === 4) return
    for (let i = start; i < products.length; i++) {
      chosen.push(products[i].id)
      rec(i, chosen, sum + products[i].price)
      chosen.pop()
    }
  }
  rec(0, [], 0)
}

// ---------- build ----------
interface RawOrder {
  dayIdx: number
  hour: number
  minute: number
  customer: number
  basket: { productId: string; qty: number }[]
  channel: string
  payment: string
  roll: number // status roll
  discRoll: number
  r: () => number
}
function rawOrder(i: number): RawOrder {
  const r = mulberry32(777 + i * 31)
  return {
    dayIdx: sampleDay(r),
    hour: sampleHour(r),
    minute: Math.floor(r() * 60),
    customer: Math.min(customers.length - 1, Math.floor(customers.length * Math.pow(r(), 1.9))),
    basket: randomBasket(r),
    channel: weighted(CHANNELS, (c) => c.w, r).name,
    payment: weighted(PAYMENTS, (c) => c.w, r).name,
    roll: r(),
    discRoll: r(),
    r,
  }
}

type Status = "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded"
interface Item { productId: string; name: string; size: string; color: string; colorHex: string; qty: number; price: number }
interface Order {
  id: string
  number: number
  date: string
  customerId: string
  items: Item[]
  subtotal: number
  discount: number
  discountCode: string | null
  shipping: number
  total: number
  status: Status
  channel: string
  payment: string
}

const isBooked = (o: { status: Status }) => o.status !== "cancelled" && o.status !== "refunded"

function itemsFor(basket: { productId: string; qty: number }[], r: () => number): Item[] {
  return basket.map(({ productId, qty }) => {
    const p = byId.get(productId)!
    const color = pick(p.colors, r)
    const size = p.sizes.length === 1 ? p.sizes[0] : weighted(p.sizes, (s) => (s === "M" || s === "L" || s === "32" || s === "34" ? 3 : 2), r)
    return { productId, name: p.name, size, color: color.name, colorHex: color.hex, qty, price: p.price }
  })
}

function build(N: number): Order[] {
  const raws = Array.from({ length: N }, (_, i) => rawOrder(i))
  raws.sort((a, b) => a.dayIdx - b.dayIdx || a.hour - b.hour || a.minute - b.minute)
  const seen = new Set<number>()
  return raws.map((o, idx) => {
    const ts = START + o.dayIdx * DAY + o.hour * 3_600_000 + o.minute * 60_000
    const items = itemsFor(o.basket, o.r)
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
    const first = !seen.has(o.customer)
    seen.add(o.customer)
    let discount = 0
    let code: string | null = null
    if (first && o.discRoll < 0.45 && subtotal >= 50) { discount = 10; code = "WELCOME10" }
    else if (!first && subtotal >= 150 && o.discRoll < 0.35) { discount = 20; code = "VIP20" }
    else if (subtotal >= 100 && o.discRoll < 0.12) { discount = 15; code = "SAVE15" }
    const shipping = shippingFor(subtotal)
    // status
    const ageDays = (END + DAY - ts) / DAY
    let status: Status
    if (ageDays <= 2) status = o.roll < 0.4 ? "pending" : "processing"
    else if (ageDays <= 4) status = o.roll < 0.25 ? "processing" : "shipped"
    else if (ageDays <= 7) status = o.roll < 0.55 ? "shipped" : "delivered"
    else status = "delivered"
    const x = (o.roll * 997) % 1
    if (x < 0.04) status = "cancelled"
    else if (x > 0.97 && ageDays > 7) status = "refunded"
    return {
      id: "",
      number: 0,
      date: new Date(ts).toISOString(),
      customerId: `C-${String(o.customer + 1).padStart(4, "0")}`,
      items,
      subtotal,
      discount,
      discountCode: code,
      shipping,
      total: subtotal - discount + shipping,
      status,
      channel: o.channel,
      payment: o.payment,
    }
  })
}

let N = 480
let orders = build(N)
const revenue = (os: Order[]) => os.filter(isBooked).reduce((s, o) => s + o.total, 0)
while (revenue(orders) < TARGET_REVENUE) orders = build(++N)

// Exact fix-up: swap baskets on a few discount-free booked orders until revenue is exactly the target.
{
  let D = TARGET_REVENUE - revenue(orders)
  const fixr = mulberry32(99)
  let guard = 0
  while (D !== 0 && guard++ < 5000) {
    const cands = orders.filter((o) => isBooked(o) && o.discount === 0 && o.items.reduce((s, i) => s + i.qty, 0) <= 4)
    const o = pick(cands, fixr)
    const want = o.total + D
    let newTotal = want
    if (!combos.has(want)) {
      // move as far toward the target as one swap allows
      const reachable = [...combos.keys()].filter((t) => (D > 0 ? t > o.total && t <= want : t < o.total && t >= want))
      if (!reachable.length) continue
      newTotal = D > 0 ? Math.max(...reachable) : Math.min(...reachable)
    }
    const ids = pick(combos.get(newTotal)!, fixr)
    const counts: Record<string, number> = {}
    ids.forEach((id) => (counts[id] = (counts[id] ?? 0) + 1))
    o.items = itemsFor(Object.entries(counts).map(([productId, qty]) => ({ productId, qty })), fixr)
    o.subtotal = o.items.reduce((s, i) => s + i.price * i.qty, 0)
    o.shipping = shippingFor(o.subtotal)
    o.total = o.subtotal + o.shipping
    D = TARGET_REVENUE - revenue(orders)
  }
}

orders.forEach((o, i) => {
  o.number = 1001 + i
  o.id = `G4-${o.number}`
})

// ---------- assertions ----------
const booked = revenue(orders)
if (booked !== TARGET_REVENUE) throw new Error(`Revenue ${booked} != ${TARGET_REVENUE}`)
for (const o of orders) {
  const sub = o.items.reduce((s, i) => s + i.price * i.qty, 0)
  if (sub !== o.subtotal) throw new Error(`${o.id} subtotal mismatch`)
  if (o.total !== o.subtotal - o.discount + o.shipping) throw new Error(`${o.id} total mismatch`)
}

const out = {
  generatedAt: "2026-11-05",
  products: products.map(({ weight, ...p }) => p),
  customers: customers.map((c, i) => ({ id: `C-${String(i + 1).padStart(4, "0")}`, ...c })),
  orders,
}
const here = dirname(fileURLToPath(import.meta.url))
const file = join(here, "../src/data/store.json")
mkdirSync(dirname(file), { recursive: true })
writeFileSync(file, JSON.stringify(out))

const count = (s: Status) => orders.filter((o) => o.status === s).length
console.log(`orders: ${orders.length}  booked revenue: $${booked.toLocaleString()}`)
console.log(`pending ${count("pending")} processing ${count("processing")} shipped ${count("shipped")} delivered ${count("delivered")} cancelled ${count("cancelled")} refunded ${count("refunded")}`)
