/**
 * Checks abandoned-cart capture, the reminder job, opt-out/restore links, and the owner alerts, against your database.
 *   npm run test-carts
 * No real email is sent: a fake sender collects what would have gone out. It creates two throwaway products, test carts
 * and one test order (all @example.com), briefly switches your notification settings, and restores everything at the end.
 */
import { createClient } from "@supabase/supabase-js"
import { captureCart, getCartByToken, markCartRecovered, optOutByToken, processAbandonedCarts } from "../src/lib/email/abandoned"
import { notifyStoreOwner } from "../src/lib/email/owner-alerts"
import type { OutgoingEmail, SendResult } from "../src/lib/email/send"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const db = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const anon = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}

const P1 = "zzt-cart1" // in stock
const P2 = "zzt-cart2" // sold out
const PO = "zzt-own1" // for the owner-alert test
const E = (n: string) => `zzt-cart-${n}@example.com`
const NOW = Date.now()
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()

const sent: OutgoingEmail[] = []
const fakeSend = async (e: OutgoingEmail): Promise<SendResult> => (sent.push(e), { ok: true, id: "fake" })
const failingSend = async (): Promise<SendResult> => ({ ok: false, error: "boom" })
const line = (pid: string, qty = 1) => ({ productId: pid, size: "M", color: "Black", qty })
const row = async (email: string) => (await db.from("abandoned_carts").select("*").eq("email", email).maybeSingle()).data
const seed = async (email: string, o: Record<string, unknown> = {}) => {
  const { error } = await db.from("abandoned_carts").upsert({ email, items: [line(P1)], subtotal: 20, updated_at: hoursAgo(5), recovered_at: null, reminder_sent_at: null, ...o }, { onConflict: "email" })
  if (error) throw new Error(error.message)
}

const prev = (await db.from("site_settings").select("value").eq("key", "alerts").maybeSingle()).data
const setAlerts = (v: Record<string, unknown>) => db.from("site_settings").upsert({ key: "alerts", value: v })

