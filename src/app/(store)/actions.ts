"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { sendOrderEmail, sendWelcomeEmail } from "@/lib/email/service"
import { getCatalog } from "@/lib/source"
import { FREE_SHIPPING_AT, SHIPPING, WELCOME_CODE, WELCOME_MIN, WELCOME_OFF } from "@/lib/store"
import { anonClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

export interface BagLine {
  productId: string
  size: string
  color: string
  qty: number
}

export interface Quote {
  /** sum of list prices */
  listSubtotal: number
  /** what the items cost after any sale */
  subtotal: number
  saleDiscount: number
  discount: number
  /** the code that was applied, if it was valid */
  code: string | null
  /** why the typed code can't be used (the bag is still priced without it) */
  codeError: string | null
  codeNote: string | null
  freeShipping: boolean
  shipping: number
  total: number
}
export type QuoteResult = { ok: true; quote: Quote } | { ok: false; error: string }

export interface CheckoutInput {
  name: string
  email: string
  city: string
  state: string
  code?: string
  items: BagLine[]
}
export type CheckoutResult = { ok: true; orderId: string; total: number; discount: number; saleDiscount: number; shipping: number; subtotal: number } | { ok: false; error: string }

const clean = (e: string) => e.replace(/^.*?ERROR:\s*/, "").slice(0, 200)
const toItems = (items: BagLine[]) => items.map((i) => ({ product_id: i.productId, size: i.size, color: i.color, qty: i.qty }))

/* eslint-disable @typescript-eslint/no-explicit-any */
const toQuote = (q: any): Quote => ({
  listSubtotal: q.list_subtotal,
  subtotal: q.subtotal,
  saleDiscount: q.sale_discount,
  discount: q.discount,
  code: q.code ?? null,
  codeError: q.code_error ?? null,
  codeNote: q.code_note ?? null,
  freeShipping: Boolean(q.free_shipping),
  shipping: q.shipping,
  total: q.total,
})

/** Demo mode (no database): same shape, only the welcome code exists. */
async function demoQuote(input: { email?: string; code?: string; items: BagLine[] }): Promise<QuoteResult> {
  const catalog = new Map((await getCatalog()).map((p) => [p.id, p]))
  let sub = 0
  for (const i of input.items) {
    const p = catalog.get(i.productId)
    if (!p || p.stock < i.qty) return { ok: false, error: `${p?.name ?? "An item"} is no longer available in that quantity.` }
    sub += p.price * i.qty
  }
  const code = input.code?.trim().toUpperCase() || null
  let discount = 0
  let codeError: string | null = null
  if (code) {
    if (code !== WELCOME_CODE) codeError = "That code is not valid"
    else if (sub < WELCOME_MIN) codeError = `This code needs a bag of at least $${WELCOME_MIN} (yours is $${sub})`
    else discount = WELCOME_OFF
  }
  const shipping = sub >= FREE_SHIPPING_AT ? 0 : SHIPPING
  return { ok: true, quote: { listSubtotal: sub, subtotal: sub, saleDiscount: 0, discount, code: discount ? code : null, codeError, codeNote: null, freeShipping: false, shipping, total: sub - discount + shipping } }
}

/** The live price of a bag: sales, code, shipping and total, all decided by the database. */
export async function quoteOrder(input: { email?: string; code?: string; items: BagLine[] }): Promise<QuoteResult> {
  if (input.items.length === 0) return { ok: false, error: "Your bag is empty." }
  if (!isLive) return demoQuote(input)
  const { data, error } = await anonClient().rpc("quote_order", { p_email: input.email ?? "", p_items: toItems(input.items), p_code: input.code?.trim() || null })
  if (error) return { ok: false, error: clean(error.message) }
  return { ok: true, quote: toQuote(data) }
}

/**
 * Live: place_order() prices the bag itself, locks stock and the code, and creates the order in one step.
 * Demo: same rules, but nothing is saved.
 */
export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  if (!input.name.trim() || !input.email.includes("@")) return { ok: false, error: "Enter your name and a valid email." }
  if (input.items.length === 0) return { ok: false, error: "Your bag is empty." }
  const code = input.code?.trim().toUpperCase() || null

  if (isLive) {
    const { data, error } = await anonClient().rpc("place_order", {
      p_name: input.name,
      p_email: input.email,
      p_city: input.city || null,
      p_state: input.state || null,
      p_items: toItems(input.items),
      p_code: code,
    })
    if (error) return { ok: false, error: clean(error.message) }
    const r = Array.isArray(data) ? data[0] : data
    revalidatePath("/", "layout")
    after(() => sendOrderEmail(r.order_id, "order_confirmation"))
    return { ok: true, orderId: r.order_id, total: r.order_total, discount: r.applied_discount ?? 0, saleDiscount: r.sale_discount ?? 0, shipping: r.shipping ?? 0, subtotal: r.subtotal ?? 0 }
  }

  const q = await demoQuote({ email: input.email, code: input.code, items: input.items })
  if (!q.ok) return q
  if (code && q.quote.codeError) return { ok: false, error: q.quote.codeError }
  return { ok: true, orderId: `G4-DEMO-${Math.floor(1000 + Math.random() * 8999)}`, total: q.quote.total, discount: q.quote.discount, saleDiscount: 0, shipping: q.quote.shipping, subtotal: q.quote.subtotal }
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
