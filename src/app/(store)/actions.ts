"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { sendOrderEmail, sendWelcomeEmail } from "@/lib/email/service"
import { getCatalog } from "@/lib/source"
import { DEFAULT_ZONE, quoteShipping } from "@/lib/shipping"
import { WELCOME_CODE, WELCOME_MIN, WELCOME_OFF, sizeLeft } from "@/lib/store"
import { anonClient, sessionClient } from "@/lib/supabase/clients"
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
  /** the zone that priced shipping, its delivery estimate, and the bag value where it becomes free (null = never) */
  shipZone: string
  shipEstimate: string
  freeOver: number | null
  /** set when the chosen country isn't served; the bag can't be ordered until it changes */
  shipError: string | null
  total: number
  /** gift card applied (the code as stored), what it pays, what's left on it, why it can't be used, and what the shopper still owes */
  giftCode: string | null
  giftAmount: number
  giftBalanceAfter: number | null
  giftError: string | null
  amountDue: number
}
export type QuoteResult = { ok: true; quote: Quote } | { ok: false; error: string }

export interface CheckoutInput {
  name: string
  email: string
  address: string
  city: string
  state: string
  postcode: string
  /** ISO country code, e.g. "GH" */
  country: string
  code?: string
  gift?: string
  items: BagLine[]
}
export type CheckoutResult = { ok: true; orderId: string; total: number; discount: number; saleDiscount: number; shipping: number; subtotal: number; estimate: string; giftAmount: number; amountDue: number } | { ok: false; error: string }

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
  shipZone: q.ship_zone ?? "",
  shipEstimate: q.ship_estimate ?? "",
  freeOver: q.free_over ?? null,
  shipError: q.ship_error ?? null,
  total: q.total,
  giftCode: q.gift_code ?? null,
  giftAmount: q.gift_amount ?? 0,
  giftBalanceAfter: q.gift_balance_after ?? null,
  giftError: q.gift_error ?? null,
  amountDue: q.amount_due ?? q.total,
})

/** Demo mode (no database): same shape, only the welcome code exists. */
async function demoQuote(input: { email?: string; code?: string; gift?: string; country?: string; items: BagLine[] }): Promise<QuoteResult> {
  const catalog = new Map((await getCatalog()).map((p) => [p.id, p]))
  let sub = 0
  const wanted = new Map<string, number>()
  for (const i of input.items) {
    const p = catalog.get(i.productId)
    if (!p) return { ok: false, error: "An item in your bag is no longer available." }
    const key = `${i.productId}|${i.size}`
    const q = (wanted.get(key) ?? 0) + i.qty
    wanted.set(key, q)
    const left = sizeLeft(p, i.size)
    if (left <= 0) return { ok: false, error: `${p.name} is sold out in size ${i.size}` }
    if (left < q) return { ok: false, error: `Only ${left} left of ${p.name} in size ${i.size}` }
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
  const ship = quoteShipping([DEFAULT_ZONE], input.country, sub)
  return { ok: true, quote: { listSubtotal: sub, subtotal: sub, saleDiscount: 0, discount, code: discount ? code : null, codeError, codeNote: null, freeShipping: false, shipping: ship.price, shipZone: ship.zone, shipEstimate: ship.estimate, freeOver: ship.freeOver, shipError: ship.error, total: sub - discount + ship.price, giftCode: null, giftAmount: 0, giftBalanceAfter: null, giftError: input.gift?.trim() ? "Gift cards need the live store." : null, amountDue: sub - discount + ship.price } }
}

/** The live price of a bag: sales, code, shipping and total, all decided by the database. */
export async function quoteOrder(input: { email?: string; code?: string; gift?: string; country?: string; items: BagLine[] }): Promise<QuoteResult> {
  if (input.items.length === 0) return { ok: false, error: "Your bag is empty." }
  if (!isLive) return demoQuote(input)
  const { data, error } = await anonClient().rpc("quote_order", { p_email: input.email ?? "", p_items: toItems(input.items), p_code: input.code?.trim() || null, p_country: input.country?.trim() || null, p_gift: input.gift?.trim() || null })
  if (error) return { ok: false, error: clean(error.message) }
  return { ok: true, quote: toQuote(data) }
}

/**
 * Live: place_order() prices the bag itself, locks stock and the code, and creates the order in one step.
 * Demo: same rules, but nothing is saved.
 */
export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  if (!input.name.trim() || !input.email.includes("@")) return { ok: false, error: "Enter your name and a valid email." }
  if (!input.address.trim() || !input.city.trim()) return { ok: false, error: "Enter your delivery address and city." }
  if (!/^[A-Za-z]{2}$/.test(input.country)) return { ok: false, error: "Choose your country." }
  if (input.items.length === 0) return { ok: false, error: "Your bag is empty." }
  const code = input.code?.trim().toUpperCase() || null

  if (isLive) {
    // signed in: place the order as that customer (it then shows in their account); otherwise as a guest
    const session = await sessionClient()
    const db = (await session.auth.getUser()).data.user ? session : anonClient()
    const { data, error } = await db.rpc("place_order", {
      p_name: input.name,
      p_email: input.email,
      p_city: input.city || null,
      p_state: input.state || null,
      p_items: toItems(input.items),
      p_code: code,
      p_country: input.country.toUpperCase(),
      p_address: input.address,
      p_postcode: input.postcode,
      p_gift: input.gift?.trim() || null,
    })
    if (error) return { ok: false, error: clean(error.message) }
    const r = Array.isArray(data) ? data[0] : data
    revalidatePath("/", "layout")
    after(() => sendOrderEmail(r.order_id, "order_confirmation"))
    return { ok: true, orderId: r.order_id, total: r.order_total, discount: r.applied_discount ?? 0, saleDiscount: r.sale_discount ?? 0, shipping: r.shipping ?? 0, subtotal: r.subtotal ?? 0, estimate: r.ship_estimate ?? "", giftAmount: r.gift_amount ?? 0, amountDue: r.amount_due ?? r.order_total }
  }

  const q = await demoQuote({ email: input.email, code: input.code, gift: input.gift, country: input.country, items: input.items })
  if (q.ok && q.quote.giftError) return { ok: false, error: q.quote.giftError }
  if (!q.ok) return q
  if (code && q.quote.codeError) return { ok: false, error: q.quote.codeError }
  if (q.quote.shipError) return { ok: false, error: q.quote.shipError }
  return { ok: true, orderId: `G4-DEMO-${Math.floor(1000 + Math.random() * 8999)}`, total: q.quote.total, discount: q.quote.discount, saleDiscount: 0, shipping: q.quote.shipping, subtotal: q.quote.subtotal, estimate: q.quote.shipEstimate, giftAmount: 0, amountDue: q.quote.total }
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
