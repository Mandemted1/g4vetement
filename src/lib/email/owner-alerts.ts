import "server-only"
import { alertRecipient, findLowStock, type ProductStock } from "@/lib/alerts"
import { getAlertSettings, getStoreSettings } from "@/lib/settings"
import { readSizeStock } from "@/lib/stock"
import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"
import { lowStockDoc, lowStockSubject, newOrderDoc, newOrderSubject } from "./alert-docs"
import { renderEmail } from "./render"
import { emailConfigured, sendEmail, storeUrl, type OutgoingEmail, type SendResult } from "./send"
import { brandInfo, loadOrder, log } from "./service"

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AlertOutcome {
  newOrder: "sent" | "off" | "failed" | "skipped"
  lowStock: "sent" | "off" | "failed" | "none" | "skipped"
  error?: string
}

/**
 * After a real checkout: email the owner about the order and, if that order pushed a product to its warning level or
 * sold out a size, about the stock. Each alert can be switched off in Settings. Never throws (a failed alert must never
 * affect the shopper's order). `send` is injectable so tests don't send real email.
 */
export async function notifyStoreOwner(orderId: string, deps: { send?: (e: OutgoingEmail) => Promise<SendResult> } = {}): Promise<AlertOutcome> {
  const skipped: AlertOutcome = { newOrder: "skipped", lowStock: "skipped" }
  if (!isLive || (!deps.send && !emailConfigured())) return skipped
  try {
    const [alerts, store] = await Promise.all([getAlertSettings(), getStoreSettings()])
    const to = alertRecipient(alerts, store.email)
    if (!to) return { ...skipped, error: "No alerts email set (Settings > Notifications, or the store contact email)." }
    if (!alerts.newOrder && !alerts.lowStock) return { newOrder: "off", lowStock: "off" }

    const send = deps.send ?? sendEmail
    const brand = await brandInfo()
    const base = { storeUrl: storeUrl(), ...brand, kind: "transactional" as const, footerNote: `This alert is for the ${brand.storeName || "store"} owner. Change what you get in Settings > Notifications.` }
    const vars = { admin_url: `${storeUrl()}/admin`, store_url: storeUrl() }
    const out: AlertOutcome = { newOrder: alerts.newOrder ? "failed" : "off", lowStock: alerts.lowStock ? "none" : "off" }

    if (alerts.newOrder) {
      const o = await loadOrder(orderId)
      if (o) {
        const { html, text } = renderEmail(newOrderDoc(), { ...base, vars: { ...vars, customer_name: o.name, customer_email: o.email, order_id: o.id, order_total: `$${o.info.total}` }, order: o.info }, { subject: "" })
        const r = await send({ to, subject: newOrderSubject(o.id, o.info.total, o.name), html, text })
        await log({ resend_id: r.ok ? r.id : undefined, kind: "new_order_alert", to_email: to, status: r.ok ? "sent" : "failed", error: r.ok ? undefined : r.error })
        out.newOrder = r.ok ? "sent" : "failed"
        if (!r.ok) out.error = r.error
      }
    }

    if (alerts.lowStock) {
      const db = serviceClient()
      const { data: units } = await db.from("order_items").select("product_id, size, qty").eq("order_id", orderId)
      const ordered = ((units ?? []) as any[]).map((u) => ({ productId: u.product_id as string, size: u.size as string, qty: u.qty as number }))
      const ids = [...new Set(ordered.map((u) => u.productId))]
      if (ids.length) {
        const { data: rows } = await db.from("products").select("id, name, stock, sizes, size_stock, reorder_level").in("id", ids)
        const products: ProductStock[] = ((rows ?? []) as any[]).map((p) => ({ id: p.id, name: p.name, stock: p.stock, reorderLevel: p.reorder_level, sizes: p.sizes ?? [], sizeStock: readSizeStock(p.size_stock, p.stock, p.sizes ?? []) }))
        const events = findLowStock(ordered, products)
        if (events.length) {
          const { html, text } = renderEmail(lowStockDoc(events), { ...base, vars }, { subject: "" })
          const r = await send({ to, subject: lowStockSubject(events), html, text })
          await log({ resend_id: r.ok ? r.id : undefined, kind: "low_stock_alert", to_email: to, status: r.ok ? "sent" : "failed", error: r.ok ? undefined : r.error })
          out.lowStock = r.ok ? "sent" : "failed"
          if (!r.ok) out.error ||= r.error
        }
      }
    }
    return out
  } catch (e) {
    return { ...skipped, error: (e as Error).message }
  }
}
