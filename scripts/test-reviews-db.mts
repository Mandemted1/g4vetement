/**
 * Checks the review rules in the database.   npm run test-reviews-db
 * Uses throwaway customer accounts (@example.com), one throwaway product and its orders; all removed at the end.
 */
import { createClient } from "@supabase/supabase-js"

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const svc = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const fresh = () => createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}
const PASSWORD = "Zzt-test-pass-9f3!"
const PID = "zzt-rev"
const PID2 = "zzt-rev2"
const userIds: string[] = []
const orderIds: string[] = []
const emails: string[] = []

async function user(email: string, full_name: string) {
  const { data, error } = await svc.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name } })
  if (error) throw new Error(error.message)
  userIds.push(data.user.id)
  emails.push(email)
  const db = fresh()
  const r = await db.auth.signInWithPassword({ email, password: PASSWORD })
  if (r.error) throw new Error(r.error.message)
  return { id: data.user.id, db }
}
/** an order for the product, owned by this user, in the given status */
async function order(uid: string, email: string, pid: string, status: string) {
  const cid = `C-ZZR${orderIds.length}`
  await svc.from("customers").insert({ id: cid, name: "ZZ", email: `${cid.toLowerCase()}-${email}` })
  const n = 990000 + orderIds.length + Math.floor(Math.random() * 5000)
  const id = `ZZR-${n}`
  const { error } = await svc.from("orders").insert({ id, number: n, customer_id: cid, user_id: uid, status, subtotal: 20, total: 20, sim: true })
  if (error) throw new Error(error.message)
  await svc.from("order_items").insert({ order_id: id, product_id: pid, name: "ZZ", size: "M", color: "Black", color_hex: "#141414", qty: 1, price: 20 })
  orderIds.push(id)
  return id
}
const rev = (db: ReturnType<typeof fresh>, pid: string, rating: number, title = "Great", body = "Fits well.") => db.rpc("submit_review", { p_product: pid, p_rating: rating, p_title: title, p_body: body })

