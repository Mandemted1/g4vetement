/**
 * Delete an order and put its items back in stock.  Run: npm run remove-order -- G4-2001 [G4-2002 ...]
 * Also removes the order's customer if that was their only order. Handy for cleaning up test orders.
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const ids = process.argv.slice(2)
if (!url || !key || ids.length === 0) {
  console.error("Usage: npm run remove-order -- <orderId> [...]  (needs .env.local)")
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

for (const id of ids) {
  const { data: o } = await db.from("orders").select("id, status, customer_id, order_items(product_id, size, qty)").eq("id", id).maybeSingle()
  if (!o) {
    console.log(`– ${id}: not found`)
    continue
  }
  if (o.status !== "cancelled") {
    for (const it of o.order_items as { product_id: string; size: string; qty: number }[]) {
      await db.rpc("adjust_stock", { p_product: it.product_id, p_size: it.size, p_delta: it.qty })
    }
  }
  await db.from("orders").delete().eq("id", id)
  const { count } = await db.from("orders").select("*", { count: "exact", head: true }).eq("customer_id", o.customer_id)
  if (!count) await db.from("customers").delete().eq("id", o.customer_id)
  console.log(`✓ ${id} removed, stock restored${count ? "" : ", customer removed"}`)
}
