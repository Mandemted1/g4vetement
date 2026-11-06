/**
 * Loads the current catalog, customers and order history into Supabase.
 *
 * Run:  npm run seed        (reads .env.local)
 * Re-running is safe: it overwrites the seeded rows and resets order items.
 */
import { createClient } from "@supabase/supabase-js"
import { META } from "../src/lib/catalog-meta"
import { getImages } from "../src/lib/product-images"
import store from "../src/data/store.json"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

async function run<T>(label: string, p: PromiseLike<{ error: { message: string } | null; data?: T }>) {
  const { error } = await p
  if (error) {
    console.error(`✗ ${label}: ${error.message}`)
    process.exit(1)
  }
  console.log(`✓ ${label}`)
}
const chunks = <T,>(a: T[], n = 200) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))

const products = store.products.map((p, i) => ({
  id: p.id, sku: p.sku, name: p.name, category: p.category, type: META[p.id].type, price: p.price,
  colors: p.colors, sizes: p.sizes, stock: p.stock, reorder_level: p.reorderLevel,
  description: META[p.id].desc, fabric: META[p.id].fabric, fit: META[p.id].fit, images: getImages(p.id), active: true, sort: i,
}))
await run(`products (${products.length})`, db.from("products").upsert(products))

const catNames = [...new Set(store.products.map((p) => p.category))]
await run(`categories (${catNames.length})`, db.from("categories").upsert(catNames.map((name, i) => ({ name, sort: i + 1 })), { onConflict: "name", ignoreDuplicates: true }))

const customers = store.customers.map((c) => ({ id: c.id, name: c.name, email: c.email, city: c.city, state: c.state }))
// only customers who actually ordered (matches the admin's customer list)
const ordered = new Set(store.orders.map((o) => o.customerId))
const seedCustomers = customers.filter((c) => ordered.has(c.id))
for (const part of chunks(seedCustomers)) await run(`customers +${part.length}`, db.from("customers").upsert(part))

const orders = store.orders.map((o) => ({
  id: o.id, number: o.number, customer_id: o.customerId, status: o.status, subtotal: o.subtotal, discount: o.discount,
  discount_code: o.discountCode, shipping: o.shipping, total: o.total, channel: o.channel, payment: o.payment, created_at: o.date, sim: true,
}))
for (const part of chunks(orders)) await run(`orders +${part.length}`, db.from("orders").upsert(part))

await run("clear old order items", db.from("order_items").delete().gte("id", 0))
const items = store.orders.flatMap((o) =>
  o.items.map((i) => ({ order_id: o.id, product_id: i.productId, name: i.name, size: i.size, color: i.color, color_hex: i.colorHex, qty: i.qty, price: i.price })),
)
for (const part of chunks(items, 500)) await run(`order items +${part.length}`, db.from("order_items").insert(part))

await run("sync id sequences", db.rpc("sync_sequences"))

const { data } = await db.from("orders").select("total, status")
const booked = (data ?? []).filter((o) => o.status !== "cancelled" && o.status !== "refunded").reduce((s, o) => s + o.total, 0)
console.log(`\nDone. ${data?.length} orders in Supabase, booked revenue $${booked.toLocaleString()}`)