try {
  for (const u of (await svc.auth.admin.listUsers({ perPage: 200 })).data.users.filter((u) => u.email?.startsWith("zzt-rev"))) await svc.auth.admin.deleteUser(u.id)
  await svc.from("products").delete().in("id", [PID, PID2])
  const base = { sku: "ZZT", category: "Tees", price: 20, colors: [{ name: "Black", hex: "#141414" }], sizes: ["M"], stock: 5, active: true }
  await svc.from("products").insert([{ ...base, id: PID, name: "ZZ Review Tee" }, { ...base, id: PID2, name: "ZZ Review Tee 2" }])

  const alex = await user("zzt-rev-a@example.com", "Alex Morgan")
  const sam = await user("zzt-rev-b@example.com", "Sam")
  const nobody = await user("zzt-rev-c@example.com", "")
  const stranger = await user("zzt-rev-d@example.com", "Pat Q Public")

  // ---- who may review
  ok("a visitor who isn't signed in can't review", !!(await rev(fresh(), PID, 5)).error)
  ok("someone who never bought it can't review", /once you have received it/.test((await rev(alex.db, PID, 5)).error?.message ?? ""))
  ok("can_review is false before buying", (await alex.db.rpc("can_review", { p_product: PID })).data === false)
  await order(alex.id, "a", PID, "pending")
  ok("an order that hasn't shipped doesn't count", (await alex.db.rpc("can_review", { p_product: PID })).data === false && !!(await rev(alex.db, PID, 5)).error)
  await order(alex.id, "a", PID, "cancelled")
  ok("a cancelled order doesn't count", (await alex.db.rpc("can_review", { p_product: PID })).data === false)
  await order(alex.id, "a", PID, "shipped")
  ok("once it has shipped, they can", (await alex.db.rpc("can_review", { p_product: PID })).data === true)
  ok("…for that product only", (await alex.db.rpc("can_review", { p_product: PID2 })).data === false && !!(await rev(alex.db, PID2, 5)).error)
  ok("someone else's purchase doesn't help you", (await sam.db.rpc("can_review", { p_product: PID })).data === false && !!(await rev(sam.db, PID, 5)).error)

  // ---- writing one
  ok("rating must be 1 to 5", /1 to 5/.test((await rev(alex.db, PID, 0)).error?.message ?? "") && !!(await rev(alex.db, PID, 6)).error)
  ok("title and text have limits", !!(await rev(alex.db, PID, 5, "x".repeat(81))).error && !!(await rev(alex.db, PID, 5, "ok", "y".repeat(1501))).error)
  const first = await rev(alex.db, PID, 4, "  Solid tee  ", "  Heavy and boxy.  ")
  ok("a valid review is saved", !first.error, first.error?.message)
  const mine = (await svc.from("reviews").select("*").eq("product_id", PID).eq("user_id", alex.id).single()).data
  ok("it's trimmed and shows 'first name + last initial'", mine?.title === "Solid tee" && mine.body === "Heavy and boxy." && mine.author === "Alex M." && mine.status === "published", `${mine?.author}`)
  ok("a single name is used as is", await (async () => { await order(sam.id, "b", PID, "delivered"); await rev(sam.db, PID, 2, "Meh"); return (await svc.from("reviews").select("author").eq("user_id", sam.id).single()).data?.author === "Sam" })())
  await order(nobody.id, "c", PID, "delivered")
  await rev(nobody.db, PID, 5, "")
  ok("no name on the account → 'Customer'", (await svc.from("reviews").select("author, title").eq("user_id", nobody.id).single()).data?.author === "Customer")
  await order(stranger.id, "d", PID, "delivered")
  await rev(stranger.db, PID, 5, "Love it")
  ok("with several names, the last initial is used ('Pat Q Public' → 'Pat P.')", (await svc.from("reviews").select("author").eq("user_id", stranger.id).single()).data?.author === "Pat P.")

  // ---- one per product, editable
  await rev(alex.db, PID, 5, "Even better", "Washed well.")
  const all = (await svc.from("reviews").select("rating, title").eq("product_id", PID).eq("user_id", alex.id)).data ?? []
  ok("reviewing again edits the same review (one per product)", all.length === 1 && all[0].rating === 5 && all[0].title === "Even better")

  // ---- what the public sees
  const seen = (await fresh().from("reviews").select("author, rating, title, body").eq("product_id", PID)).data ?? []
  ok("anyone can read published reviews", seen.length === 4)
  ok("…but the account behind a review stays private: user_id can't be read by visitors", !!(await fresh().from("reviews").select("user_id").eq("product_id", PID)).error)
  ok("…or by other customers, or with select *", !!(await alex.db.from("reviews").select("user_id").eq("product_id", PID)).error && !!(await fresh().from("reviews").select("*").eq("product_id", PID)).error)
  ok("my_review gives a customer back their own review (and only theirs)", await (async () => { const r = (await alex.db.rpc("my_review", { p_product: PID })).data; return r?.length === 1 && r[0].title === "Even better" })() && ((await nobody.db.rpc("my_review", { p_product: PID2 })).data ?? []).length === 0)
  ok("visitors can't call my_review", !!(await fresh().rpc("my_review", { p_product: PID })).error)
  const sum = (await fresh().rpc("review_summary")).data?.find((r: { product_id: string }) => r.product_id === PID)
  ok("the summary averages published reviews ((5+2+5+5)/4 = 4.3) and counts them", sum && Number(sum.average) === 4.3 && sum.total === 4, JSON.stringify(sum))

  // ---- tampering
  ok("a customer can't change their own review directly (e.g. rating or status)", ((await alex.db.from("reviews").update({ rating: 1, status: "published" }).eq("product_id", PID).select("id")).data ?? []).length === 0 && (await svc.from("reviews").select("rating").eq("user_id", alex.id).single()).data?.rating === 5)
  ok("a customer can't insert a review directly", !!(await alex.db.from("reviews").insert({ product_id: PID2, user_id: alex.id, author: "x", rating: 5 })).error)
  ok("a customer can't edit someone else's review", (await svc.from("reviews").select("title").eq("user_id", sam.id).single()).data?.title === "Meh" && !(await alex.db.from("reviews").update({ title: "hacked" }).eq("id", (await svc.from("reviews").select("id").eq("user_id", sam.id).single()).data!.id).select("id")).data?.length)
  ok("or delete it", await (async () => { const id = (await svc.from("reviews").select("id").eq("user_id", sam.id).single()).data!.id; await alex.db.from("reviews").delete().eq("id", id); return ((await svc.from("reviews").select("id").eq("id", id)).data ?? []).length === 1 })())

  // ---- moderation
  await svc.from("reviews").update({ status: "hidden" }).eq("user_id", sam.id)
  ok("a hidden review disappears from the public list", ((await fresh().from("reviews").select("id").eq("product_id", PID)).data ?? []).length === 3)
  ok("…and from the average ((5+5+5)/3 = 5.0)", Number((await fresh().rpc("review_summary")).data?.find((r: { product_id: string }) => r.product_id === PID)?.average) === 5)
  ok("but its author still sees it", ((await sam.db.rpc("my_review", { p_product: PID })).data ?? [])[0]?.status === "hidden")
  await rev(sam.db, PID, 1, "Changed my mind")
  ok("editing a hidden review doesn't bring it back", (await svc.from("reviews").select("status, rating").eq("user_id", sam.id).single()).data?.status === "hidden")
  ok("a customer can't hide or show reviews (admin only)", await (async () => { const id = (await svc.from("reviews").select("id").eq("user_id", alex.id).single()).data!.id; await alex.db.from("reviews").update({ status: "hidden" }).eq("id", id); return (await svc.from("reviews").select("status").eq("id", id).single()).data?.status === "published" })())
  const del = await alex.db.from("reviews").delete().eq("product_id", PID).select("id")
  ok("customers can delete their own review (and only theirs)", (del.data ?? []).length === 1 && ((await svc.from("reviews").select("id").eq("product_id", PID)).data ?? []).length === 3)

  // ---- reviews go when the product does
  await svc.from("products").delete().eq("id", PID).then(() => null)
} finally {
  if (orderIds.length) {
    await svc.from("order_items").delete().in("order_id", orderIds)
    await svc.from("orders").delete().in("id", orderIds)
  }
  await svc.from("customers").delete().like("id", "C-ZZR%")
  await svc.from("products").delete().in("id", [PID, PID2])
  for (const id of userIds) await svc.auth.admin.deleteUser(id)
  const left = (await svc.auth.admin.listUsers({ perPage: 200 })).data.users.filter((u) => u.email?.startsWith("zzt-rev")).length
  const revs = (await svc.from("reviews").select("id").in("product_id", [PID, PID2])).data?.length ?? 0
  console.log(left === 0 && revs === 0 ? "cleaned up (accounts, product, orders, reviews)" : "WARNING: leftovers")
}
