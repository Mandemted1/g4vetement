import "server-only"
import { REMINDER_AFTER_HOURS, REMINDER_MAX_AGE_DAYS, cleanCartItems, normalizeEmail, reminderDue, validEmail, type CartItem, type DueReason } from "@/lib/alerts"
import { getAlertSettings } from "@/lib/settings"
import { getCatalog } from "@/lib/source"
import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"
import { sizeLeft } from "@/lib/stock"
import { unitPrice } from "@/lib/store"
import { renderEmail, type OrderLine } from "./render"
import { emailConfigured, sendEmail, storeUrl, type OutgoingEmail, type SendResult } from "./send"
import { brandInfo, loadTemplate, log } from "./service"

/* eslint-disable @typescript-eslint/no-explicit-any */

const UUID = /^[0-9a-f-]{36}$/i
const HOUR = 3_600_000
const DAY = 24 * HOUR

/**
 * Remembers a shopper's bag once they've typed their email at checkout (only when the owner has turned reminders on).
 * One row per email; typing again refreshes it. Prices are worked out here from the live catalog, never taken from the browser.
 */
export async function captureCart(input: { email: unknown; items: unknown; country?: unknown }): Promise<{ ok: boolean; skipped?: string }> {
  if (!isLive) return { ok: true, skipped: "demo" }
  const email = normalizeEmail(String(input.email ?? ""))
  const items = cleanCartItems(input.items)
  if (!validEmail(email) || !items) return { ok: false, skipped: "invalid" }
  if (!(await getAlertSettings()).abandonedCart) return { ok: true, skipped: "off" }

  const db = serviceClient()
  const { data: out } = await db.from("cart_reminder_optouts").select("email").eq("email", email).maybeSingle()
  if (out) return { ok: true, skipped: "opted_out" }

  // keep only lines for products that exist, and price them from the catalog
  const catalog = new Map((await getCatalog()).map((p) => [p.id, p]))
  const valid = items.filter((i) => catalog.has(i.productId) && catalog.get(i.productId)!.sizes.includes(i.size))
  if (valid.length === 0) return { ok: true, skipped: "nothing_valid" }
  const subtotal = valid.reduce((n, i) => n + unitPrice(catalog.get(i.productId)!) * i.qty, 0)
  const country = typeof input.country === "string" && /^[A-Za-z]{2}$/.test(input.country) ? input.country.toUpperCase() : null

  const { error } = await db.from("abandoned_carts").upsert({ email, items: valid, subtotal, country, updated_at: new Date().toISOString(), recovered_at: null }, { onConflict: "email" })
  return error ? { ok: false, skipped: "error" } : { ok: true }
}

/** They ordered after all: stop treating the bag as abandoned. */
export async function markCartRecovered(email: string): Promise<void> {
  if (!isLive) return
  try {
    await serviceClient().from("abandoned_carts").update({ recovered_at: new Date().toISOString() }).eq("email", normalizeEmail(email)).is("recovered_at", null)
  } catch {
    /* never affects the order */
  }
}

/** The bag behind a "return to your bag" link (lines only; prices are re-read from the catalog by the page). */
export async function getCartByToken(token: string): Promise<{ items: CartItem[]; email: string } | null> {
  if (!isLive || !UUID.test(token)) return null
  const { data } = await serviceClient().from("abandoned_carts").select("email, items").eq("token", token).maybeSingle()
  const items = data ? cleanCartItems(data.items) : null
  return data && items ? { items, email: data.email } : null
}

/** "Stop reminding me": remember the address and delete the stored bag. */
export async function optOutByToken(token: string): Promise<{ ok: boolean; email?: string }> {
  if (!isLive || !UUID.test(token)) return { ok: false }
  const db = serviceClient()
  const { data } = await db.from("abandoned_carts").select("email").eq("token", token).maybeSingle()
  if (!data) return { ok: false }
  await db.from("cart_reminder_optouts").upsert({ email: data.email }, { onConflict: "email" })
  await db.from("abandoned_carts").delete().eq("token", token)
  return { ok: true, email: data.email }
}

export interface ReminderRun {
  skipped?: string
  considered: number
  sent: number
  failed: number
  notDue: Partial<Record<DueReason | "unavailable", number>>
}

/**
 * Emails the one reminder to every bag that is due (see reminderDue). Run by the daily scheduled job. `send` and `now`
 * are injectable for tests. Failures are left to retry on the next run (bags expire after a week).
 */
