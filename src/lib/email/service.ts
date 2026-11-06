import "server-only"
import { getCatalog } from "@/lib/source"
import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"
import { WELCOME_CODE } from "@/lib/store"
import { DEFAULT_TEMPLATES, type TemplateKey } from "./defaults"
import { renderEmail, withTrackingBlock, type OrderInfo, type ProductLite } from "./render"
import { getWelcomeOffer } from "@/lib/offers"
import { countryName } from "@/lib/countries"
import { getAddressLine, getStoreSettings } from "@/lib/settings"
import { emailConfigured, sendBatch, sendEmail, storeUrl, type OutgoingEmail } from "./send"
import type { EmailDoc } from "./types"

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TemplateRow {
  key: string
  subject: string
  preheader: string
  doc: EmailDoc
  enabled: boolean
}

export async function loadTemplate(key: TemplateKey): Promise<TemplateRow> {
  const d = DEFAULT_TEMPLATES[key]
  const fallback = { key, subject: d.subject, preheader: d.preheader, doc: d.doc, enabled: true }
  if (!isLive) return fallback
  try {
    const { data } = await serviceClient().from("email_templates").select("*").eq("key", key).maybeSingle()
    return data ? { key, subject: data.subject, preheader: data.preheader, doc: data.doc, enabled: data.enabled } : fallback
  } catch {
    return fallback
  }
}

export async function productsLite(): Promise<ProductLite[]> {
  return (await getCatalog()).map((p) => ({ id: p.id, name: p.name, price: p.salePrice ?? p.price, listPrice: p.price, image: p.images[0], color: p.colors[0]?.hex ?? "#cccccc" }))
}

/** Business address + store name from Settings (address falls back to the STORE_ADDRESS variable). */
async function brandInfo() {
  const [address, store] = await Promise.all([getAddressLine(), getStoreSettings()])
  return { address, storeName: store.name }
}

const firstName = (n: string) => n.trim().split(/\s+/)[0] || "there"

async function log(row: { resend_id?: string; campaign_id?: string; kind: string; to_email: string; status: string; error?: string }) {
  try {
    await serviceClient().from("email_messages").insert(row)
  } catch {
    /* logging must never break a send */
  }
}

/** The delivery address as lines for the email: name, street, city/state/postcode, country. Empty for orders placed before addresses were collected. */
function shipToLines(o: any, name: string): string[] {
  if (!o.ship_address && !o.ship_city) return []
  return [name, o.ship_address, [o.ship_city, o.ship_state, o.ship_postcode].filter(Boolean).join(", "), o.ship_country ? countryName(o.ship_country) : ""].map((s: string) => (s ?? "").trim()).filter(Boolean)
}

/** Order + customer + line items straight from the database. */
async function loadOrder(orderId: string) {
  const db = serviceClient()
  const { data: o } = await db.from("orders").select("*, order_items(*), customers(name, email)").eq("id", orderId).maybeSingle()
  if (!o) return null
  const catalog = new Map((await getCatalog()).map((p) => [p.id, p]))
  const info: OrderInfo = {
    items: (o.order_items as any[]).map((i) => ({ name: i.name, color: i.color, size: i.size, qty: i.qty, price: i.price, image: catalog.get(i.product_id)?.images[0] })),
    subtotal: o.subtotal,
    discount: o.discount,
    shipping: o.shipping,
    total: o.total,
    giftAmount: o.gift_amount > 0 ? o.gift_amount : undefined,
    shipTo: shipToLines(o, o.customers?.name ?? ""),
    estimate: o.ship_estimate || undefined,
    tracking: o.tracking_number ? { carrier: o.tracking_carrier ?? "", number: o.tracking_number, url: o.tracking_url ?? "" } : undefined,
  }
  return { id: o.id as string, name: (o.customers?.name ?? "") as string, email: (o.customers?.email ?? "") as string, info }
}

