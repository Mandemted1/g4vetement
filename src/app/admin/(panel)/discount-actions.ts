"use server"

import { revalidatePath } from "next/cache"
import { cleanCode, cleanSale, type CodeInput, type SaleInput } from "@/lib/discount-validate"
import { adminClient, noAccess } from "@/lib/admin-auth"
import { isLive } from "@/lib/supabase/env"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const DEMO = { ok: false as const, error: "Demo mode: connect Supabase to manage discounts." }

const admin = adminClient
const refresh = () => {
  revalidatePath("/", "layout")
}
const friendly = (e: { message: string; code?: string }) => {
  if (e.code === "23505") return "A code with that name already exists."
  if (/does not exist|schema cache/i.test(e.message)) return "Discounts aren't installed yet. Run `npm run migrate` first."
  return e.message.replace(/^.*?ERROR:\s*/, "")
}
const codeRow = (c: CodeInput) => ({
  code: c.code, kind: c.kind, value: c.value, min_spend: c.minSpend, categories: c.categories, starts_at: c.startsAt, ends_at: c.endsAt,
  usage_limit: c.usageLimit, once_per_customer: c.oncePerCustomer, first_order_only: c.firstOrderOnly, active: c.active, note: c.note,
})
const saleRow = (s: SaleInput) => ({ name: s.name, percent: s.percent, scope: s.scope, categories: s.categories, product_ids: s.productIds, starts_at: s.startsAt, ends_at: s.endsAt, active: s.active })

export async function createCode(input: CodeInput): Promise<Result<{ id: string }>> {
  if (!isLive) return DEMO
  const db = await admin("marketing.manage")
  if (!db) return { ok: false, error: await noAccess("marketing.manage") }
  const c = cleanCode(input)
  if (!c.ok) return c
  const { data, error } = await db.from("discount_codes").insert(codeRow(c.value)).select("id").single()
  if (error || !data) return { ok: false, error: friendly(error ?? { message: "Couldn't save" }) }
  refresh()
  return { ok: true, id: data.id }
}

export async function updateCode(id: string, input: CodeInput): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("marketing.manage")
  if (!db) return { ok: false, error: await noAccess("marketing.manage") }
  const c = cleanCode(input)
  if (!c.ok) return c
  const { error } = await db.from("discount_codes").update(codeRow(c.value)).eq("id", id)
  if (error) return { ok: false, error: friendly(error) }
  refresh()
  return { ok: true }
}

export async function setCodeActive(id: string, active: boolean): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("marketing.manage")
  if (!db) return { ok: false, error: await noAccess("marketing.manage") }
  const { error } = await db.from("discount_codes").update({ active }).eq("id", id)
  if (error) return { ok: false, error: friendly(error) }
  refresh()
  return { ok: true }
}

/** A code that has been used keeps its history: switch it off instead of deleting. */
export async function deleteCode(id: string): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("marketing.manage")
  if (!db) return { ok: false, error: await noAccess("marketing.manage") }
  const { data: row } = await db.from("discount_codes").select("code").eq("id", id).single()
  if (!row) return { ok: false, error: "Code not found." }
  const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("discount_code", row.code)
  if (count) return { ok: false, error: `${row.code} was used on ${count} order${count === 1 ? "" : "s"}. Switch it off instead so the history stays.` }
  const { error } = await db.from("discount_codes").delete().eq("id", id)
  if (error) return { ok: false, error: friendly(error) }
  refresh()
  return { ok: true }
}

export async function createSale(input: SaleInput): Promise<Result<{ id: string }>> {
  if (!isLive) return DEMO
  const db = await admin("marketing.manage")
  if (!db) return { ok: false, error: await noAccess("marketing.manage") }
  const s = cleanSale(input)
  if (!s.ok) return s
  const { data, error } = await db.from("sales").insert(saleRow(s.value)).select("id").single()
  if (error || !data) return { ok: false, error: friendly(error ?? { message: "Couldn't save" }) }
  refresh()
  return { ok: true, id: data.id }
}

export async function updateSale(id: string, input: SaleInput): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("marketing.manage")
  if (!db) return { ok: false, error: await noAccess("marketing.manage") }
  const s = cleanSale(input)
  if (!s.ok) return s
  const { error } = await db.from("sales").update(saleRow(s.value)).eq("id", id)
  if (error) return { ok: false, error: friendly(error) }
  refresh()
  return { ok: true }
}

export async function setSaleActive(id: string, active: boolean): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("marketing.manage")
  if (!db) return { ok: false, error: await noAccess("marketing.manage") }
  const { error } = await db.from("sales").update({ active }).eq("id", id)
  if (error) return { ok: false, error: friendly(error) }
  refresh()
  return { ok: true }
}

/** Past orders keep the sale price they were charged, so deleting a sale never changes history. */
export async function deleteSale(id: string): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("marketing.manage")
  if (!db) return { ok: false, error: await noAccess("marketing.manage") }
  const { error } = await db.from("sales").delete().eq("id", id)
  if (error) return { ok: false, error: friendly(error) }
  refresh()
  return { ok: true }
}
