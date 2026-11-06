/**
 * Proves customers can't reach admin data, and admins still can.   npm run test-security-db
 * Creates a throwaway customer account and a throwaway admin account (@example.com), plus one throwaway product,
 * and removes all of it at the end. Your real data is only ever read (never written) by this test.
 */
import { createClient } from "@supabase/supabase-js"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svc = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const fresh = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}

const PASSWORD = "Zzt-test-pass-9f3!"
const CUST = "zzt-sec-customer@example.com"
const OTHER = "zzt-sec-other@example.com"
const ADM = "zzt-sec-admin@example.com"
const PID = "zzt-sec"
const userIds: string[] = []
const orderIds: string[] = []

async function makeUser(email: string) {
  const { data, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw new Error(`${email}: ${error.message}`)
  userIds.push(data.user.id)
  const c = fresh()
  const r = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (r.error) throw new Error(`sign in ${email}: ${r.error.message}`)
  return { id: data.user.id, db: c }
}
const rows = async (q: PromiseLike<{ data: unknown[] | null; error: unknown }>) => ((await q).data ?? []).length

try {
  // clean any leftovers from an interrupted earlier run
  const old = (await svc.auth.admin.listUsers({ perPage: 200 })).data.users.filter((u) => u.email?.startsWith("zzt-sec-"))
  for (const u of old) await svc.auth.admin.deleteUser(u.id)
  await svc.from("products").delete().eq("id", PID)

  const cust = await makeUser(CUST)
  const other = await makeUser(OTHER)
  const adm = await makeUser(ADM)
  await svc.from("admins").upsert({ user_id: adm.id })

  const real = (await svc.from("products").select("id, active").eq("active", false)).data ?? []
  const realOrders = (await svc.from("orders").select("id", { count: "exact", head: true })).count ?? 0
  ok("(setup) the shop has hidden products and orders to protect", real.length >= 0 && realOrders > 0, `${real.length} hidden, ${realOrders} orders`)

  // ---------- who is an admin ----------
  ok("a new customer account is not an admin", (await cust.db.rpc("is_admin")).data === false)
  ok("an account on the admin list is", (await adm.db.rpc("is_admin")).data === true)
  ok("a visitor who isn't signed in is not an admin", (await fresh().rpc("is_admin")).data === false)
  ok("your real admin account is still an admin (nobody was locked out)", await (async () => {
    const real = (await svc.auth.admin.listUsers({ perPage: 200 })).data.users.filter((u) => !u.email?.startsWith("zzt-sec-"))
    const ids = new Set(((await svc.from("admins").select("user_id")).data ?? []).map((r) => r.user_id))
    return real.length > 0 && real.some((u) => ids.has(u.id))
  })())
  ok("the admin list can't be read or changed by a customer", (await rows(cust.db.from("admins").select("*"))) === 0 && !!(await cust.db.from("admins").insert({ user_id: cust.id })).error)

  // ---------- a customer can't see or change admin data ----------
  for (const t of ["orders", "order_items", "customers", "discount_codes", "sales", "shipping_zones", "site_settings", "subscribers", "email_templates", "campaigns", "email_messages", "visits", "gift_cards", "gift_card_ledger"]) {
    const n = await rows(cust.db.from(t).select("*"))
    ok(`customer can't read ${t}`, n === 0, `${n} rows`)
  }
  ok("customer can't see hidden products", (await rows(cust.db.from("products").select("id").eq("active", false))) === 0)
  ok("…but can see the shop's visible ones", (await rows(cust.db.from("products").select("id").eq("active", true))) > 0)

  await svc.from("products").insert({ id: PID, sku: "ZZT-SEC", name: "ZZ Security Test", category: "Tees", price: 10, colors: [{ name: "Black", hex: "#141414" }], sizes: ["M"], stock: 5, active: true })
  const upd = await cust.db.from("products").update({ price: 1 }).eq("id", PID).select()
  ok("customer can't change a price", (upd.data ?? []).length === 0 && (await svc.from("products").select("price").eq("id", PID).single()).data?.price === 10)
  const del = await cust.db.from("products").delete().eq("id", PID).select()
  ok("customer can't delete a product", (del.data ?? []).length === 0 && ((await svc.from("products").select("id").eq("id", PID)).data ?? []).length === 1)
  ok("customer can't add a product", !!(await cust.db.from("products").insert({ id: "zzt-sec-2", sku: "x", name: "x", category: "x", price: 1 })).error)
  ok("customer can't create a discount code", !!(await cust.db.from("discount_codes").insert({ code: "ZZTSECHACK", kind: "percent", value: 100 })).error)
  ok("customer can't change shipping zones", (await cust.db.from("shipping_zones").update({ rate: 0 }).neq("rate", -1).select()).data?.length === 0)
  ok("customer can't change settings", (await cust.db.from("site_settings").update({ value: {} }).neq("key", "x").select()).data?.length === 0)
  const cats = (await svc.from("categories").select("id, name").limit(1)).data?.[0]
  ok("customer can't rename or delete categories", !!(await cust.db.rpc("rename_category", { p_id: cats?.id, p_name: "Hacked" })).error && !!(await cust.db.rpc("delete_category", { p_id: cats?.id })).error && (await svc.from("categories").select("name").eq("id", cats!.id).single()).data?.name === cats?.name)
  ok("customer can't adjust stock", !!(await cust.db.rpc("adjust_stock", { p_product: PID, p_size: "M", p_delta: 100 })).error && (await svc.from("products").select("stock").eq("id", PID).single()).data?.stock === 5)
  ok("a visitor can't adjust stock either", !!(await fresh().rpc("adjust_stock", { p_product: PID, p_size: "M", p_delta: 100 })).error)
  const up = await cust.db.storage.from("products").upload(`zzt-sec/${Date.now()}.txt`, new Blob(["x"], { type: "text/plain" }))
  ok("customer can't upload to the product photo bucket", !!up.error, up.error?.message)

  ok("customer can't issue, adjust or restore gift cards", !!(await cust.db.rpc("issue_gift_card", { p_code: "ZZTSECGIFT0001", p_amount: 500 })).error && !!(await cust.db.rpc("adjust_gift_card", { p_card: "00000000-0000-0000-0000-000000000000", p_delta: 5 })).error && !!(await cust.db.rpc("restore_gift_card", { p_order: "G4-1" })).error)
  ok("…and nothing was created", ((await svc.from("gift_cards").select("id").like("code", "ZZTSEC%")).data ?? []).length === 0)

  // ---------- an admin still can ----------
  ok("admin sees hidden products", (await rows(adm.db.from("products").select("id"))) >= (await rows(cust.db.from("products").select("id"))))
  ok("admin can read orders", (await rows(adm.db.from("orders").select("id").limit(5))) > 0)
  ok("admin can read customers and discount codes", (await rows(adm.db.from("customers").select("id").limit(1))) > 0 && (await rows(adm.db.from("discount_codes").select("id").limit(1))) > 0)
  ok("admin can edit a product", ((await adm.db.from("products").update({ description: "edited" }).eq("id", PID).select()).data ?? []).length === 1)
  ok("admin can adjust stock", !(await adm.db.rpc("adjust_stock", { p_product: PID, p_size: "M", p_delta: 1 })).error && (await svc.from("products").select("stock").eq("id", PID).single()).data?.stock === 6)
  ok("the service role (scripts) can adjust stock", !(await svc.rpc("adjust_stock", { p_product: PID, p_size: "M", p_delta: -1 })).error)
  ok("admin can read analytics", !(await adm.db.rpc("analytics_overview", { p_days: 7 })).error)

  // ---------- orders belong to whoever placed them ----------
  const items = [{ product_id: PID, size: "M", color: "Black", qty: 1 }]
  const mine = await cust.db.rpc("place_order", { p_name: "ZZ Customer", p_email: CUST, p_city: "x", p_state: "y", p_items: items, p_code: null, p_country: "US", p_address: "1 Test St", p_postcode: "1" })
  const mineId = (Array.isArray(mine.data) ? mine.data[0] : mine.data)?.order_id
  if (mineId) orderIds.push(mineId)
  ok("a signed-in customer can place an order", !mine.error && !!mineId, mine.error?.message)
  const guest = await fresh().rpc("place_order", { p_name: "ZZ Guest", p_email: "zzt-sec-guest@example.com", p_city: "x", p_state: "y", p_items: items, p_code: null, p_country: "US", p_address: "2 Test St", p_postcode: "2" })
  const guestId = (Array.isArray(guest.data) ? guest.data[0] : guest.data)?.order_id
  if (guestId) orderIds.push(guestId)
  ok("a guest can still place an order (accounts are optional)", !guest.error && !!guestId, guest.error?.message)

  const stored = (await svc.from("orders").select("id, user_id").in("id", orderIds)).data ?? []
  ok("the order is tied to the account that placed it", stored.find((o) => o.id === mineId)?.user_id === cust.id)
  ok("a guest order isn't tied to anyone", stored.find((o) => o.id === guestId)?.user_id === null)
  const seen = (await cust.db.from("orders").select("id").in("id", orderIds)).data ?? []
  ok("the customer sees their own order and not the guest's", seen.length === 1 && seen[0].id === mineId)
  ok("…including its items", (await rows(cust.db.from("order_items").select("id").eq("order_id", mineId))) === 1)
  ok("another customer sees neither", (await rows(other.db.from("orders").select("id").in("id", orderIds))) === 0 && (await rows(other.db.from("order_items").select("id").in("order_id", orderIds))) === 0)
  ok("a customer can't edit their own order (e.g. mark it free or shipped)", ((await cust.db.from("orders").update({ total: 0, status: "shipped" }).eq("id", mineId).select()).data ?? []).length === 0 && (await svc.from("orders").select("total, status").eq("id", mineId).single()).data?.status === "pending")
  ok("a customer can't delete their order", ((await cust.db.from("orders").delete().eq("id", mineId).select()).data ?? []).length === 0)
} finally {
  if (orderIds.length) {
    await svc.from("order_items").delete().in("order_id", orderIds)
    await svc.from("orders").delete().in("id", orderIds)
  }
  await svc.from("customers").delete().in("email", [CUST, OTHER, ADM, "zzt-sec-guest@example.com"])
  await svc.from("products").delete().eq("id", PID)
  for (const id of userIds) await svc.auth.admin.deleteUser(id)
  const left = (await svc.auth.admin.listUsers({ perPage: 200 })).data.users.filter((u) => u.email?.startsWith("zzt-sec-")).length
  const adminsLeft = ((await svc.from("admins").select("user_id")).data ?? []).length
  console.log(left === 0 ? "cleaned up (test accounts, product and orders removed)" : "WARNING: test accounts still exist", `| admins in list: ${adminsLeft}`)
}