/** Order confirmation / shipped email. Never throws: failures are logged and returned. */
export async function sendOrderEmail(orderId: string, key: "order_confirmation" | "order_shipped") {
  if (!isLive || !emailConfigured()) return { ok: false as const, error: "Email not configured" }
  try {
    const tpl = await loadTemplate(key)
    if (!tpl.enabled) return { ok: false as const, error: "Template disabled" }
    const brand = await brandInfo()
    const o = await loadOrder(orderId)
    if (!o?.email) return { ok: false as const, error: "Order or customer email not found" }
    const t = o.info.tracking
    const vars = { name: o.name, first_name: firstName(o.name), order_id: o.id, total: `$${o.info.total}`, store_url: storeUrl(), discount_code: WELCOME_CODE, tracking_number: t?.number ?? "", tracking_url: t?.url ?? "", carrier: t?.carrier ?? "" }
    const doc = key === "order_shipped" && t ? withTrackingBlock(tpl.doc) : tpl.doc
    const { html, text } = renderEmail(doc, { vars, storeUrl: storeUrl(), ...brand, kind: "transactional", order: o.info, products: await productsLite() }, { subject: tpl.subject, preheader: tpl.preheader })
    const subject = tpl.subject.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (vars as Record<string, string>)[k] ?? "")
    const r = await sendEmail({ to: o.email, subject, html, text })
    await log({ resend_id: r.ok ? r.id : undefined, kind: key, to_email: o.email, status: r.ok ? "sent" : "failed", error: r.ok ? undefined : r.error })
    return r
  } catch (e) {
    return { ok: false as const, error: (e as Error).message }
  }
}

export async function sendWelcomeEmail(email: string) {
  if (!isLive || !emailConfigured()) return
  try {
    // with the welcome code switched off there is nothing to hand out
    const offer = await getWelcomeOffer()
    if (!offer) return
    const tpl = await loadTemplate("welcome")
    if (!tpl.enabled) return
    const vars = { name: "", first_name: "there", order_id: "", total: "", store_url: storeUrl(), discount_code: offer.code }
    const { html, text } = renderEmail(tpl.doc, { vars, storeUrl: storeUrl(), ...(await brandInfo()), kind: "transactional", products: await productsLite() }, { subject: tpl.subject, preheader: tpl.preheader })
    const r = await sendEmail({ to: email, subject: tpl.subject, html, text })
    await log({ resend_id: r.ok ? r.id : undefined, kind: "welcome", to_email: email, status: r.ok ? "sent" : "failed", error: r.ok ? undefined : r.error })
  } catch {
    /* welcome email is best-effort */
  }
}

/* ---------------- campaigns ---------------- */

export type Audience = "subscribers" | "buyers" | "non_buyers" | "vip"
export const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: "subscribers", label: "All subscribers", hint: "Everyone who joined the list." },
  { value: "buyers", label: "Subscribers who've ordered", hint: "On the list and bought at least once." },
  { value: "non_buyers", label: "Subscribers who haven't ordered", hint: "On the list, no purchase yet. Good for a first-order nudge." },
  { value: "vip", label: "Top customers ($300+ spent)", hint: "Subscribers who've spent $300 or more." },
]

interface Recipient {
  email: string
  token: string
  name: string
}

