"use server"

import { revalidatePath } from "next/cache"
import { adminClient, noAccess } from "@/lib/admin-auth"
import { productRow } from "@/lib/product-input"
import { nextProductIds } from "@/lib/product-input"
import { planProductImport, type ExistingProduct, type ImportPlan } from "@/lib/product-import"
import { toCategory, toProduct } from "@/lib/source"
import { isLive } from "@/lib/supabase/env"

const MAX_BYTES = 1_000_000
type Db = NonNullable<Awaited<ReturnType<typeof adminClient>>>

async function load(db: Db) {
  const [{ data: prods, error: e1 }, { data: cats, error: e2 }] = await Promise.all([db.from("products").select("*").order("sort"), db.from("categories").select("*")])
  if (e1 || e2) throw new Error((e1 ?? e2)!.message)
  const existing: ExistingProduct[] = (prods ?? []).map(toProduct)
  return { existing, categories: (cats ?? []).map(toCategory), rows: prods ?? [] }
}

const tooBig = (csv: string) => (typeof csv !== "string" || csv.length > MAX_BYTES ? "That file is too big. Import up to 1 MB (about 500 products) at a time." : "")

/** Checks a file and says what importing it would do. Saves nothing. */
export async function previewProductImport(csv: string): Promise<{ ok: true; plan: ImportPlan } | { ok: false; error: string }> {
  if (!isLive) return { ok: false, error: "Demo mode: connect Supabase to import products." }
  const db = await adminClient("products.manage")
  if (!db) return { ok: false, error: await noAccess("products.manage") }
  const big = tooBig(csv)
  if (big) return { ok: false, error: big }
  try {
    const { existing, categories } = await load(db)
    return { ok: true, plan: planProductImport(csv, existing, categories) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't read the products." }
  }
}

/** Plans the file again against today's products, and saves it only if it has no errors. */
export async function applyProductImport(csv: string): Promise<{ ok: true; created: number; updated: number; unchanged: number; categories: number } | { ok: false; error: string }> {
  if (!isLive) return { ok: false, error: "Demo mode: connect Supabase to import products." }
  const db = await adminClient("products.manage")
  if (!db) return { ok: false, error: await noAccess("products.manage") }
  const big = tooBig(csv)
  if (big) return { ok: false, error: big }
  try {
    const { existing, categories, rows } = await load(db)
    const plan = planProductImport(csv, existing, categories)
    if (plan.fatal) return { ok: false, error: plan.fatal }
    if (plan.errors.length) return { ok: false, error: `The file has ${plan.errors.length} problem${plan.errors.length === 1 ? "" : "s"}. Nothing was saved.` }

    // categories first
    if (plan.newCategories.length) {
      const { data: last } = await db.from("categories").select("sort").order("sort", { ascending: false }).limit(1)
      let sort = (last?.[0]?.sort ?? 0) + 1
      const { error } = await db.from("categories").insert(plan.newCategories.map((c) => ({ name: c.name, description: "", department: c.department, sort: sort++ })))
      if (error) return { ok: false, error: `Couldn't add the new categories: ${error.message}` }
    }

    const creates = plan.rows.filter((r) => r.action === "create")
    if (creates.length) {
      const ids = nextProductIds(rows.map((r) => r.id), rows.map((r) => r.sort ?? 0), creates.map((r) => r.input.category))
      const inserts = creates.map((r, i) => ({ id: ids[i].id, sku: r.sku ?? ids[i].sku, sort: ids[i].sort, ...productRow(r.input) }))
      const { error } = await db.from("products").insert(inserts)
      if (error) return { ok: false, error: `Couldn't add the new products: ${error.message}` }
    }
    let updated = 0
    for (const r of plan.rows.filter((x) => x.action === "update")) {
      const { error } = await db.from("products").update(productRow(r.input)).eq("id", r.id!)
      if (error) return { ok: false, error: `Saved ${updated} update${updated === 1 ? "" : "s"}, then failed on line ${r.line} (${r.name}): ${error.message}. Fix it and import again: the rows already saved will show as unchanged.` }
      updated++
    }
    revalidatePath("/", "layout")
    return { ok: true, created: creates.length, updated, unchanged: plan.counts.unchanged, categories: plan.newCategories.length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import failed." }
  }
}
