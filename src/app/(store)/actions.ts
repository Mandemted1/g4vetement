"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { sendOrderEmail, sendWelcomeEmail } from "@/lib/email/service"
import { getCatalog } from "@/lib/source"
import { FREE_SHIPPING_AT, SHIPPING, WELCOME_CODE, WELCOME_MIN, WELCOME_OFF } from "@/lib/store"
import { anonClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

export interface CheckoutInput {
  name: string
  email: string
  city: string
  state: string
  code?: string
  items: { productId: string; size: string; color: string; qty: number }[]
}
export type CheckoutResult = { ok: true; orderId: string; total: number; discount: number } | { ok: false; error: string }

const clean = (e: string) => e.replace(/^.*?ERROR:\s*/, "").slice(0, 160)

/**
 * Live: the database function place_order() locks stock, prices the bag itself and creates the order.
 * Demo: same rules, but nothing is saved.
 */
export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  if (!input.name.trim() || !input.email.includes("@")) return { ok: false, error: "Enter your name and a valid email." }
  if (input.items.length === 0) return { ok: false, error: "Your bag is empty." }
  const code = input.code?.trim().toUpperCase() || null

  if (isLive) {
    const db = anonClient()
    const args = {
      p_name: input.name,
      p_email: input.email,
      p_city: input.city || null,
      p_state: input.state || null,
      p_items: input.items.map((i) => ({ product_id: i.productId, size: i.size, color: i.color, qty: i.qty })),
    }
    let res = await db.rpc("place_order", { ...args, p_code: code })
    // Database not upgraded yet (v1 has no discount code): still let people check out when no code is used.
    if (res.error?.code === "PGRST202" && !code) res = await db.rpc("place_order", args)
    if (res.error?.code === "PGRST202") return { ok: false, error: "Discount codes aren't available yet. Remove the code to continue." }
    if (res.error) return { ok: false, error: clean(res.error.message) }
    const r = Array.isArray(res.data) ? res.data[0] : res.data
    revalidatePath("/", "layout")
    after(() => sendOrderEmail(r.order_id, "order_confirmation"))
    return { ok: true, orderId: r.order_id, total: r.order_total, discount: r.applied_discount ?? 0 }
  }

  const catalog = new Map((await getCatalog()).map((p) => [p.id, p]))
  let sub = 0
  for (const i of input.items) {
    const p = catalog.get(i.productId)
    if (!p || p.stock < i.qty) return { ok: false, error: `${p?.name ?? "An item"} is no longer available in that quantity.` }
    sub += p.price * i.qty
  }
  let discount = 0
  if (code) {
    if (code !== WELCOME_CODE || sub < WELCOME_MIN) return { ok: false, error: `${WELCOME_CODE} needs a $${WELCOME_MIN}+ bag.` }
    discount = WELCOME_OFF
  }
  const total = sub - discount + (sub >= FREE_SHIPPING_AT ? 0 : SHIPPING)
  return { ok: true, orderId: `G4-DEMO-${Math.floor(1000 + Math.random() * 8999)}`, total, discount }
}

export async function subscribe(email: string, source = "footer"): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: "Enter a valid email." }
  if (!isLive) return { ok: true }
  const db = anonClient()
  let { error } = await db.from("subscribers").insert({ email: e, source })
  // columns from the newer migration may not exist yet: retry with the basic row
  if (error && error.code !== "23505" && /column|schema cache/i.test(error.message)) ({ error } = await db.from("subscribers").insert({ email: e }))
  if (error && error.code === "23505") return { ok: true } // already on the list
  if (error) return { ok: false, error: "Couldn't save that, try again." }
  after(() => sendWelcomeEmail(e))
  return { ok: true }
}
