/**
 * Checks per-size stock in the database.   npm run test-size-stock
 * Uses ONE throwaway product (id zzt-size) and its own test orders/customer; nothing else is touched, and all of it is removed at the end.
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}

const PID = "zzt-size"
const EMAIL = "zzt-size@example.com"
const orders: string[] = []
const line = (size: string, qty = 1, color = "Black") => ({ product_id: PID, size, color, qty })
const get = async () => (await db.from("products").select("stock, size_stock, sizes").eq("id", PID).single()).data!
const set = async (size_stock: Record<string, number>) => { const { error } = await db.from("products").update({ size_stock }).eq("id", PID); if (error) throw new Error(error.message) }
const quoteErr = async (items: object[]) => (await anon.rpc("quote_order", { p_email: "", p_items: items, p_code: null })).error?.message ?? ""
const place = async (items: object[]) => {
  const r = await anon.rpc("place_order", { p_name: "ZZ Size Test", p_email: EMAIL, p_city: "Brooklyn", p_state: "NY", p_items: items, p_code: null })
  if (!r.error) orders.push((Array.isArray(r.data) ? r.data[0] : r.data).order_id)
  return r
}

try {
  await db.from("products").delete().eq("id", PID)

  // ---- the trigger
  let { error } = await db.from("products").insert({ id: PID, sku: "ZZT-SIZE", name: "ZZ Size Test", category: "Tees", price: 20, colors: [{ name: "Black", hex: "#141414" }], sizes: ["S", "M", "L"], stock: 10, active: true })
  if (error) throw new Error(error.message)
  let p = await get()
  ok("a product with only a total is split evenly across its sizes (10 over 3 = 4,3,3)", p.size_stock.S === 4 && p.size_stock.M === 3 && p.size_stock.L === 3 && p.stock === 10, JSON.stringify(p.size_stock))

  await set({ S: 2, M: 0, L: 1 })
  p = await get()
  ok("stock is always the sum of the sizes", p.stock === 3, `stock ${p.stock}`)

  ;({ error } = await db.from("products").update({ sizes: ["S", "M", "XL"] }).eq("id", PID))
  p = await get()
  ok("adding a size starts it at 0, removing one drops it", JSON.stringify(p.size_stock) === '{"M": 0, "S": 2, "XL": 0}' || (p.size_stock.S === 2 && p.size_stock.XL === 0 && !("L" in p.size_stock)), JSON.stringify(p.size_stock))
  ok("…and the total follows", p.stock === 2)
  ;({ error } = await db.from("products").update({ sizes: ["S", "M", "L"], size_stock: { S: 2, M: 0, L: 1 } }).eq("id", PID))
  ok("negative numbers are floored at 0", (await db.from("products").update({ size_stock: { S: -5, M: 1, L: 1 } }).eq("id", PID).select("size_stock").single()).data?.size_stock.S === 0)
  await set({ S: 2, M: 0, L: 1 })

  // ---- quoting
  ok("a sold-out size is refused, and says which one", /sold out in size M/i.test(await quoteErr([line("M")])), await quoteErr([line("M")]))
  ok("asking for more than the size has is refused", /Only 2 left of ZZ Size Test in size S/.test(await quoteErr([line("S", 3)])), await quoteErr([line("S", 3)]))
  ok("exactly what's there is fine", (await quoteErr([line("S", 2)])) === "")
  ok("another size having stock doesn't help", /Only 1 left/.test(await quoteErr([line("L", 2)])))
  ok("two lines of one size (different colours) are checked together", /Only 2 left/.test(await quoteErr([line("S", 1, "Black"), line("S", 2, "Black")])))
  ok("different sizes are checked separately", (await quoteErr([line("S", 2), line("L", 1)])) === "")
  ok("a size the product doesn't have is refused", /Invalid size/.test(await quoteErr([line("XXL")])))

  // ---- buying
  let r = await place([line("S", 1)])
  p = await get()
  ok("buying takes stock from that size only", !r.error && p.size_stock.S === 1 && p.size_stock.L === 1 && p.stock === 2, r.error?.message ?? JSON.stringify(p.size_stock))
  const item = (await db.from("order_items").select("size, qty").eq("order_id", orders[0]).single()).data
  ok("the order remembers the size", item?.size === "S" && item.qty === 1)

  r = await place([line("M", 1)])
  ok("a sold-out size can't be ordered", !!r.error && /sold out/i.test(r.error.message), r.error?.message)
  r = await place([line("S", 1), line("L", 2)])
  p = await get()
  ok("one short line fails the whole order, and nothing is taken", !!r.error && p.size_stock.S === 1 && p.size_stock.L === 1 && orders.length === 1, r.error?.message)

  // ---- giving stock back (cancelled orders)
  await db.rpc("adjust_stock", { p_product: PID, p_size: "S", p_delta: 1 })
  p = await get()
  ok("adjust_stock puts items back on the shelf", p.size_stock.S === 2 && p.stock === 3)
  await db.rpc("adjust_stock", { p_product: PID, p_size: "S", p_delta: -50 })
  ok("it never goes below zero", (await get()).size_stock.S === 0)
  await db.rpc("adjust_stock", { p_product: PID, p_size: "ZZ", p_delta: 5 })
  ok("an unknown size is ignored", !("ZZ" in (await get()).size_stock))
  const hack = await anon.rpc("adjust_stock", { p_product: PID, p_size: "S", p_delta: 99 })
  ok("shoppers can't call adjust_stock", !!hack.error && (await get()).size_stock.S === 0, hack.error?.message)

  // ---- the last one: five people try to buy it at the same moment
  await set({ S: 0, M: 0, L: 1 })
  const race = await Promise.all(Array.from({ length: 5 }, () => place([line("L", 1)])))
  const wins = race.filter((x) => !x.error).length
  p = await get()
  ok("5 buyers, 1 item left: exactly one gets it", wins === 1 && p.size_stock.L === 0 && p.stock === 0, `${wins} succeeded, L=${p.size_stock.L}`)
  ok("the others are told it's sold out", race.filter((x) => x.error).every((x) => /sold out/i.test(x.error!.message)))
} finally {
  // ---- remove everything this test made
  if (orders.length) {
    await db.from("order_items").delete().in("order_id", orders)
    await db.from("orders").delete().in("id", orders)
  }
  await db.from("customers").delete().eq("email", EMAIL)
  await db.from("products").delete().eq("id", PID)
  const left = (await db.from("products").select("id").eq("id", PID)).data?.length ?? 0
  console.log(left === 0 ? "cleaned up" : "WARNING: test product still exists")
}