export async function processAbandonedCarts(opts: { now?: number; send?: (e: OutgoingEmail) => Promise<SendResult>; limit?: number } = {}): Promise<ReminderRun> {
  const run: ReminderRun = { considered: 0, sent: 0, failed: 0, notDue: {} }
  if (!isLive) return { ...run, skipped: "demo mode" }
  if (!opts.send && !emailConfigured()) return { ...run, skipped: "email not configured" }
  if (!(await getAlertSettings()).abandonedCart) return { ...run, skipped: "reminders are off" }
  const tpl = await loadTemplate("abandoned_cart")
  if (!tpl.enabled) return { ...run, skipped: "template disabled" }

  const now = opts.now ?? Date.now()
  const send = opts.send ?? sendEmail
  const db = serviceClient()
  const { data: rows } = await db
    .from("abandoned_carts")
    .select("id, email, items, token, updated_at, reminder_sent_at, recovered_at")
    .is("recovered_at", null)
    .lte("updated_at", new Date(now - REMINDER_AFTER_HOURS * HOUR).toISOString())
    .gte("updated_at", new Date(now - REMINDER_MAX_AGE_DAYS * DAY).toISOString())
    .order("updated_at")
    .limit(opts.limit ?? 50)
  const carts = (rows ?? []) as any[]
  run.considered = carts.length
  if (carts.length === 0) return run

  const { data: outs } = await db.from("cart_reminder_optouts").select("email").in("email", carts.map((c) => c.email))
  const optedOut = new Set(((outs ?? []) as any[]).map((o) => o.email))
  const catalog = new Map((await getCatalog()).map((p) => [p.id, p]))
  const brand = await brandInfo()
  const count = (k: DueReason | "unavailable") => (run.notDue[k] = (run.notDue[k] ?? 0) + 1)

  for (const c of carts) {
    // did they order after leaving? (compare by email, the way checkout identifies customers)
    // ilike treats _ and % as wildcards and emails often contain "_": escape them so only this exact address matches
    const { data: cust } = await db.from("customers").select("id").ilike("email", String(c.email).replace(/[\\%_]/g, (m) => "\\" + m))
    let orderedSince = false
    if (cust?.length) {
      const { data: o } = await db.from("orders").select("id").in("customer_id", cust.map((x: any) => x.id)).gt("created_at", c.updated_at).limit(1)
      orderedSince = (o?.length ?? 0) > 0
    }
    const verdict = reminderDue({ updatedAt: c.updated_at, reminderSentAt: c.reminder_sent_at, recoveredAt: c.recovered_at }, { now, optedOut: optedOut.has(c.email), orderedSince })
    if (!verdict.due) {
      count(verdict.reason)
      continue
    }

    // show only what can still be bought, at today's prices
    const lines: OrderLine[] = []
    for (const i of (cleanCartItems(c.items) ?? []) as CartItem[]) {
      const p = catalog.get(i.productId)
      if (!p || sizeLeft(p, i.size) <= 0) continue
      lines.push({ name: p.name, color: i.color, size: i.size, qty: Math.min(i.qty, sizeLeft(p, i.size)), price: unitPrice(p), image: p.images[0] })
    }
    if (lines.length === 0) {
      count("unavailable")
      continue
    }
    const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0)
    const bagUrl = `${storeUrl()}/bag/${c.token}`
    const vars = { first_name: "there", name: "", order_id: "", total: `$${subtotal}`, store_url: storeUrl(), discount_code: "", bag_url: bagUrl }
    const { html, text } = renderEmail(
      tpl.doc,
      { vars, storeUrl: storeUrl(), ...brand, kind: "marketing", cart: { items: lines, subtotal }, unsubscribeUrl: `${storeUrl()}/reminders/stop/${c.token}`, unsubscribeLabel: "Stop reminders", footerNote: `You're receiving this because you started an order at ${brand.storeName || "our store"}. We only send this once.` },
      { subject: tpl.subject, preheader: tpl.preheader },
    )
    const r = await send({ to: c.email, subject: tpl.subject, html, text })
    await log({ resend_id: r.ok ? r.id : undefined, kind: "abandoned_cart", to_email: c.email, status: r.ok ? "sent" : "failed", error: r.ok ? undefined : r.error })
    if (r.ok) {
      run.sent++
      await db.from("abandoned_carts").update({ reminder_sent_at: new Date(now).toISOString() }).eq("id", c.id)
    } else run.failed++
  }
  return run
}

export interface AdminCart {
  id: string
  email: string
  items: { name: string; size: string; color: string; qty: number }[]
  subtotal: number
  updatedAt: string
  reminderSentAt: string | null
  recoveredAt: string | null
}
