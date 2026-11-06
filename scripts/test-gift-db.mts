/**
 * Checks gift cards in the database: issuing, redeeming at checkout, partial payment, refunds, the ledger.   npm run test-gift-db
 * Everything runs inside ONE transaction that is rolled back at the end, so nothing is ever visible to your live shop.
 */
import pg from "pg"
import { createClient } from "@supabase/supabase-js"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
const items = (qty = 1) => JSON.stringify([{ product_id: "zzt-gift", size: "M", color: "Black", qty }])
const MSG = "That gift card is not valid or has no balance"
const quote = async (gift: string | null, qty = 1, code: string | null = null) => (await c.query("select quote_order('', $1::jsonb, $2, 'XA', $3) as q", [items(qty), code, gift])).rows[0].q
const place = async (gift: string | null, qty = 1, email = "zzt-gift@example.com") =>
  (await c.query("select * from place_order('ZZ Gift', $1, 'Accra', 'GA', $2::jsonb, null, 'XA', '1 Test St', '1', $3)", [email, items(qty), gift])).rows[0]
const fails = async (sql: string, args: unknown[] = []) => {
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
const card = async (code: string) => (await c.query("select * from gift_cards where code = $1", [code])).rows[0]
const ledger = async (id: string) => (await c.query("select delta, kind, order_id from gift_card_ledger where card_id = $1 order by id", [id])).rows as { delta: number; kind: string; order_id: string | null }[]
const issue = async (code: string, amount: number, note = "", expires: string | null = null) => (await c.query("select issue_gift_card($1, $2, $3, '', $4) as id", [code, amount, note, expires])).rows[0].id as string

// ---- shoppers and visitors can't touch gift cards (outside the transaction, read-only checks)
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
ok("visitors can't read gift cards or the ledger", ((await anon.from("gift_cards").select("code")).data ?? []).length === 0 && ((await anon.from("gift_card_ledger").select("delta")).data ?? []).length === 0)
ok("visitors can't issue, adjust or restore", !!(await anon.rpc("issue_gift_card", { p_code: "HACKCODE12345", p_amount: 500 })).error && !!(await anon.rpc("adjust_gift_card", { p_card: "00000000-0000-0000-0000-000000000000", p_delta: 5 })).error && !!(await anon.rpc("restore_gift_card", { p_order: "G4-1" })).error)

await c.query("begin")
try {
  await c.query(`insert into products (id, sku, name, category, price, colors, sizes, stock, active) values ('zzt-gift', 'ZZT-GIFT', 'ZZ Gift', 'Tees', 20, '[{"name":"Black","hex":"#141414"}]', '["M"]', 100, true)`)
  await c.query(`insert into shipping_zones (name, countries, rate, free_over, estimate, sort) values ('ZZ Test XA', array['XA'], 10, null, '', -10)`)   // $10 shipping, so $20 + $10 = $30 per item
  await c.query(`insert into discount_codes (code, kind, value) values ('ZZTHALF', 'percent', 50)`)

  // ---- issuing
  const id = await issue("zztgift aaaa-1111", 50, "Birthday")
  const k = await card("ZZTGIFT" + "AAAA-1111")
  ok("an issued card is stored in capitals with spaces removed, at its full balance", k?.balance === 50 && k.initial_amount === 50 && k.active === true && k.note === "Birthday", k?.code)
  ok("issuing writes a ledger entry", JSON.stringify(await ledger(id)) === JSON.stringify([{ delta: 50, kind: "issue", order_id: null }]))
  ok("a code that's too short is refused", /8 to 32/.test(await fails("select issue_gift_card('SHORT', 10)")))
  const badAmounts: string[] = []
  for (const a of [0, -5, 10001]) badAmounts.push(await fails("select issue_gift_card('ZZTGIFTBAD0001', $1)", [a]))
  ok("an amount of 0, negative or over $10,000 is refused", badAmounts.every((m) => /\$1 and \$10,000/.test(m)), badAmounts.join(" | "))
  ok("an expiry in the past is refused", /in the future/.test(await fails("select issue_gift_card('ZZTGIFTBAD0002', 10, '', '', now() - interval '1 day')")))
  ok("the same code can't be issued twice", /duplicate|unique/i.test(await fails("select issue_gift_card('ZZTGIFTAAAA-1111', 10)")))

  // ---- the quote
  let q = await quote("zztgift aaaa-1111")
  ok("a card pays the whole order when it can ($20 + $10 shipping = $30)", q.total === 30 && q.gift_amount === 30 && q.amount_due === 0 && q.gift_balance_after === 20 && q.gift_error === null, JSON.stringify({ t: q.total, g: q.gift_amount, d: q.amount_due }))
  q = await quote("ZZTGIFTAAAA-1111", 5)
  ok("…or part of it when the order is bigger ($150 order, $50 card)", q.total === 110 && q.gift_amount === 50 && q.amount_due === 60 && q.gift_balance_after === 0, JSON.stringify({ t: q.total, g: q.gift_amount }))
  q = await quote("ZZTGIFTAAAA-1111", 1, "ZZTHALF")
  ok("it's applied after a discount code (50% off $20 = $10, + $10 shipping = $20)", q.discount === 10 && q.total === 20 && q.gift_amount === 20 && q.amount_due === 0, JSON.stringify({ d: q.discount, t: q.total, g: q.gift_amount }))
  ok("with no gift card, the quote is unchanged", (await quote(null)).gift_amount === 0 && (await quote(null)).amount_due === 30)

  // ---- bad cards all say the same thing
  await issue("ZZTGIFT-EXPIRED1", 20)
  await c.query("update gift_cards set expires_at = now() - interval '1 hour' where code = 'ZZTGIFT-EXPIRED1'")
  await issue("ZZTGIFT-OFF00001", 20)
  await c.query("update gift_cards set active = false where code = 'ZZTGIFT-OFF00001'")
  await issue("ZZTGIFT-EMPTY001", 20)
  await c.query("update gift_cards set balance = 0 where code = 'ZZTGIFT-EMPTY001'")
  for (const [label, code] of [["unknown", "ZZTGIFT-NOPE0000"], ["expired", "ZZTGIFT-EXPIRED1"], ["switched off", "ZZTGIFT-OFF00001"], ["empty", "ZZTGIFT-EMPTY001"]]) {
    q = await quote(code)
    ok(`a ${label} card is refused with one generic message (nothing to probe) and the bag is still priced`, q.gift_error === MSG && q.gift_amount === 0 && q.total === 30, q.gift_error)
  }
  ok("checkout refuses a bad card", (await fails("select * from place_order('ZZ', 'zzt-x@example.com', 'a', 'b', $1::jsonb, null, 'XA', null, null, 'ZZTGIFT-NOPE0000')", [items()])).includes(MSG))

  // ---- redeeming
  const o = await place("ZZTGIFTAAAA-1111")
  ok("checkout takes $30 off the card and reports it", o.gift_amount === 30 && o.amount_due === 0 && o.order_total === 30, JSON.stringify(o))
  ok("the card balance went down", (await card("ZZTGIFTAAAA-1111")).balance === 20)
  ok("the ledger records it against the order", JSON.stringify((await ledger(id)).slice(-1)) === JSON.stringify([{ delta: -30, kind: "redeem", order_id: o.order_id }]))
  const row = (await c.query("select gift_code, gift_amount, payment, total from orders where id = $1", [o.order_id])).rows[0]
  ok("the order remembers the card, the amount, and that it was paid by gift card", row.gift_code === "ZZTGIFTAAAA-1111" && row.gift_amount === 30 && row.payment === "Gift card")

  const o2 = await place("ZZTGIFTAAAA-1111", 2)
  ok("a second order only gets what's left ($20 of a $50 order), the rest is due", o2.gift_amount === 20 && o2.amount_due === 30 && o2.order_total === 50, JSON.stringify(o2))
  ok("…the card is now empty", (await card("ZZTGIFTAAAA-1111")).balance === 0)
  ok("…and the order is not marked as fully paid by gift card", (await c.query("select payment from orders where id = $1", [o2.order_id])).rows[0].payment !== "Gift card")
  ok("an empty card can't be used again", (await fails("select * from place_order('ZZ', 'zzt-y@example.com', 'a', 'b', $1::jsonb, null, 'XA', null, null, 'ZZTGIFTAAAA-1111')", [items()])).includes(MSG))
  ok("the ledger adds up to the balance (50 - 30 - 20 = 0)", (await ledger(id)).reduce((s, e) => s + e.delta, 0) === 0)

  // ---- giving it back
  ok("cancelling restores the card ($20 back from the second order)", (await c.query("select restore_gift_card($1) as n", [o2.order_id])).rows[0].n === 20 && (await card("ZZTGIFTAAAA-1111")).balance === 20)
  ok("…once only", (await c.query("select restore_gift_card($1) as n", [o2.order_id])).rows[0].n === 0 && (await card("ZZTGIFTAAAA-1111")).balance === 20)
  const plain = await place(null)
  ok("an order with no gift card restores nothing", (await c.query("select restore_gift_card($1) as n", [plain.order_id])).rows[0].n === 0)
  ok("an unknown order restores nothing", (await c.query("select restore_gift_card('NOPE-1') as n")).rows[0].n === 0)
  ok("the refund is in the ledger", (await ledger(id)).some((e) => e.kind === "refund" && e.delta === 20 && e.order_id === o2.order_id))

  // ---- adjusting
  ok("an admin can add to a balance", (await c.query("select adjust_gift_card($1, 15, 'Goodwill') as b", [id])).rows[0].b === 35)
  ok("…or take some off", (await c.query("select adjust_gift_card($1, -5, 'Correction') as b", [id])).rows[0].b === 30)
  ok("…but never below zero", /below \$0/.test(await fails("select adjust_gift_card($1, -500)", [id])) && (await card("ZZTGIFTAAAA-1111")).balance === 30)
  ok("a zero adjustment is refused", !!(await fails("select adjust_gift_card($1, 0)", [id])))
  ok("every change is in the ledger and adds up to the balance", (await ledger(id)).reduce((s, e) => s + e.delta, 0) === 30)
} finally {
  await c.query("rollback")
  const left = (await c.query("select (select count(*) from products where id = 'zzt-gift') + (select count(*) from gift_cards where code like 'ZZTGIFT%') + (select count(*) from customers where email like 'zzt-%@example.com') as n")).rows[0].n
  console.log(Number(left) === 0 ? "rolled back, nothing left behind" : "WARNING: test data still present")
  await c.end()
}
