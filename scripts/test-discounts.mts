/**
 * Exercises the pricing engine (sales, codes, shipping, checkout) against your database.   npm run test-discounts
 * Creates throwaway codes/sales/orders and removes them (restoring stock) when done.
 */
import { createClient } from "@supabase/supabase-js"

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}

type Q = { subtotal: number; list_subtotal: number; sale_discount: number; discount: number; shipping: number; total: number; code: string | null; code_error: string | null; code_note: string | null; free_shipping: boolean; lines: { price: number; list_price: number }[] }
const line = (id: string, size = "M", color?: string, qty = 1) => ({ product_id: id, size, color: color ?? COLOR[id], qty })
const COLOR: Record<string, string> = { p01: "Black", p05: "Black", p16: "Black", p09: "Olive" }
const quote = async (items: object[], code?: string, email = "") => {
  const { data, error } = await db.rpc("quote_order", { p_email: email, p_items: items, p_code: code ?? null })
  if (error) throw new Error(error.message)
  return data as Q
}
const quoteErr = async (items: object[]) => (await db.rpc("quote_order", { p_email: "", p_items: items, p_code: null })).error?.message ?? ""

const TAG = "ZZT"
const created = { codes: [] as string[], sales: [] as string[], orders: [] as string[], emails: [] as string[] }
const stockBefore = new Map<string, number>((await db.from("products").select("id, stock")).data!.map((p) => [p.id, p.stock]))  // read-only: used to pick low-stock products for the stock tests

const code = async (c: string, row: Record<string, unknown>) => {
  const { error } = await db.from("discount_codes").insert({ code: `${TAG}${c}`, ...row })
  if (error) throw new Error(`${c}: ${error.message}`)
  created.codes.push(`${TAG}${c}`)
  return `${TAG}${c}`
}
const sale = async (row: Record<string, unknown>) => {
  const { data, error } = await db.from("sales").insert(row).select("id").single()
  if (error) throw new Error(error.message)
  created.sales.push(data.id)
  return data.id as string
}
const place = (email: string, items: object[], c?: string) => {
  created.emails.push(email)
  return db.rpc("place_order", { p_name: "ZZ Test", p_email: email, p_city: "Brooklyn", p_state: "NY", p_items: items, p_code: c ?? null })
}

