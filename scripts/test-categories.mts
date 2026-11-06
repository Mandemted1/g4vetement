/**
 * End-to-end check of category management against your database and the running storefront.
 *   npm run test-categories      (needs `npm run dev` on port 3100)
 * Uses a throwaway category and restores everything afterwards.
 */
import { createClient } from "@supabase/supabase-js"

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}
/** The category tabs exactly as a shopper sees them, in order (without "All"). */
const shopTabs = async () => {
  const html = await (await fetch("http://localhost:3100/shop", { cache: "no-store" })).text()
  return [...html.matchAll(/data-cursor="FILTER"[^>]*><span[^>]*>([^<]*)<!-- -->/g)]
    .map((m) => m[1].replace(/&amp;/g, "&").trim())
    .filter((n) => n !== "All")
}

const original = (await db.from("categories").select("id, name, sort, active").order("sort")).data!
// the storefront only lists categories that have a visible product, so only those are expected there
const used = new Set(((await db.from("products").select("category").eq("active", true)).data ?? []).map((p) => p.category as string))
const shown = original.filter((c) => used.has(c.name))
const p01 = (await db.from("products").select("category").eq("id", "p01").single()).data!.category as string
const TMP = "ZZ Test Category"
const TMP2 = "ZZ Renamed"

try {
  const ins = await db.from("categories").insert({ name: TMP, sort: 99 }).select("id").single()
  ok("create a category", !ins.error && Boolean(ins.data), ins.error?.message)
  const id = ins.data!.id as string

  const dup = await db.from("categories").insert({ name: TMP.toLowerCase(), sort: 100 })
  ok("duplicate names are refused (case-insensitive)", Boolean(dup.error))

  await db.from("products").update({ category: TMP }).eq("id", "p01")
  const ren = await db.rpc("rename_category", { p_id: id, p_name: TMP2 })
  const after = (await db.from("products").select("category").eq("id", "p01").single()).data!.category
  ok("rename carries its products along", !ren.error && after === TMP2, `p01 is now in "${after}"`)

  const clash = await db.rpc("rename_category", { p_id: id, p_name: "tees" })
  ok("renaming onto an existing name is refused", Boolean(clash.error), clash.error?.message?.replace(/^.*?ERROR:\s*/, ""))

  const refuse = await db.rpc("delete_category", { p_id: id, p_move_to: null })
  ok("delete refuses when products would be orphaned", Boolean(refuse.error), refuse.error?.message)

  const del = await db.rpc("delete_category", { p_id: id, p_move_to: "Tees" })
  const moved = (await db.from("products").select("category").eq("id", "p01").single()).data!.category
  ok("delete + move products elsewhere", !del.error && del.data === 1 && moved === "Tees", `moved ${del.data}, p01 -> ${moved}`)
  const gone = await db.from("categories").select("id").eq("id", id)
  ok("category is gone", (gone.data ?? []).length === 0)

  // storefront reflects order + visibility
  const base = await shopTabs()
  ok("storefront shows every category that has products", shown.every((c) => base.includes(c.name)) && !base.some((n) => !used.has(n)), base.join(" > "))
  const last = shown[shown.length - 1]
  await db.from("categories").update({ sort: 0 }).eq("id", last.id)
  const reordered = await shopTabs()
  ok("reordering changes the storefront order", reordered[0] === last.name, reordered.join(" > "))
  await db.from("categories").update({ active: false }).eq("id", shown[0].id)
  const hidden = await shopTabs()
  ok("hiding a category removes it from the storefront", !hidden.includes(shown[0].name), hidden.join(" > "))
} finally {
  // restore exactly what was there
  await db.from("categories").delete().in("name", [TMP, TMP2])
  for (const c of original) await db.from("categories").update({ sort: c.sort, active: c.active, name: c.name }).eq("id", c.id)
  await db.from("products").update({ category: p01 }).eq("id", "p01")
  const back = (await db.from("categories").select("name, sort, active").order("sort")).data!
  ok("everything restored", back.length === original.length && back.every((c, i) => c.name === original[i].name && c.active === original[i].active), back.map((c) => c.name).join(", "))
}
