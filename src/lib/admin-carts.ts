import "server-only"
import { adminClient } from "@/lib/admin-auth"
import { getCatalog } from "@/lib/source"
import { isLive } from "@/lib/supabase/env"
import { unitPrice } from "@/lib/store"
import type { AdminCart } from "@/lib/email/abandoned"

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CartsData {
  carts: AdminCart[]
  optOuts: number
  missing: boolean
  demo: boolean
}

/** Saved bags for the admin: who left what, and what happened to it. */
export async function getAbandonedCarts(): Promise<CartsData> {
  if (!isLive) return { carts: [], optOuts: 0, missing: false, demo: true }
  const db = await adminClient()
  if (!db) return { carts: [], optOuts: 0, missing: false, demo: false }
  const [carts, outs] = await Promise.all([
    db.from("abandoned_carts").select("id, email, items, subtotal, updated_at, reminder_sent_at, recovered_at").order("updated_at", { ascending: false }).limit(500),
    db.from("cart_reminder_optouts").select("email", { count: "exact", head: true }),
  ])
  if (carts.error) return { carts: [], optOuts: 0, missing: true, demo: false }
  const catalog = new Map((await getCatalog()).map((p) => [p.id, p]))
  return {
    missing: false,
    demo: false,
    optOuts: outs.count ?? 0,
    carts: (carts.data as any[]).map((c) => ({
      id: c.id,
      email: c.email,
      items: ((c.items ?? []) as any[]).map((i) => ({ name: catalog.get(i.productId)?.name ?? i.productId, size: i.size, color: i.color, qty: i.qty })),
      // today's value of what's still sold; falls back to what was saved
      subtotal: ((c.items ?? []) as any[]).reduce((n, i) => n + (catalog.has(i.productId) ? unitPrice(catalog.get(i.productId)!) * i.qty : 0), 0) || c.subtotal,
      updatedAt: c.updated_at,
      reminderSentAt: c.reminder_sent_at,
      recoveredAt: c.recovered_at,
    })),
  }
}
