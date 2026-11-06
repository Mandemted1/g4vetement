import "server-only"
import store from "@/data/store.json"
import { META } from "./catalog-meta"
import { buildAdminData, type AdminData, type Category, type CustomerBase, type Order, type OrderStatus, type Product, type Subscriber } from "./data"
import { getImages } from "./product-images"
import { evenSplit, readSizeStock } from "./stock"
import { anonClient, sessionClient } from "./supabase/clients"
import { isLive } from "./supabase/env"

/* ---------------- demo data (bundled JSON) ---------------- */

function demoProducts(): Product[] {
  return store.products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    department: "men",
    type: META[p.id].type,
    price: p.price,
    colors: p.colors,
    sizes: p.sizes,
    stock: p.stock,
    sizeStock: evenSplit(p.stock, p.sizes),
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
  department: r.department === "women" || r.department === "unisex" ? r.department : "men",
  type: r.type,
  price: r.price,
  colors: r.colors ?? [],
  sizes: r.sizes ?? [],
  stock: r.stock,
  sizeStock: readSizeStock(r.size_stock, r.stock, r.sizes ?? []),
  reorderLevel: r.reorder_level,
  description: r.description ?? "",
  fabric: r.fabric ?? "",
  fit: r.fit ?? "",
  images: r.images ?? [],
  active: r.active,
})
export const toOrder = (r: any): Order => ({
  id: r.id,
  number: r.number,
  date: r.created_at,
  customerId: r.customer_id,
  items: (r.order_items ?? []).map((i: any) => ({ productId: i.product_id, name: i.name, size: i.size, color: i.color, colorHex: i.color_hex, qty: i.qty, price: i.price, listPrice: i.list_price ?? i.price })),
  subtotal: r.subtotal,
  discount: r.discount,
  discountCode: r.discount_code,
  saleDiscount: r.sale_discount ?? 0,
  shipping: r.shipping,
  total: r.total,
  status: r.status as OrderStatus,
  channel: r.channel,
  payment: r.payment,
  ship: r.ship_country || r.ship_address ? { country: r.ship_country ?? "", address: r.ship_address ?? "", city: r.ship_city ?? "", state: r.ship_state ?? "", postcode: r.ship_postcode ?? "", method: r.ship_method ?? "", estimate: r.ship_estimate ?? "" } : null,
  tracking: r.tracking_number ? { carrier: r.tracking_carrier ?? "", number: r.tracking_number, url: r.tracking_url ?? "" } : null,
  shippedAt: r.shipped_at ?? null,
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

const demoCategories = (products: Product[]): Category[] =>
  [...new Set(products.map((p) => p.category))].map((name, i) => ({ id: `demo-${i}`, name, description: "", sort: i + 1, active: true }))

const toCategory = (r: any): Category => ({ id: r.id, name: r.name, description: r.description ?? "", sort: r.sort, active: r.active })

/* ---------------- public API ---------------- */

/** Visible category names in the admin's chosen order, for the storefront. Never throws. */
export async function getCategoryNames(products: Product[]): Promise<string[]> {
  const derived = [...new Set(products.map((p) => p.category))]
  if (!isLive) return derived
  try {
    const { data, error } = await anonClient().from("categories").select("name, active").order("sort").order("name")
    if (error || !data?.length) return derived
    const known = new Set(data.map((c: any) => c.name as string))
    const visible = data.filter((c: any) => c.active).map((c: any) => c.name as string)
    // a product whose category isn't managed yet still appears, after the managed ones; a *hidden* category never does
    return [...visible, ...derived.filter((d) => !known.has(d))]
  } catch {
    return derived
  }
}

interface RunningSale { name: string; percent: number; scope: string; categories: string[] | null; product_ids: string[] | null; ends_at: string | null }

/** Applies the best running sale to each product (same rounding as the database). */
export function applySales(products: Product[], sales: RunningSale[]): Product[] {
  if (!sales.length) return products
  return products.map((p) => {
    let best: RunningSale | null = null
    for (const s of sales) {
      const hit = s.scope === "all" || (s.scope === "categories" && s.categories?.includes(p.category)) || (s.scope === "products" && s.product_ids?.includes(p.id))
      if (hit && (!best || s.percent > best.percent)) best = s
    }
    if (!best) return p
    return { ...p, salePrice: p.price - Math.round((p.price * best.percent) / 100), salePercent: best.percent, saleName: best.name, saleEndsAt: best.ends_at }
  })
}

/** Products for the storefront, with any running sale applied. Never throws: falls back to demo data if the database is unreachable. */
export async function getCatalog(): Promise<Product[]> {
  if (!isLive) return demoProducts()
  try {
    const db = anonClient()
    const [{ data, error }, sales] = await Promise.all([
      db.from("products").select("*").eq("active", true).order("sort").order("created_at"),
      db.rpc("public_sales").then((r) => (r.error ? [] : (r.data as RunningSale[]))),
    ])
    if (error) throw new Error(error.message)
    if (!data?.length) return demoProducts()
    return applySales(data.map(toProduct), sales)
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
      categories: demoCategories(demoProducts()),
    })
  }
  const db = await sessionClient()
  const [products, orders, customers, subs, cats] = await Promise.all([
    fetchAll((a, b) => db.from("products").select("*").order("sort").order("created_at").range(a, b)),
    fetchAll((a, b) => db.from("orders").select("*, order_items(*)").order("created_at").range(a, b)),
    fetchAll((a, b) => db.from("customers").select("*").range(a, b)),
    fetchAll((a, b) => db.from("subscribers").select("*").order("created_at", { ascending: false }).range(a, b)).catch(() => [] as any[]),
    fetchAll((a, b) => db.from("categories").select("*").order("sort").order("name").range(a, b)).catch(() => [] as any[]),
  ])
  return buildAdminData({
    mode: "live",
    products: products.map(toProduct),
    orders: orders.map(toOrder),
    customerBase: customers.map((c: any): CustomerBase => ({ id: c.id, name: c.name, email: c.email, city: c.city ?? "", state: c.state ?? "" })),
    subscribers: subs.map((s: any): Subscriber => ({ email: s.email, createdAt: s.created_at })),
    categories: cats.map(toCategory),
  })
}
