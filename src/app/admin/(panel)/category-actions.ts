"use server"

import { revalidatePath } from "next/cache"
import { adminClient } from "@/lib/admin-auth"
import { isCategoryDepartment, type CategoryDepartment } from "@/lib/departments"
import { isLive } from "@/lib/supabase/env"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const DEMO = { ok: false as const, error: "Demo mode: connect Supabase to manage categories." }

const admin = adminClient
const refresh = () => {
  revalidatePath("/", "layout")
}
const friendly = (e: { message: string; code?: string }) => {
  if (e.code === "23505" || /already exists/i.test(e.message)) return "A category with that name already exists."
  if (/does not exist|schema cache/i.test(e.message)) return "Categories aren't installed yet. Run `npm run migrate` first."
  return e.message.replace(/^.*?ERROR:\s*/, "")
}
const cleanName = (n: string) => n.trim().replace(/\s+/g, " ")

export async function createCategory(name: string, description = "", department: CategoryDepartment = "both"): Promise<Result<{ id: string; name: string }>> {
  if (!isLive) return DEMO
  const db = await admin()
  if (!db) return { ok: false, error: "Please sign in again." }
  const n = cleanName(name)
  if (!n || n.length > 40) return { ok: false, error: "Category names must be 1 to 40 characters." }
  if (!isCategoryDepartment(department)) return { ok: false, error: "Choose Men, Women or both." }
  const { data: last } = await db.from("categories").select("sort").order("sort", { ascending: false }).limit(1)
  const sort = (last?.[0]?.sort ?? 0) + 1
  const { data, error } = await db.from("categories").insert({ name: n, description: description.trim().slice(0, 200), department, sort }).select("id, name").single()
  if (error || !data) return { ok: false, error: friendly(error ?? { message: "Couldn't save" }) }
  refresh()
  return { ok: true, id: data.id, name: data.name }
}

export async function updateCategory(id: string, v: { name: string; description: string; active: boolean; department: CategoryDepartment }): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin()
  if (!db) return { ok: false, error: "Please sign in again." }
  const n = cleanName(v.name)
  if (!n || n.length > 40) return { ok: false, error: "Category names must be 1 to 40 characters." }
  if (!isCategoryDepartment(v.department)) return { ok: false, error: "Choose Men, Women or both." }
  const { data: cur } = await db.from("categories").select("name").eq("id", id).single()
  if (!cur) return { ok: false, error: "Category not found." }
  if (cur.name !== n) {
    // renames products too, in one transaction
    const { error } = await db.rpc("rename_category", { p_id: id, p_name: n })
    if (error) return { ok: false, error: friendly(error) }
  }
  const { error } = await db.from("categories").update({ description: v.description.trim().slice(0, 200), active: v.active, department: v.department }).eq("id", id)
  if (error) return { ok: false, error: friendly(error) }
  refresh()
  return { ok: true }
}

/** Swaps a category with its neighbour in the list. */
export async function moveCategory(id: string, dir: "up" | "down"): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin()
  if (!db) return { ok: false, error: "Please sign in again." }
  const { data: all, error } = await db.from("categories").select("id, sort").order("sort").order("name")
  if (error || !all) return { ok: false, error: friendly(error ?? { message: "Couldn't load" }) }
  const i = all.findIndex((c) => c.id === id)
  const j = dir === "up" ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= all.length) return { ok: true }
  const order = all.map((c) => c.id)
  ;[order[i], order[j]] = [order[j], order[i]]
  // renumber 1..n so the order is always unambiguous
  for (let n = 0; n < order.length; n++) {
    const cur = all.find((c) => c.id === order[n])!
    if (cur.sort !== n + 1) {
      const { error: e } = await db.from("categories").update({ sort: n + 1 }).eq("id", order[n])
      if (e) return { ok: false, error: friendly(e) }
    }
  }
  refresh()
  return { ok: true }
}

export async function deleteCategory(id: string, moveTo?: string): Promise<Result<{ moved: number }>> {
  if (!isLive) return DEMO
  const db = await admin()
  if (!db) return { ok: false, error: "Please sign in again." }
  const { data, error } = await db.rpc("delete_category", { p_id: id, p_move_to: moveTo ?? null })
  if (error) return { ok: false, error: friendly(error) }
  refresh()
  return { ok: true, moved: Number(data ?? 0) }
}
