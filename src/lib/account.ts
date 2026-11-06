import "server-only"
import { sessionClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"
import type { Order } from "./data"
import { cleanAddress, type AccountInfo } from "./account-types"
import { toOrder } from "./source"

export type { AccountInfo } from "./account-types"

/** The signed-in customer, or null (also null in demo mode, where accounts don't exist). */
export async function getAccount(): Promise<AccountInfo | null> {
  if (!isLive) return null
  const { data } = await (await sessionClient()).auth.getUser()
  const u = data.user
  if (!u) return null
  const m = (u.user_metadata ?? {}) as Record<string, unknown>
  return { id: u.id, email: u.email ?? "", name: typeof m.full_name === "string" ? m.full_name : "", address: cleanAddress(m.address) }
}

/** This customer's orders, newest first. */
export async function getMyOrders(userId: string): Promise<Order[]> {
  const db = await sessionClient()
  const { data } = await db.from("orders").select("*, order_items(*)").eq("user_id", userId).order("created_at", { ascending: false }).limit(200)
  return (data ?? []).map(toOrder)
}

export async function getMyOrder(userId: string, id: string): Promise<Order | null> {
  const db = await sessionClient()
  const { data } = await db.from("orders").select("*, order_items(*)").eq("user_id", userId).eq("id", id).maybeSingle()
  return data ? toOrder(data) : null
}
