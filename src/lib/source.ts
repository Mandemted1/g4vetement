import "server-only"
import store from "@/data/store.json"
import { META } from "./catalog-meta"
import { buildAdminData, type AdminData, type CustomerBase, type Order, type OrderStatus, type Product, type Subscriber } from "./data"
import { getImages } from "./product-images"
import { anonClient, sessionClient } from "./supabase/clients"
import { isLive } from "./supabase/env"

/* ---------------- demo data (bundled JSON) ---------------- */

function demoProducts(): Product[] {
  return store.products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    type: META[p.id].type,
    price: p.price,
    colors: p.colors,
    sizes: p.sizes,
    stock: p.stock,
    reorderLevel: p.reorderLevel,
    description: META[p.id].desc,
    fabric: META[p.id].fabric,
    fit: META[p.id].fit,
    images: getImages(p.id),
    active: true,
  }))
}

/* ---------------- Supabase rows -> app types ---------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
const toProduct = (r: any): Product => ({
  id: r.id,
  sku: r.sku,
  name: r.name,
  category: r.category,
  type: r.type,
  price: r.price,
  colors: r.colors ?? [],
  sizes: r.sizes ?? [],
  stock: r.stock,
  reorderLevel: r.reorder_level,
  description: r.description ?? "",
  fabric: r.fabric ?? "",
  fit: r.fit ?? "",
  images: r.images ?? [],
  active: r.active,
})
const toOrder = (r: any): Order => ({
  id: r.id,
  number: r.number,
  date: r.created_at,
  customerId: r.customer_id,
  items: (r.order_items ?? []).map((i: any) => ({ productId: i.product_id, name: i.name, size: i.size, color: i.color, colorHex: i.color_hex, qty: i.qty, price: i.price })),
  subtotal: r.subtotal,
  discount: r.discount,
  discountCode: r.discount_code,
  shipping: r.shipping,
  total: r.total,
  status: r.status as OrderStatus,
  channel: r.channel,
  payment: r.payment,
})

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

/* ---------------- public API ---------------- */

/** Products for the storefront. Never throws: falls back to demo data if the database is unreachable. */
export async function getCatalog(): Promise<Product[]> {
  if (!isLive) return demoProducts()
  try {
    const { data, error } = await anonClient().from("products").select("*").eq("active", true).order("sort").order("created_at")
    if (error) throw new Error(error.message)
    if (!data?.length) return demoProducts()
    return data.map(toProduct)
  } catch (e) {
    console.error("[catalog] falling back to demo data:", e)
    return demoProducts()
  }
}

/** Everything the admin needs. Uses the signed-in user's session, so RLS decides what is visible. */
export async function getAdminData(): Promise<AdminData> {
  if (!isLive) {
    return buildAdminData({
      mode: "demo",
      products: demoProducts(),
      orders: store.orders as Order[],
      customerBase: store.customers as CustomerBase[],
      subscribers: [],
    })
  }
  const db = await sessionClient()
  const [products, orders, customers, subs] = await Promise.all([
    fetchAll((a, b) => db.from("products").select("*").order("sort").order("created_at").range(a, b)),
    fetchAll((a, b) => db.from("orders").select("*, order_items(*)").order("created_at").range(a, b)),
    fetchAll((a, b) => db.from("customers").select("*").range(a, b)),
    fetchAll((a, b) => db.from("subscribers").select("*").order("created_at", { ascending: false }).range(a, b)).catch(() => [] as any[]),
  ])
  return buildAdminData({
    mode: "live",
    products: products.map(toProduct),
    orders: orders.map(toOrder),
    customerBase: customers.map((c: any): CustomerBase => ({ id: c.id, name: c.name, email: c.email, city: c.city ?? "", state: c.state ?? "" })),
    subscribers: subs.map((s: any): Subscriber => ({ email: s.email, createdAt: s.created_at })),
  })
}
