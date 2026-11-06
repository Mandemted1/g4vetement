/** Shared types + pure helpers. Data itself comes from src/lib/source.ts (server) and the providers. */

import type { Department } from "./departments"

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded"
export type GarmentType = "tee" | "longsleeve" | "hoodie" | "zip" | "sweat" | "jogger" | "cargo" | "straight" | "wide" | "shorts" | "coach" | "bomber" | "puffer" | "beanie" | "cap" | "tote" | "socks"

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  /** men / women / unisex (unisex is listed under both) */
  department: Department
  type: GarmentType
  price: number
  colors: { name: string; hex: string }[]
  sizes: string[]
  /** total across all sizes */
  stock: number
  /** units left in each size, e.g. { S: 8, M: 12, L: 0 } (adds up to `stock`) */
  sizeStock: Record<string, number>
  reorderLevel: number
  description: string
  fabric: string
  fit: string
  images: string[]
  active: boolean
  /** set by the storefront catalog when a sale is running: the price actually charged */
  salePrice?: number
  salePercent?: number
  saleName?: string
  saleEndsAt?: string | null
}
export interface OrderItem {
  productId: string
  name: string
  size: string
  color: string
  colorHex: string
  qty: number
  price: number
  /** the price before any sale (equals price when there was none) */
  listPrice?: number
}
export interface Order {
  id: string
  number: number
  date: string
  customerId: string
  items: OrderItem[]
  subtotal: number
  discount: number
  discountCode: string | null
  /** value taken off by automatic sales (already reflected in the item prices) */
  saleDiscount?: number
  shipping: number
  total: number
  status: OrderStatus
  channel: string
  payment: string
  /** where it ships to and how shipping was priced (orders placed before address collection have none) */
  ship?: { country: string; address: string; city: string; state: string; postcode: string; method: string; estimate: string } | null
  /** set when the order was marked shipped with a tracking number */
  tracking?: { carrier: string; number: string; url: string } | null
  shippedAt?: string | null
}
export interface CustomerBase {
  id: string
  name: string
  email: string
  city: string
  state: string
}
export interface Customer extends CustomerBase {
  orders: number
  spent: number
  firstOrder: string
  lastOrder: string
  tier: "VIP" | "Loyal" | "Returning" | "New"
}
export interface Category {
  id: string
  name: string
  description: string
  sort: number
  active: boolean
}
export interface Subscriber {
  email: string
  createdAt: string
}

export interface AdminData {
  mode: "live" | "demo"
  products: Product[]
  orders: Order[]
  customers: Customer[]
  subscribers: Subscriber[]
  categories: Category[]
  /** Start of the most recent day that has orders, so the dashboard anchors to real activity. */
  today: number
  dataStart: number
}

export const DAY = 86_400_000
export const ADMIN_NAME = "G4"

export const isBooked = (o: Pick<Order, "status">) => o.status !== "cancelled" && o.status !== "refunded"
export const stockState = (p: Pick<Product, "stock" | "reorderLevel">) => (p.stock === 0 ? "out" : p.stock <= p.reorderLevel ? "low" : "ok")

const dayStart = (iso: string) => {
  const d = new Date(iso)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function tierFor(spent: number, n: number): Customer["tier"] {
  if (spent >= 600) return "VIP"
  if (n >= 3) return "Loyal"
  if (n >= 2) return "Returning"
  return "New"
}

export function buildCustomers(base: CustomerBase[], orders: Order[]): Customer[] {
  const agg = new Map<string, { n: number; spent: number; first: string; last: string }>()
  for (const o of orders) {
    const a = agg.get(o.customerId) ?? { n: 0, spent: 0, first: o.date, last: o.date }
    a.first = a.first < o.date ? a.first : o.date
    a.last = a.last > o.date ? a.last : o.date
    if (isBooked(o)) {
      a.n += 1
      a.spent += o.total
    }
    agg.set(o.customerId, a)
  }
  return base
    .filter((c) => agg.has(c.id))
    .map((c) => {
      const a = agg.get(c.id)!
      return { ...c, orders: a.n, spent: a.spent, firstOrder: a.first, lastOrder: a.last, tier: tierFor(a.spent, a.n) }
    })
}

export function buildAdminData(input: { mode: AdminData["mode"]; products: Product[]; orders: Order[]; customerBase: CustomerBase[]; subscribers: Subscriber[]; categories: Category[] }): AdminData {
  const orders = [...input.orders].sort((a, b) => a.date.localeCompare(b.date))
  const last = orders[orders.length - 1]
  const first = orders[0]
  return {
    mode: input.mode,
    products: input.products,
    orders,
    customers: buildCustomers(input.customerBase, orders),
    subscribers: input.subscribers,
    categories: input.categories,
    today: last ? dayStart(last.date) : dayStart(new Date().toISOString()),
    dataStart: first ? dayStart(first.date) : dayStart(new Date().toISOString()),
  }
}
