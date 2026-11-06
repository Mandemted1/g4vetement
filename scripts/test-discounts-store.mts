/**
 * Sets up (and removes) a temporary sale + codes so the storefront can be tested in a browser.
 *   npm run test-discounts-store -- up      creates: sale "ZZ Test Sale" (25% off Tees), codes ZZTSAVE20 (20%), ZZTMIN (needs $500)
 *   npm run test-discounts-store -- down    prints the test order, then removes ONLY what the test made
 *
 * Safety: nothing here is ever selected by "all real orders". Test data is identified by the test shopper's
 * email (zzt-…@example.com) and the ZZT… code names, and stock is returned only for the test order's own items.
 */
import { createClient } from "@supabase/supabase-js"

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const mode = process.argv[2]
const TEST_EMAIL = "zzt-%@example.com"

if (mode === "up") {
  const a = await db.from("sales").insert({ name: "ZZ Test Sale", percent: 25, scope: "categories", categories: ["Tees"] })
  const b = await db.from("discount_codes").insert([
    { code: "ZZTSAVE20", kind: "percent", value: 20, min_spend: 0 },
    { code: "ZZTMIN", kind: "percent", value: 10, min_spend: 500 },
  ])
  if (a.error || b.error) {
    console.error("SETUP FAILED:", a.error?.message ?? "", b.error?.message ?? "")
    process.exit(1)
  }
  console.log("test sale + codes created")
} else {
  // only orders placed by the test shopper
  const customers = (await db.from("customers").select("id").like("email", TEST_EMAIL)).data ?? []
  const ids = customers.map((c) => c.id)
  const orders = ids.length ? ((await db.from("orders").select("id, status, subtotal, discount, discount_code, shipping, total, sale_discount, order_items(product_id, name, size, price, list_price, qty)").in("customer_id", ids)).data ?? []) : []
  for (const o of orders) console.log("TEST ORDER:", JSON.stringify(o))
  for (const o of orders) {
    if (o.status !== "cancelled") {
      for (const it of o.order_items as { product_id: string; size: string; qty: number }[]) {
        await db.rpc("adjust_stock", { p_product: it.product_id, p_size: it.size, p_delta: it.qty })
      }
    }
    await db.from("orders").delete().eq("id", o.id)
  }
  if (ids.length) await db.from("customers").delete().in("id", ids)
  await db.from("discount_codes").delete().like("code", "ZZT%")
  await db.from("sales").delete().eq("name", "ZZ Test Sale")
  console.log(`cleaned up: ${orders.length} test order(s), ${ids.length} test customer(s), test codes and sale removed`)
}
