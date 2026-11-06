/**
 * Checks shipping zones, addresses and pricing in the database.   npm run test-shipping-db
 * Everything runs inside ONE transaction that is rolled back at the end, so nothing the test creates (zones, a product,
 * a code, an order) is ever visible to your live shop. Test zones use made-up country codes (XA, XB, XC).
 */
import pg from "pg"
import { createClient } from "@supabase/supabase-js"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const items = (qty = 1) => JSON.stringify([{ product_id: "zzt-ship", size: "S", color: "Black", qty }])
const quote = async (country: string | null, qty = 1, code: string | null = null) => (await c.query("select quote_order($1, $2::jsonb, $3, $4) as q", ["", items(qty), code, country])).rows[0].q
const fails = async (sql: string, args: unknown[]) => {
  await c.query("savepoint s")
  try {
    await c.query(sql, args)
    await c.query("release savepoint s")
    return ""
  } catch (e) {
    await c.query("rollback to savepoint s")
    return (e as Error).message
  }
}

// ---- read-only check, as a shopper would see it (outside the transaction)
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
const pub = await anon.rpc("public_shipping")
ok("shoppers can read the active zones", !pub.error && (pub.data?.length ?? 0) >= 1, pub.error?.message ?? `${pub.data?.length} zone(s)`)
const hidden = await anon.from("shipping_zones").select("id")
ok("…but not the table itself (admin only)", (hidden.data?.length ?? 0) === 0)
const real = (await c.query("select * from shipping_zones where active and '*' = any (countries) order by sort, created_at limit 1")).rows[0]
ok("a store with no setup still has the original rule (an 'everywhere' zone exists)", !!real, real ? `${real.name}: $${real.rate}, free over ${real.free_over}` : "")

await c.query("begin")
try {
  await c.query(`insert into products (id, sku, name, category, price, colors, sizes, stock, active) values ('zzt-ship', 'ZZT-SHIP', 'ZZ Ship', 'Tees', 20, '[{"name":"Black","hex":"#141414"}]', '["S"]', 50, true)`)
  await c.query(`insert into shipping_zones (name, countries, rate, free_over, estimate, sort) values ('ZZ Test XA', array['XA'], 7, 50, '2–3 days', -10)`)
  await c.query(`insert into shipping_zones (name, countries, rate, active, sort) values ('ZZ Test XB', array['XB'], 1, false, -9)`)
  await c.query(`insert into discount_codes (code, kind, value) values ('ZZTFREESHIP', 'free_shipping', 0)`)

  // ---- pricing by country
  let q = await quote("XA")
  ok("a zone's own rate applies ($20 + $7)", q.shipping === 7 && q.total === 27 && q.ship_zone === "ZZ Test XA", JSON.stringify({ s: q.shipping, t: q.total, z: q.ship_zone }))
  ok("the quote carries the delivery estimate and free-over amount", q.ship_estimate === "2–3 days" && q.free_over === 50 && q.ship_error === null)
  q = await quote("xa")
  ok("country codes are case-insensitive", q.shipping === 7)
  q = await quote("XA", 3)
  ok("free once the bag reaches the free-over amount ($60 ≥ $50)", q.subtotal === 60 && q.shipping === 0 && q.total === 60)
  q = await quote("XA", 2)
  ok("…but not below it ($40 < $50)", q.shipping === 7)
  q = await quote("XA", 1, "ZZTFREESHIP")
  ok("a free-shipping code frees any zone", q.shipping === 0 && q.free_shipping === true && q.total === 20)
  q = await quote("XB")
  const world = real.free_over !== null && 20 >= real.free_over ? 0 : real.rate
  ok("a switched-off zone is ignored (falls to 'everywhere else')", q.ship_zone === real.name && q.shipping === world, `${q.ship_zone} $${q.shipping}`)
  q = await quote("XC")
  ok("an unlisted country uses 'everywhere else'", q.ship_zone === real.name && q.shipping === world)
  q = await quote(null)
  ok("no country yet still prices (first active zone)", q.ship_error === null && typeof q.shipping === "number")
  q = (await c.query("select quote_order('', $1::jsonb, null) as q", [items(1)])).rows[0].q
  ok("the old 3-argument quote call still works (older pages keep working during a deploy)", q.ship_error === null && q.subtotal === 20)

  // ---- placing an order keeps the address and how it was priced
  const placed = (await c.query("select * from place_order('ZZ Ship Test', 'zzt-ship@example.com', 'Takoradi', 'WR', $1::jsonb, null, 'XA', '12 Test Street', ' 00233 ')", [items(1)])).rows[0]
  ok("checkout charges the same as the quote", placed.shipping === 7 && placed.order_total === 27 && placed.ship_estimate === "2–3 days", JSON.stringify(placed))
  const o = (await c.query("select * from orders where id = $1", [placed.order_id])).rows[0]
  ok("the order keeps country, address, city, state, postcode", o.ship_country === "XA" && o.ship_address === "12 Test Street" && o.ship_city === "Takoradi" && o.ship_state === "WR" && o.ship_postcode === "00233")
  ok("…and the zone and estimate that priced it", o.ship_method === "ZZ Test XA" && o.ship_estimate === "2–3 days" && o.shipping === 7)
  const old = (await c.query("select * from place_order('ZZ Ship Test', 'zzt-ship2@example.com', 'Accra', 'GA', $1::jsonb, null)", [items(1)])).rows[0]
  const o2 = (await c.query("select ship_country, ship_method from orders where id = $1", [old.order_id])).rows[0]
  ok("the old 6-argument checkout call still works (no country = first active zone)", !!old.order_id && o2.ship_country === null)
  ok("a malformed country is refused", /valid country/i.test(await fails("select * from place_order('A', 'a@example.com', 'x', 'y', $1::jsonb, null, 'GHANA', null, null)", [items(1)])))
  const long = (await c.query("select * from place_order('ZZ Long', 'zzt-long@example.com', 'C', 'S', $1::jsonb, null, 'XA', $2, $3)", [items(1), "x".repeat(500), "y".repeat(100)])).rows[0]
  const o3 = (await c.query("select ship_address, ship_postcode from orders where id = $1", [long.order_id])).rows[0]
  ok("over-long address fields are cut down, not stored whole", o3.ship_address.length === 200 && o3.ship_postcode.length === 20)

  // ---- a country nobody serves
  await c.query("update shipping_zones set active = false where '*' = any (countries) and name <> 'ZZ Test XA'")
  q = await quote("XC")
  ok("with no zone for a country, the quote says so (and doesn't charge)", /ship to XC/.test(q.ship_error ?? "") && q.shipping === 0, q.ship_error)
  ok("checkout refuses it", /ship to XC/.test(await fails("select * from place_order('ZZ', 'zzt-no@example.com', 'x', 'y', $1::jsonb, null, 'XC', null, null)", [items(1)])))
  q = await quote("XA")
  ok("countries that are served still work", q.ship_error === null && q.shipping === 7)
} finally {
  await c.query("rollback")
  const left = (await c.query("select (select count(*) from products where id = 'zzt-ship') + (select count(*) from shipping_zones where name like 'ZZ Test%') + (select count(*) from customers where email like 'zzt-%@example.com') as n")).rows[0].n
  console.log(Number(left) === 0 ? "rolled back, nothing left behind" : "WARNING: test data still present")
  await c.end()
}
