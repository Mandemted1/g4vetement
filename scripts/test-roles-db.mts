/**
 * Proves what each team role can and can't do, using real accounts.   npm run test-roles-db
 * Creates four throwaway accounts (owner, manager, fulfilment, viewer) plus a few throwaway rows, and removes all of it.
 */
import pg from "pg"
import { createClient } from "@supabase/supabase-js"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const svc = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const fresh = () => createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}
const PASSWORD = "Zzt-role-pass-91!"
type RoleName = "owner" | "manager" | "fulfilment" | "viewer"
const ROLES: RoleName[] = ["owner", "manager", "fulfilment", "viewer"]
const userIds: string[] = []
const T = { orders: ["ZZRL-1"], customer: "C-ZZRL", product: "zzt-role", cat: "ZZ Role Cat", disc: "ZZTROLECODE", review: "", zone: "" }

async function member(role: RoleName) {
  const email = `zzt-role-${role}@example.com`
  const { data, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw new Error(error.message)
  userIds.push(data.user.id)
  await svc.from("admins").upsert({ user_id: data.user.id, role })
  const db = fresh()
  const r = await db.auth.signInWithPassword({ email, password: PASSWORD })
  if (r.error) throw new Error(r.error.message)
  return { id: data.user.id, db }
}
const rows = async (q: PromiseLike<{ data: unknown[] | null }>) => ((await q).data ?? []).length

try {
  for (const u of (await svc.auth.admin.listUsers({ perPage: 200 })).data.users.filter((u) => u.email?.startsWith("zzt-role-"))) await svc.auth.admin.deleteUser(u.id)
  await svc.from("products").delete().eq("id", T.product)
  await svc.from("categories").delete().eq("name", T.cat)

  const who = {} as Record<RoleName, Awaited<ReturnType<typeof member>>>
  for (const r of ROLES) who[r] = await member(r)
  const outsider = await (async () => {
    const { data } = await svc.auth.admin.createUser({ email: "zzt-role-outsider@example.com", password: PASSWORD, email_confirm: true })
    userIds.push(data.user!.id)
    const db = fresh()
    await db.auth.signInWithPassword({ email: "zzt-role-outsider@example.com", password: PASSWORD })
    return { id: data.user!.id, db }
  })()

  // ---------- test rows
  await svc.from("products").insert({ id: T.product, sku: "ZZT-ROLE", name: "ZZ Role Tee", category: "Tees", price: 20, colors: [{ name: "Black", hex: "#141414" }], sizes: ["M"], stock: 10, active: false })
  await svc.from("customers").insert({ id: T.customer, name: "ZZ Role", email: "zzt-role-cust@example.com" })
  await svc.from("orders").insert({ id: T.orders[0], number: 997001, customer_id: T.customer, subtotal: 20, total: 20, sim: true })
  await svc.from("categories").insert({ name: T.cat, sort: 999 })
  await svc.from("visits").insert({ visitor_id: "zzt-role", session_id: "zzt-role", path: "/zzt-role" })
  await svc.from("subscribers").insert({ email: "zzt-role-sub@example.com" })
  await svc.from("gift_cards").insert({ code: "ZZTROLEGIFT01", initial_amount: 10, balance: 10 })
  const cat = (await svc.from("categories").select("id").eq("name", T.cat).single()).data!
  T.zone = (await svc.from("shipping_zones").insert({ name: "ZZ Role Zone", countries: ["XA"], rate: 5, sort: 999, active: false }).select("id").single()).data!.id

  // ---------- who is who
  for (const r of ROLES) ok(`staff_role() tells a ${r} they are a ${r}`, (await who[r].db.rpc("staff_role")).data === r)
  ok("someone not on the team has no role and can do nothing", (await outsider.db.rpc("staff_role")).data === null && (await outsider.db.rpc("can_do", { p_cap: "orders.manage" })).data === false)
  ok("the team list can't be read or edited through the API, even by an owner", (await rows(who.owner.db.from("admins").select("*"))) === 0 && !!(await who.owner.db.from("admins").insert({ user_id: outsider.id, role: "owner" })).error && ((await who.owner.db.from("admins").update({ role: "viewer" }).eq("user_id", who.owner.id).select()).data ?? []).length === 0)

  // ---------- everyone on the team can look
  for (const r of ROLES) {
    ok(`${r} can see orders, customers and hidden products`, (await rows(who[r].db.from("orders").select("id").eq("id", T.orders[0]))) === 1 && (await rows(who[r].db.from("customers").select("id").eq("id", T.customer))) === 1 && (await rows(who[r].db.from("products").select("id").eq("id", T.product))) === 1)
  }
  ok("someone not on the team sees none of it", (await rows(outsider.db.from("orders").select("id"))) === 0 && (await rows(outsider.db.from("products").select("id").eq("id", T.product))) === 0)

  // ---------- orders: owner, manager, fulfilment
  for (const r of ROLES) {
    await svc.from("orders").update({ status: "pending" }).eq("id", T.orders[0])
    const res = await who[r].db.from("orders").update({ status: "processing" }).eq("id", T.orders[0]).select("id")
    const changed = (await svc.from("orders").select("status").eq("id", T.orders[0]).single()).data?.status === "processing"
    ok(`${r} ${["owner", "manager", "fulfilment"].includes(r) ? "can" : "can't"} update an order's status`, changed === ["owner", "manager", "fulfilment"].includes(r), `${(res.data ?? []).length} rows`)
  }

  // ---------- products & categories: owner, manager
  for (const r of ROLES) {
    await svc.from("products").update({ price: 20 }).eq("id", T.product)
    await who[r].db.from("products").update({ price: 99 }).eq("id", T.product)
    const changed = (await svc.from("products").select("price").eq("id", T.product).single()).data?.price === 99
    ok(`${r} ${["owner", "manager"].includes(r) ? "can" : "can't"} change a product`, changed === ["owner", "manager"].includes(r))
  }
  for (const r of ROLES) {
    const res = await who[r].db.rpc("rename_category", { p_id: cat.id, p_name: T.cat })
    ok(`${r} ${["owner", "manager"].includes(r) ? "can" : "can't"} manage categories`, !res.error === ["owner", "manager"].includes(r), res.error?.message ?? "")
  }

  // ---------- stock: orders or products
  for (const r of ROLES) {
    const res = await who[r].db.rpc("adjust_stock", { p_product: T.product, p_size: "M", p_delta: 0 })
    ok(`${r} ${r === "viewer" ? "can't" : "can"} adjust stock (needed to put items back when an order is cancelled)`, !res.error === (r !== "viewer"), res.error?.message ?? "")
  }

  // ---------- marketing: owner, manager
  for (const r of ROLES) {
    await svc.from("discount_codes").delete().eq("code", T.disc)
    const res = await who[r].db.from("discount_codes").insert({ code: T.disc, kind: "percent", value: 5 })
    const made = ((await svc.from("discount_codes").select("id").eq("code", T.disc)).data ?? []).length === 1
    ok(`${r} ${["owner", "manager"].includes(r) ? "can" : "can't"} create a discount code`, made === ["owner", "manager"].includes(r), res.error?.message ?? "")
  }
  await svc.from("discount_codes").delete().eq("code", T.disc)
  for (const r of ROLES) ok(`${r} ${["owner", "manager"].includes(r) ? "can" : "can't"} read subscribers`, ((await rows(who[r].db.from("subscribers").select("email").eq("email", "zzt-role-sub@example.com"))) === 1) === ["owner", "manager"].includes(r))

  // ---------- gift cards: owner, manager (and cancelling orders may restore them)
  for (const r of ROLES) {
    const res = await who[r].db.rpc("issue_gift_card", { p_code: `ZZTROLEISSUE${r.toUpperCase()}`, p_amount: 5 })
    ok(`${r} ${["owner", "manager"].includes(r) ? "can" : "can't"} issue a gift card`, !res.error === ["owner", "manager"].includes(r), res.error?.message ?? "")
    ok(`${r} ${["owner", "manager"].includes(r) ? "can" : "can't"} read gift cards`, ((await rows(who[r].db.from("gift_cards").select("code").eq("code", "ZZTROLEGIFT01"))) === 1) === ["owner", "manager"].includes(r))
    const rest = await who[r].db.rpc("restore_gift_card", { p_order: "NOPE-1" })
    ok(`${r} ${r === "viewer" ? "can't" : "can"} put gift-card money back on a cancelled order`, !rest.error === (r !== "viewer"), rest.error?.message ?? "")
  }

  // ---------- reviews: owner, manager
  await svc.from("products").update({ active: true }).eq("id", T.product)
  const { data: rv } = await svc.from("reviews").insert({ product_id: T.product, user_id: who.viewer.id, author: "ZZ", rating: 5, title: "x" }).select("id").single()
  T.review = rv!.id
  for (const r of ROLES) {
    await svc.from("reviews").update({ status: "published" }).eq("id", T.review)
    await who[r].db.from("reviews").update({ status: "hidden" }).eq("id", T.review)
    const hidden = (await svc.from("reviews").select("status").eq("id", T.review).single()).data?.status === "hidden"
    ok(`${r} ${["owner", "manager"].includes(r) ? "can" : "can't"} hide a review`, hidden === ["owner", "manager"].includes(r))
  }

  // ---------- analytics: not fulfilment
  for (const r of ROLES) ok(`${r} ${r === "fulfilment" ? "can't" : "can"} see visitor analytics`, ((await rows(who[r].db.from("visits").select("id").eq("visitor_id", "zzt-role"))) === 1) === (r !== "fulfilment"))

  // ---------- settings & shipping: owner only
  for (const r of ROLES) {
    await svc.from("site_settings").delete().eq("key", "zzt-role-key")
    await who[r].db.from("site_settings").insert({ key: "zzt-role-key", value: {} })
    const saved = ((await svc.from("site_settings").select("key").eq("key", "zzt-role-key")).data ?? []).length === 1
    ok(`${r} ${r === "owner" ? "can" : "can't"} change store settings`, saved === (r === "owner"))
    // only ever touches the throwaway zone, never your real ones
    await svc.from("shipping_zones").update({ rate: 5 }).eq("id", T.zone)
    await who[r].db.from("shipping_zones").update({ rate: 77 }).eq("id", T.zone)
    const rate = (await svc.from("shipping_zones").select("rate").eq("id", T.zone).single()).data?.rate
    ok(`${r} ${r === "owner" ? "can" : "can't"} change shipping zones`, (rate === 77) === (r === "owner"))
  }
  await svc.from("site_settings").delete().eq("key", "zzt-role-key")
  ok("everyone on the team can read settings (so the admin can show the store's name)", (await rows(who.viewer.db.from("site_settings").select("key"))) > 0)

  // ---------- the last owner can't be removed or demoted (inside a transaction that is rolled back)
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  try {
    await c.query("begin")
    await c.query("delete from admins where user_id = $1", [who.owner.id])   // fine: your real owner remains
    const owners = (await c.query("select user_id from admins where role = 'owner'")).rows
    ok("(setup) exactly one owner is left inside the test transaction", owners.length === 1)
    const only = owners[0].user_id as string
    await c.query("savepoint a")
    let msg = ""
    try { await c.query("delete from admins where user_id = $1", [only]) } catch (e) { msg = (e as Error).message }
    await c.query("rollback to savepoint a")
    ok("the last owner can't be deleted", /at least one owner/.test(msg), msg)
    await c.query("savepoint b")
    msg = ""
    try { await c.query("update admins set role = 'manager' where user_id = $1", [only]) } catch (e) { msg = (e as Error).message }
    await c.query("rollback to savepoint b")
    ok("…or demoted", /at least one owner/.test(msg), msg)
    await c.query("update admins set role = 'manager' where user_id = $1", [who.manager.id])
    ok("other roles can be changed freely", (await c.query("select role from admins where user_id = $1", [who.manager.id])).rows[0].role === "manager")
  } finally {
    await c.query("rollback")
    await c.end()
  }
  const real = (await svc.from("admins").select("user_id").eq("role", "owner")).data ?? []
  ok("(check) your real owner is untouched", real.length >= 1 && real.some((r) => !userIds.includes(r.user_id)))
} finally {
  await svc.from("reviews").delete().eq("product_id", T.product)
  await svc.from("orders").delete().in("id", T.orders)
  await svc.from("customers").delete().eq("id", T.customer)
  await svc.from("products").delete().eq("id", T.product)
  await svc.from("categories").delete().eq("name", T.cat)
  await svc.from("visits").delete().eq("visitor_id", "zzt-role")
  await svc.from("subscribers").delete().eq("email", "zzt-role-sub@example.com")
  await svc.from("gift_cards").delete().like("code", "ZZTROLE%")
  await svc.from("discount_codes").delete().eq("code", T.disc)
  await svc.from("site_settings").delete().eq("key", "zzt-role-key")
  if (T.zone) await svc.from("shipping_zones").delete().eq("id", T.zone)
  for (const id of userIds) await svc.auth.admin.deleteUser(id)
  const left = (await svc.auth.admin.listUsers({ perPage: 200 })).data.users.filter((u) => u.email?.startsWith("zzt-role-")).length
  const zones = (await svc.from("shipping_zones").select("id").like("name", "ZZ Role%")).data?.length ?? 0
  console.log(left === 0 && zones === 0 ? "cleaned up" : "WARNING: leftovers")
}