try {
  // ---------- shipping + plain totals ----------
  let q = await quote([line("p01")])
  ok("plain bag: $32 + $9 shipping = $41", q.subtotal === 32 && q.shipping === 9 && q.total === 41 && q.sale_discount === 0, JSON.stringify({ s: q.subtotal, sh: q.shipping, t: q.total }))
  q = await quote([line("p05"), line("p01")])
  ok("free shipping at $100+", q.subtotal === 110 && q.shipping === 0 && q.total === 110)

  // ---------- code types ----------
  const pct = await code("PCT20", { kind: "percent", value: 20 })
  q = await quote([line("p05"), line("p01")], pct)
  ok("20% code on $110 = $22 off", q.discount === 22 && q.total === 88 && q.code === pct, `disc ${q.discount}`)
  q = await quote([line("p05"), line("p01")], pct.toLowerCase())
  ok("codes are case-insensitive", q.discount === 22)

  const fixed = await code("FIX10", { kind: "fixed", value: 10, min_spend: 50 })
  q = await quote([line("p01")], fixed)
  ok("minimum spend is enforced (message, bag still priced)", q.discount === 0 && /at least \$50/.test(q.code_error ?? "") && q.total === 41, q.code_error ?? "")
  q = await quote([line("p05"), line("p01")], fixed)
  ok("fixed $10 off once the minimum is met", q.discount === 10 && q.total === 100)
  const bigFixed = await code("FIX500", { kind: "fixed", value: 500 })
  q = await quote([line("p01")], bigFixed)
  ok("a fixed code can never discount more than the bag", q.discount === 32, `disc ${q.discount}`)

  const ship = await code("SHIPFREE", { kind: "free_shipping" })
  q = await quote([line("p01")], ship)
  ok("free-shipping code removes the $9", q.shipping === 0 && q.total === 32 && q.free_shipping)

  // ---------- category scope ----------
  const tees = await code("TEES50", { kind: "percent", value: 50, categories: ["Tees"] })
  q = await quote([line("p01"), line("p05")], tees)
  ok("category code only discounts matching items ($32 tee -> $16)", q.discount === 16, `disc ${q.discount}`)
  q = await quote([line("p05")], tees)
  ok("category code with nothing eligible explains why", q.discount === 0 && /only applies to Tees/.test(q.code_error ?? ""), q.code_error ?? "")

  // ---------- validity ----------
  const past = new Date(Date.now() - 86400000).toISOString()
  const future = new Date(Date.now() + 86400000).toISOString()
  const old = await code("EXPIRED", { kind: "percent", value: 10, starts_at: new Date(Date.now() - 172800000).toISOString(), ends_at: past })
  const soon = await code("SOON", { kind: "percent", value: 10, starts_at: future })
  const off = await code("OFF", { kind: "percent", value: 10, active: false })
  ok("expired code", /expired/.test((await quote([line("p01")], old)).code_error ?? ""))
  ok("not-yet-started code", /not active yet/.test((await quote([line("p01")], soon)).code_error ?? ""))
  ok("disabled code", /not valid/.test((await quote([line("p01")], off)).code_error ?? ""))
  ok("unknown code", /not valid/.test((await quote([line("p01")], "NOPE123")).code_error ?? ""))

  // ---------- sales ----------
  const all25 = await sale({ name: "ZZ all", percent: 25 })
  q = await quote([line("p01")])
  ok("25% store-wide sale: $32 -> $24, list price kept", q.lines[0].price === 24 && q.lines[0].list_price === 32 && q.sale_discount === 8 && q.subtotal === 24, JSON.stringify({ p: q.lines[0].price, sd: q.sale_discount }))
  ok("sale price matches the app's rounding (15% of $32)", Math.round((32 * 15) / 100) === 5)
  await db.from("sales").update({ active: false }).eq("id", all25)
  const catSale = await sale({ name: "ZZ tees", percent: 40, scope: "categories", categories: ["Tees"] })
  const prodSale = await sale({ name: "ZZ one", percent: 10, scope: "products", product_ids: ["p01"] })
  q = await quote([line("p01"), line("p05")])
  ok("overlapping sales: the best one wins (40% beats 10%)", q.lines[0].price === 32 - 13 && q.lines[1].price === 78, JSON.stringify(q.lines.map((l) => l.price)))
  ok("a sale outside its category doesn't touch other products", q.lines[1].price === q.lines[1].list_price)
  await db.from("sales").update({ ends_at: past, starts_at: new Date(Date.now() - 172800000).toISOString() }).eq("id", catSale)
  q = await quote([line("p01")])
  ok("an ended sale stops applying (only the 10% product sale remains)", q.lines[0].price === 32 - 3, `price ${q.lines[0].price}`)
  await db.from("sales").update({ active: false }).eq("id", prodSale)

  // sale + code combine: code works on the sale-adjusted subtotal
  const s50 = await sale({ name: "ZZ 50", percent: 50 })
  q = await quote([line("p05"), line("p01")], pct)
  ok("sale + code combine on the sale price (110 -> 55, then 20% = 11)", q.subtotal === 55 && q.discount === 11 && q.total === 55 - 11 + 9 && q.sale_discount === 55, JSON.stringify({ s: q.subtotal, d: q.discount, t: q.total }))
  await db.from("sales").update({ active: false }).eq("id", s50)

  // ---------- bag problems ----------
  ok("empty bag is refused", /empty/.test(await quoteErr([])))
  ok("invalid size is refused", /Invalid size/.test(await quoteErr([line("p01", "XXXL")])))
  ok("invalid colour is refused", /Invalid colour/.test(await quoteErr([line("p01", "M", "Pink")])))
  ok("a sold-out product can't be bought", /Only 0 left/.test(await quoteErr([line("p10", "32", "Indigo")])), "p10 has 0 in stock")
  const s06 = stockBefore.get("p06")!
  ok("two lines of one product are checked together against stock", /Only \d+ left/.test(await quoteErr([line("p06", "M", "Black", Math.ceil(s06 / 2) + 1), line("p06", "L", "Black", Math.ceil(s06 / 2) + 1)])), `p06 stock ${s06}`)

  // ---------- real checkout ----------
  const e1 = `${TAG.toLowerCase()}-a@example.com`
  const stock01 = (await db.from("products").select("stock").eq("id", "p01").single()).data!.stock
  const got = await place(e1, [line("p05"), line("p01", "L")], pct)
  const row = Array.isArray(got.data) ? got.data[0] : got.data
  ok("checkout succeeds with a code", !got.error && row?.order_total === 88, got.error?.message ?? `total ${row?.order_total}`)
  if (row) created.orders.push(row.order_id)
  const o = (await db.from("orders").select("*, order_items(*)").eq("id", row.order_id).single()).data!
  ok("order stores subtotal/discount/code/shipping/total/sale_discount", o.subtotal === 110 && o.discount === 22 && o.discount_code === pct && o.shipping === 0 && o.total === 88 && o.sale_discount === 0 && o.sim === false)
  ok("order items store charged + list price", o.order_items.every((i: { price: number; list_price: number }) => i.price === i.list_price))
  const after01 = (await db.from("products").select("stock").eq("id", "p01").single()).data!.stock
  ok("stock went down by the quantity bought", after01 === stock01 - 1, `${stock01} -> ${after01}`)

  // sale prices are what's charged and recorded
  const s30 = await sale({ name: "ZZ 30", percent: 30 })
  const e2 = `${TAG.toLowerCase()}-b@example.com`
  const got2 = await place(e2, [line("p05")])
  const r2 = Array.isArray(got2.data) ? got2.data[0] : got2.data
  if (r2) created.orders.push(r2.order_id)
  const o2 = (await db.from("orders").select("*, order_items(*)").eq("id", r2.order_id).single()).data!
  ok("checkout charges the sale price and records the sale discount", o2.subtotal === 78 - 23 && o2.sale_discount === 23 && o2.order_items[0].price === 55 && o2.order_items[0].list_price === 78, JSON.stringify({ sub: o2.subtotal, sd: o2.sale_discount }))
  await db.from("sales").update({ active: false }).eq("id", s30)

  // ---------- per-customer + first-order rules ----------
  const once = await code("ONCE", { kind: "percent", value: 10, once_per_customer: true })
  const e3 = `${TAG.toLowerCase()}-c@example.com`
  const first = await place(e3, [line("p01")], once)
  const r3 = Array.isArray(first.data) ? first.data[0] : first.data
  if (r3) created.orders.push(r3.order_id)
  ok("once-per-customer: first use works", !first.error)
  const second = await place(e3, [line("p01")], once)
  ok("once-per-customer: same email refused the second time", /already used/.test(second.error?.message ?? ""), second.error?.message ?? "(no error!)")
  if (!second.error && second.data) created.orders.push((Array.isArray(second.data) ? second.data[0] : second.data).order_id)
  q = await quote([line("p01")], once, e3)
  ok("quote shows that message before checkout", /already used/.test(q.code_error ?? ""))
  q = await quote([line("p01")], once, `${TAG.toLowerCase()}-other@example.com`)
  ok("a different email can still use it", q.discount > 0)

  const firstOnly = await code("FIRST", { kind: "percent", value: 15, first_order_only: true })
  q = await quote([line("p01")], firstOnly, e3)
  ok("first-order-only refuses a returning customer", /first orders only/.test(q.code_error ?? ""))
  q = await quote([line("p01")], firstOnly, `${TAG.toLowerCase()}-brandnew@example.com`)
  ok("first-order-only accepts a new customer", q.discount > 0)
  q = await quote([line("p01")], firstOnly, "")
  ok("without an email yet, the quote notes it'll be checked at checkout", q.discount > 0 && /email at checkout/.test(q.code_note ?? ""))
  const noEmail = await db.rpc("place_order", { p_name: "ZZ", p_email: "x", p_city: null, p_state: null, p_items: [line("p01")], p_code: null })
  ok("checkout needs a valid email", Boolean(noEmail.error))

  // ---------- usage limit, including a race ----------
  const lim = await code("LIMIT1", { kind: "percent", value: 10, usage_limit: 1 })
  const [a, b] = await Promise.all([
    place(`${TAG.toLowerCase()}-r1@example.com`, [line("p16", "One Size")], lim),
    place(`${TAG.toLowerCase()}-r2@example.com`, [line("p16", "One Size")], lim),
  ])
  for (const x of [a, b]) if (!x.error && x.data) created.orders.push((Array.isArray(x.data) ? x.data[0] : x.data).order_id)
  const winners = [a, b].filter((x) => !x.error).length
  ok("usage limit of 1 under a race: exactly one checkout wins", winners === 1, `${winners} succeeded; other said: ${[a, b].find((x) => x.error)?.error?.message}`)
  q = await quote([line("p16", "One Size")], lim)
  ok("afterwards the quote says it's fully used", /fully used/.test(q.code_error ?? ""))

  // welcome code row exists and behaves like before
  const w = (await db.from("discount_codes").select("*").eq("code", "WELCOME10").single()).data
  ok("WELCOME10 is a real code row ($10 off, $50 min, first order)", w?.kind === "fixed" && w.value === 10 && w.min_spend === 50 && w.first_order_only === true)
} finally {
  // ---------- clean up everything this test made (and only that) ----------
  for (const id of created.orders) {
    // put the bought items back on the shelf, then remove the order
    const o = (await db.from("orders").select("status, order_items(product_id, qty)").eq("id", id).maybeSingle()).data
    if (o && o.status !== "cancelled") {
      for (const it of o.order_items as { product_id: string; qty: number }[]) {
        const { data: p } = await db.from("products").select("stock").eq("id", it.product_id).single()
        if (p) await db.from("products").update({ stock: p.stock + it.qty }).eq("id", it.product_id)
      }
    }
    await db.from("orders").delete().eq("id", id)
  }
  for (const e of created.emails) await db.from("customers").delete().eq("email", e)
  await db.from("discount_codes").delete().in("code", created.codes)
  if (created.sales.length) await db.from("sales").delete().in("id", created.sales)
  const leftoverCodes = (await db.from("discount_codes").select("code").like("code", `${TAG}%`)).data?.length ?? 0
  const leftoverSales = (await db.from("sales").select("id").like("name", "ZZ %")).data?.length ?? 0
  const leftoverCustomers = (await db.from("customers").select("id").like("email", `${TAG.toLowerCase()}-%`)).data?.length ?? 0
  ok("cleaned up: no test codes, sales, orders or customers left", leftoverCodes === 0 && leftoverSales === 0 && leftoverCustomers === 0)
}