/** Subscribed people who match an audience, with the name we know for them (if any). */
export async function resolveAudience(audience: Audience): Promise<Recipient[]> {
  const db = serviceClient()
  const page = async <T,>(q: (a: number, b: number) => PromiseLike<{ data: T[] | null }>) => {
    const out: T[] = []
    for (let i = 0; ; i += 1000) {
      const { data } = await q(i, i + 999)
      out.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return out
  }
  const subs = await page<any>((a, b) => db.from("subscribers").select("email, token").eq("status", "subscribed").range(a, b))
  if (audience === "subscribers") return subs.map((s) => ({ email: s.email, token: s.token, name: "" }))

  const customers = await page<any>((a, b) => db.from("customers").select("id, name, email").range(a, b))
  const orders = await page<any>((a, b) => db.from("orders").select("customer_id, total, status").range(a, b))
  const spent = new Map<string, number>()
  const count = new Map<string, number>()
  for (const o of orders) {
    if (o.status === "cancelled" || o.status === "refunded") continue
    spent.set(o.customer_id, (spent.get(o.customer_id) ?? 0) + o.total)
    count.set(o.customer_id, (count.get(o.customer_id) ?? 0) + 1)
  }
  const byEmail = new Map(customers.map((c) => [String(c.email).toLowerCase(), c]))
  return subs
    .map((s) => ({ s, c: byEmail.get(String(s.email).toLowerCase()) }))
    .filter(({ c }) => {
      const n = c ? (count.get(c.id) ?? 0) : 0
      if (audience === "buyers") return n > 0
      if (audience === "non_buyers") return n === 0
      return c ? (spent.get(c.id) ?? 0) >= 300 : false
    })
    .map(({ s, c }) => ({ email: s.email, token: s.token, name: c?.name ?? "" }))
}

export async function audienceCounts(): Promise<Record<Audience, number>> {
  const out = {} as Record<Audience, number>
  for (const a of AUDIENCES) out[a.value] = (await resolveAudience(a.value)).length
  return out
}

/** Sends a campaign to its audience, logs every message, and updates the campaign row. */
export async function deliverCampaign(id: string): Promise<{ ok: true; sent: number; failed: number } | { ok: false; error: string }> {
  if (!emailConfigured()) return { ok: false, error: "RESEND_API_KEY is not set." }
  const db = serviceClient()
  const { data: c } = await db.from("campaigns").select("*").eq("id", id).maybeSingle()
  if (!c) return { ok: false, error: "Campaign not found" }
  if (c.status === "sending" || c.status === "sent") return { ok: false, error: `Campaign is already ${c.status}.` }
  if (!c.subject.trim()) return { ok: false, error: "Add a subject line first." }

  const people = await resolveAudience(c.audience as Audience)
  if (people.length === 0) return { ok: false, error: "No one is in this audience yet." }

  await db.from("campaigns").update({ status: "sending", error: null, updated_at: new Date().toISOString() }).eq("id", id)
  const products = await productsLite()
  const base = storeUrl()
  const brand = await brandInfo()

  const emails: OutgoingEmail[] = people.map((p) => {
    const unsub = `${base}/unsubscribe/${p.token}`
    const vars = { name: p.name, first_name: p.name ? firstName(p.name) : "there", order_id: "", total: "", store_url: base, discount_code: WELCOME_CODE }
    const { html, text } = renderEmail(c.doc as EmailDoc, { vars, storeUrl: base, ...brand, kind: "marketing", unsubscribeUrl: unsub, products }, { subject: c.subject, preheader: c.preheader })
    const subject = c.subject.replace(/\{\{\s*(\w+)\s*\}\}/g, (_: string, k: string) => (vars as Record<string, string>)[k] ?? "")
    return { to: p.email, subject, html, text, headers: { "List-Unsubscribe": `<${base}/api/unsubscribe?t=${p.token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
  })

  const results = await sendBatch(emails)
  let sent = 0
  let failed = 0
  let firstError = ""
  const rows = results.map((r, i) => {
    if (r.ok) sent++
    else {
      failed++
      firstError ||= r.error
    }
    return { resend_id: r.ok ? r.id : null, campaign_id: id, kind: "campaign", to_email: people[i].email, status: r.ok ? "sent" : "failed", error: r.ok ? null : r.error }
  })
  for (let i = 0; i < rows.length; i += 500) await db.from("email_messages").insert(rows.slice(i, i + 500))

  await db
    .from("campaigns")
    .update({ status: sent === 0 ? "failed" : "sent", sent_at: new Date().toISOString(), recipients: sent, error: firstError || null, updated_at: new Date().toISOString() })
    .eq("id", id)
  return sent === 0 ? { ok: false, error: firstError || "Nothing was sent." } : { ok: true, sent, failed }
}

export async function sendTestEmail(to: string, doc: EmailDoc, subject: string, preheader: string, kind: "marketing" | "transactional") {
  const products = await productsLite()
  const base = storeUrl()
  const sampleOrder: OrderInfo = {
    items: products.slice(0, 2).map((p, i) => ({ name: p.name, color: "Black", size: "M", qty: i + 1, price: p.price, image: p.image })),
    subtotal: 0, discount: 0, shipping: 0, total: 0,
    shipTo: ["Alex Morgan", "12 Example Street", "Accra, GA", "Ghana"], estimate: "3–7 business days",
    tracking: { carrier: "UPS", number: "1Z999AA10123456784", url: "https://www.ups.com/track?tracknum=1Z999AA10123456784" },
  }
  sampleOrder.subtotal = sampleOrder.items.reduce((s, l) => s + l.price * l.qty, 0)
  sampleOrder.shipping = sampleOrder.subtotal >= 100 ? 0 : 9
  sampleOrder.total = sampleOrder.subtotal + sampleOrder.shipping
  const vars = { name: "Alex Morgan", first_name: "Alex", order_id: "G4-0000", total: `$${sampleOrder.total}`, store_url: base, discount_code: WELCOME_CODE, tracking_number: "1Z999AA10123456784", tracking_url: "https://www.ups.com/track?tracknum=1Z999AA10123456784", carrier: "UPS" }
  const { html, text } = renderEmail(doc, { vars, storeUrl: base, ...(await brandInfo()), kind, unsubscribeUrl: `${base}/unsubscribe/test`, products, order: sampleOrder }, { subject, preheader })
  const r = await sendEmail({ to, subject: `[Test] ${subject.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (vars as Record<string, string>)[k] ?? "")}`, html, text })
  await log({ resend_id: r.ok ? r.id : undefined, kind: "test", to_email: to, status: r.ok ? "sent" : "failed", error: r.ok ? undefined : r.error })
  return r
}
