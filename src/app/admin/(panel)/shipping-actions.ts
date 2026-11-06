"use server"

import { revalidatePath } from "next/cache"
import { cleanZone, type ZoneInput } from "@/lib/shipping"
import { toZone } from "@/lib/shipping-source"
import { adminClient } from "@/lib/admin-auth"
import { isLive } from "@/lib/supabase/env"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const DEMO = { ok: false as const, error: "Demo mode: connect Supabase to manage shipping." }

const admin = adminClient
const refresh = () => revalidatePath("/", "layout")
const friendly = (e: { message: string }) =>
  /does not exist|schema cache/i.test(e.message) ? "Shipping isn't installed yet. Run `npm run migrate` first." : e.message.replace(/^.*?ERROR:\s*/, "")

const row = (z: ZoneInput) => ({ name: z.name, countries: z.countries, rate: z.rate, free_over: z.freeOver, estimate: z.estimate, active: z.active })

/** Every zone except `id`, so the form can refuse a country that's already taken. */
async function others(db: NonNullable<Awaited<ReturnType<typeof admin>>>, id: string | null) {
  const { data, error } = await db.from("shipping_zones").select("*")
  if (error) return { error }
  return { zones: (data ?? []).map(toZone).filter((z) => z.id !== id) }
}

/** Creates a zone (id = null) or updates one. */
export async function saveZone(id: string | null, input: ZoneInput): Promise<Result<{ id: string }>> {
  if (!isLive) return DEMO
  const db = await admin()
  if (!db) return { ok: false, error: "Please sign in again." }
  const o = await others(db, id)
  if ("error" in o && o.error) return { ok: false, error: friendly(o.error) }
  const c = cleanZone(input, o.zones ?? [])
  if (!c.ok) return c
  if (id) {
    const { error } = await db.from("shipping_zones").update(row(c.value)).eq("id", id)
    if (error) return { ok: false, error: friendly(error) }
    refresh()
    return { ok: true, id }
  }
  const { data: last } = await db.from("shipping_zones").select("sort").order("sort", { ascending: false }).limit(1)
  const sort = (last?.[0]?.sort ?? 0) + 1
  const { data, error } = await db.from("shipping_zones").insert({ ...row(c.value), sort }).select("id").single()
  if (error || !data) return { ok: false, error: friendly(error ?? { message: "Couldn't save" }) }
  refresh()
  return { ok: true, id: data.id }
}

export async function setZoneActive(id: string, active: boolean): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin()
  if (!db) return { ok: false, error: "Please sign in again." }
  const { error } = await db.from("shipping_zones").update({ active }).eq("id", id)
  if (error) return { ok: false, error: friendly(error) }
  refresh()
  return { ok: true }
}

export async function deleteZone(id: string): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin()
  if (!db) return { ok: false, error: "Please sign in again." }
  const { error } = await db.from("shipping_zones").delete().eq("id", id)
  if (error) return { ok: false, error: friendly(error) }
  refresh()
  return { ok: true }
}
