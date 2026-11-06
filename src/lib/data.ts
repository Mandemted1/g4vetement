import store from "@/data/store.json"

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded"
export type Category = "Tees" | "Hoodies & Sweats" | "Bottoms" | "Outerwear" | "Accessories"

export interface Product {
  id: string
  sku: string
  name: string
  category: Category
  price: number
  colors: { name: string; hex: string }[]
  sizes: string[]
  stock: number
  reorderLevel: number
}
export interface OrderItem {
  productId: string
  name: string
  size: string
  color: string
  colorHex: string
  qty: number
  price: number
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
  shipping: number
  total: number
  status: OrderStatus
  channel: string
  payment: string
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

/** The reference "today" of the demo dataset. */
export const TODAY = Date.UTC(2026, 10, 5)
export const DAY = 86_400_000
export const DATA_START = Date.UTC(2026, 4, 1)
export const STORE_NAME = "G4"
export const ADMIN_NAME = "G4"

export const products = store.products as Product[]
export const orders = (store.orders as Order[]).slice().sort((a, b) => a.date.localeCompare(b.date))
export const customerBase = store.customers as CustomerBase[]

export const isBooked = (o: Pick<Order, "status">) => o.status !== "cancelled" && o.status !== "refunded"

export const productById = new Map(products.map((p) => [p.id, p]))
export const customerById = new Map(customerBase.map((c) => [c.id, c]))

function tierFor(spent: number, n: number): Customer["tier"] {
  if (spent >= 600) return "VIP"
  if (n >= 3) return "Loyal"
  if (n >= 2) return "Returning"
  return "New"
}

export const customers: Customer[] = (() => {
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
  return customerBase
    .filter((c) => agg.has(c.id))
    .map((c) => {
      const a = agg.get(c.id)!
      return { ...c, orders: a.n, spent: a.spent, firstOrder: a.first, lastOrder: a.last, tier: tierFor(a.spent, a.n) }
    })
})()

export const TOTAL_REVENUE = orders.filter(isBooked).reduce((s, o) => s + o.total, 0)

export const stockState = (p: Product) =>
  p.stock === 0 ? "out" : p.stock <= p.reorderLevel ? "low" : "ok"