try {
  await db.from("abandoned_carts").delete().like("email", "zzt-cart-%")
  await db.from("cart_reminder_optouts").delete().like("email", "zzt-cart-%")
  await db.from("products").delete().in("id", [P1, P2, PO])
  const base = { sku: "ZZT", category: "Tees", price: 20, colors: [{ name: "Black", hex: "#141414" }], sizes: ["M"], active: true, reorder_level: 10 }
  const made = await db.from("products").insert([{ ...base, id: P1, name: "ZZ Cart Tee", stock: 50 }, { ...base, id: P2, name: "ZZ Cart Sold Out", stock: 0 }, { ...base, id: PO, name: "ZZ Own Tee", stock: 9 }])
  if (made.error) throw new Error("couldn't create test products: " + made.error.message)

  // ---------- the closed tables
  ok("visitors can't read saved carts or opt-outs", ((await anon.from("abandoned_carts").select("email")).data ?? []).length === 0 && ((await anon.from("cart_reminder_optouts").select("email")).data ?? []).length === 0)
  ok("visitors can't write them either", !!(await anon.from("abandoned_carts").insert({ email: E("hack"), items: [] })).error && !!(await anon.from("cart_reminder_optouts").insert({ email: E("hack") })).error)

  // ---------- capture
  await setAlerts({ newOrder: true, lowStock: true, abandonedCart: false, email: "owner@example.com" })
  ok("with reminders off, nothing is stored", (await captureCart({ email: E("a"), items: [line(P1)] })).skipped === "off" && !(await row(E("a"))))
  await setAlerts({ newOrder: true, lowStock: true, abandonedCart: true, email: "owner@example.com" })
  ok("an invalid email or bag is refused", !(await captureCart({ email: "nope", items: [line(P1)] })).ok && !(await captureCart({ email: E("a"), items: [] })).ok && !(await captureCart({ email: E("a"), items: [{ productId: P1, size: "M", color: "Black", qty: 99 }] })).ok)
  ok("a bag is stored with its token", (await captureCart({ email: "  ZZT-Cart-A@Example.com ", items: [line(P1, 2)], country: "gh" })).ok)
  let r = await row(E("a"))
  ok("…the email is lowercased, the price comes from the catalog ($20 × 2), the country is kept", r?.email === E("a") && r.subtotal === 40 && r.country === "GH" && /^[0-9a-f-]{36}$/.test(r.token), JSON.stringify({ s: r?.subtotal, c: r?.country }))
  const token = r!.token as string
  await captureCart({ email: E("a"), items: [line(P1, 3), { productId: "no-such-product", size: "M", color: "Black", qty: 1 }] })
  r = await row(E("a"))
  ok("typing again updates the same row (one per email), keeps the token, and drops unknown products", r?.subtotal === 60 && r.token === token && (r.items as unknown[]).length === 1 && ((await db.from("abandoned_carts").select("id").eq("email", E("a"))).data ?? []).length === 1)
  ok("a bag with only unknown products isn't stored", (await captureCart({ email: E("b"), items: [{ productId: "no-such-product", size: "M", color: "Black", qty: 1 }] })).skipped === "nothing_valid" && !(await row(E("b"))))
  await markCartRecovered(E("a"))
  ok("ordering marks the bag recovered", !!(await row(E("a")))?.recovered_at)
  await captureCart({ email: E("a"), items: [line(P1)] })
  ok("starting a new bag after that makes it active again", (await row(E("a")))?.recovered_at === null)

  // ---------- the reminder job
  await db.from("abandoned_carts").delete().like("email", "zzt-cart-%")
  await seed(E("a"))                                                                  // due
  await seed(E("b"), { updated_at: hoursAgo(0.5) })                                    // still being filled
  await seed(E("c"), { updated_at: hoursAgo(24 * 9) })                                 // too old (also outside the query window)
  await seed(E("d"), { items: [line(P2)] })                                            // only a sold-out product
  await seed(E("e"), { reminder_sent_at: hoursAgo(24 * 3) })                           // reminded 3 days ago
  await seed(E("f"), { recovered_at: hoursAgo(1) })                                    // ordered
  await seed(E("g"))                                                                   // opted out
  await db.from("cart_reminder_optouts").insert({ email: E("g") })
  await seed(E("h"))                                                                   // ordered after leaving (below)
  await db.from("customers").insert({ id: "C-ZZCART", name: "ZZ", email: E("h").replace("@", "_x@").replace("_x", "") })
  await db.from("orders").insert({ id: "ZZC-1", number: 996001, customer_id: "C-ZZCART", subtotal: 20, total: 20, sim: true, created_at: hoursAgo(1) })
  await seed(E("i"), { items: [line(P1), line(P2)] })                                  // one sold-out line is dropped from the email
  sent.length = 0
  const run = await processAbandonedCarts({ now: NOW, send: fakeSend })
  const to = sent.map((s) => s.to).sort()
  ok("exactly the right people are emailed (a and i)", JSON.stringify(to) === JSON.stringify([E("a"), E("i")]), to.join(", "))
  ok("the run reports what happened (bags still being filled or older than 7 days are filtered out before they are even considered)", run.sent === 2 && run.failed === 0 && run.considered === 6 && (run.notDue.cooldown ?? 0) === 1 && (run.notDue.opted_out ?? 0) === 1 && (run.notDue.ordered_since ?? 0) === 1 && (run.notDue.unavailable ?? 0) === 1, JSON.stringify(run))
  const ra = await row(E("a"))
  const mail = sent.find((s) => s.to === E("a"))!
  ok("the email has the right subject, the bag, a return link with the token and a stop link", mail.subject === "You left something in your bag" && mail.html.includes("ZZ Cart Tee") && mail.html.includes(`/bag/${ra!.token}`) && mail.html.includes(`/reminders/stop/${ra!.token}`) && />Stop reminders</.test(mail.html))
  ok("the mixed bag only lists what can still be bought", !sent.find((s) => s.to === E("i"))!.html.includes("ZZ Cart Sold Out"))
  ok("sent bags are stamped so they aren't reminded again", !!ra?.reminder_sent_at && !!(await row(E("i")))?.reminder_sent_at)
  ok("the sold-out-only bag was not stamped (nothing to remind about)", !(await row(E("d")))?.reminder_sent_at)
  sent.length = 0
  const again = await processAbandonedCarts({ now: NOW, send: fakeSend })
  ok("running the job again sends nothing (one reminder only)", again.sent === 0 && sent.length === 0, JSON.stringify(again.notDue))
  await seed(E("j"))
  const bad = await processAbandonedCarts({ now: NOW, send: failingSend })
  ok("a failed send is counted and the bag is NOT stamped, so it retries next run", bad.failed === 1 && !(await row(E("j")))?.reminder_sent_at)
  sent.length = 0
  await processAbandonedCarts({ now: NOW, send: fakeSend })
  ok("…and the retry works", sent.length === 1 && sent[0].to === E("j") && !!(await row(E("j")))?.reminder_sent_at)
  await setAlerts({ newOrder: true, lowStock: true, abandonedCart: false, email: "" })
  await seed(E("a"), { reminder_sent_at: null })
  sent.length = 0
  ok("with reminders switched off, the job sends nothing at all", (await processAbandonedCarts({ now: NOW, send: fakeSend })).skipped === "reminders are off" && sent.length === 0)
  await setAlerts({ newOrder: true, lowStock: true, abandonedCart: true, email: "owner@example.com" })

  // ---------- links in the email
  const token2 = (await row(E("a")))!.token as string
  const cart = await getCartByToken(token2)
  ok("the return link finds the bag by its token", cart?.email === E("a") && cart.items.length === 1)
  ok("a made-up or malformed token finds nothing", (await getCartByToken("00000000-0000-0000-0000-000000000000")) === null && (await getCartByToken("../etc/passwd")) === null)
  const out = await optOutByToken(token2)
  ok("'stop reminders' deletes the saved bag and remembers the address", out.ok && !(await row(E("a"))) && !!(await db.from("cart_reminder_optouts").select("email").eq("email", E("a")).maybeSingle()).data)
  ok("an opted-out address can't be captured again", (await captureCart({ email: E("a"), items: [line(P1)] })).skipped === "opted_out" && !(await row(E("a"))))
  ok("using the stop link twice is harmless", (await optOutByToken(token2)).ok === false)

  // ---------- owner alerts
  await db.from("customers").insert({ id: "C-ZZOWN", name: "Owen Buyer", email: E("own") })
  await db.from("orders").insert({ id: "ZZO-1", number: 996002, customer_id: "C-ZZOWN", subtotal: 40, shipping: 9, total: 49, sim: true, ship_address: "5 Test Rd", ship_city: "Accra", ship_country: "GH" })
  await db.from("order_items").insert({ order_id: "ZZO-1", product_id: PO, name: "ZZ Own Tee", size: "M", color: "Black", color_hex: "#141414", qty: 2, price: 20 })
  sent.length = 0
  let o = await notifyStoreOwner("ZZO-1", { send: fakeSend })
  ok("a new order emails the owner, and a product crossing its warning level emails again", o.newOrder === "sent" && o.lowStock === "sent" && sent.length === 2 && sent.every((s) => s.to === "owner@example.com"), JSON.stringify(o))
  ok("the order alert has the customer and the delivery address", /Owen Buyer/.test(sent[0].html) && /5 Test Rd/.test(sent[0].html) && /^New order ZZO-1 · \$49/.test(sent[0].subject), sent[0].subject)
  ok("the stock alert says how many are left (9, warning at 10)", sent[1].subject === "Low stock: ZZ Own Tee (9 left)" && /warning level is 10/.test(sent[1].html), sent[1].subject)
  await setAlerts({ newOrder: false, lowStock: true, abandonedCart: false, email: "owner@example.com" })
  sent.length = 0
  o = await notifyStoreOwner("ZZO-1", { send: fakeSend })
  ok("with order alerts off you only get the stock alert", o.newOrder === "off" && o.lowStock === "sent" && sent.length === 1 && /^Low stock/.test(sent[0].subject))
  await setAlerts({ newOrder: true, lowStock: false, abandonedCart: false, email: "owner@example.com" })
  sent.length = 0
  o = await notifyStoreOwner("ZZO-1", { send: fakeSend })
  ok("with stock alerts off you only get the order alert", o.lowStock === "off" && o.newOrder === "sent" && sent.length === 1 && /^New order/.test(sent[0].subject))
  await setAlerts({ newOrder: false, lowStock: false, abandonedCart: false, email: "owner@example.com" })
  sent.length = 0
  o = await notifyStoreOwner("ZZO-1", { send: fakeSend })
  ok("with both off, nothing is sent", sent.length === 0 && o.newOrder === "off" && o.lowStock === "off")
  await setAlerts({ newOrder: true, lowStock: true, abandonedCart: false, email: "" })
  sent.length = 0
  o = await notifyStoreOwner("ZZO-1", { send: fakeSend })
  const store = (await db.from("site_settings").select("value").eq("key", "store").maybeSingle()).data?.value as { email?: string } | undefined
  ok("with no alerts address it uses the store's contact email, or sends nothing if there is none", store?.email ? sent.length >= 1 && sent[0].to === store.email : sent.length === 0 && /No alerts email/.test(o.error ?? ""), `store email: ${store?.email || "(none)"}`)
  await setAlerts({ newOrder: true, lowStock: true, abandonedCart: false, email: "owner@example.com" })
  sent.length = 0
  o = await notifyStoreOwner("ZZO-1", { send: async () => ({ ok: false, error: "resend down" }) })
  ok("a failing email never throws and is reported", o.newOrder === "failed" && /resend down/.test(o.error ?? ""))
  ok("an order that doesn't exist is handled quietly", (await notifyStoreOwner("NOPE-1", { send: fakeSend })).newOrder !== "sent")
} finally {
  // put the notification settings back exactly as they were
  if (prev) await db.from("site_settings").upsert({ key: "alerts", value: prev.value })
  else await db.from("site_settings").delete().eq("key", "alerts")
  await db.from("order_items").delete().in("order_id", ["ZZO-1"])
  await db.from("orders").delete().in("id", ["ZZC-1", "ZZO-1"])
  await db.from("customers").delete().in("id", ["C-ZZCART", "C-ZZOWN"])
  await db.from("abandoned_carts").delete().like("email", "zzt-cart-%")
  await db.from("cart_reminder_optouts").delete().like("email", "zzt-cart-%")
  await db.from("email_messages").delete().like("to_email", "zzt-cart-%")
  await db.from("products").delete().in("id", [P1, P2, PO])
  const left = (await db.from("abandoned_carts").select("id").like("email", "zzt-cart-%")).data?.length ?? 0
  const prods = (await db.from("products").select("id").like("id", "zzt-%")).data?.length ?? 0
  const after = (await db.from("site_settings").select("value").eq("key", "alerts").maybeSingle()).data
  console.log(left === 0 && prods === 0 && JSON.stringify(after?.value ?? null) === JSON.stringify(prev?.value ?? null) ? "cleaned up, settings restored" : "WARNING: leftovers or settings not restored")
}
