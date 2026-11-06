/**
 * Pure rules for the store's notifications: who gets alerts, when stock counts as "low", and who is due a cart reminder.
 * No database or email here, so every rule can be tested directly.
 */

/* ---------------- settings ---------------- */

export interface AlertSettings {
  /** email me for every new order */
  newOrder: boolean
  /** email me when a product runs low or a size sells out */
  lowStock: boolean
  /** email shoppers once if they leave a bag behind (they must have typed their email at checkout) */
  abandonedCart: boolean
  /** where alerts go; empty = the store's contact email */
  email: string
}

export const DEFAULT_ALERTS: AlertSettings = { newOrder: true, lowStock: true, abandonedCart: false, email: "" }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function cleanAlerts(v: AlertSettings): { ok: true; value: AlertSettings } | { ok: false; error: string } {
  const email = String(v.email ?? "").trim()
  if (email && (!EMAIL.test(email) || email.length > 200)) return { ok: false, error: "That alerts email doesn't look right." }
  return { ok: true, value: { newOrder: Boolean(v.newOrder), lowStock: Boolean(v.lowStock), abandonedCart: Boolean(v.abandonedCart), email } }
}

/** Where alerts are sent: the alerts email, else the store's contact email, else nothing (no alert is sent). */
export const alertRecipient = (a: Pick<AlertSettings, "email">, storeEmail: string) => a.email.trim() || storeEmail.trim() || ""

/* ---------------- low stock ---------------- */

export interface OrderedUnit {
  productId: string
  size: string
  qty: number
}
export interface ProductStock {
  id: string
  name: string
  /** after the order */
  stock: number
  reorderLevel: number
  sizes: string[]
  /** after the order */
  sizeStock: Record<string, number>
}
export interface LowStockEvent {
  productId: string
  name: string
  left: number
  reorderLevel: number
  /** sizes that just sold out */
  soldOutSizes: string[]
  /** the product just dropped to (or below) its warning level */
  crossed: boolean
  /** the last piece just sold: nothing left in any size */
  soldOut: boolean
}

/**
 * Which products did THIS order push into trouble? Compares stock before the order (after + what was bought) with
 * after, so you're told once when a product crosses its warning level or a size sells out, not on every later order.
 */
export function findLowStock(ordered: OrderedUnit[], products: ProductStock[]): LowStockEvent[] {
  const events: LowStockEvent[] = []
  for (const p of products) {
    const mine = ordered.filter((o) => o.productId === p.id)
    if (mine.length === 0) continue
    const bought = mine.reduce((n, o) => n + o.qty, 0)
    const before = p.stock + bought
    const crossed = before > p.reorderLevel && p.stock <= p.reorderLevel
    const soldOut = before > 0 && p.stock === 0
    const soldOutSizes = p.sizes.filter((s) => {
      const q = mine.filter((o) => o.size === s).reduce((n, o) => n + o.qty, 0)
      return q > 0 && (p.sizeStock[s] ?? 0) === 0
    })
    if (crossed || soldOut || soldOutSizes.length > 0) events.push({ productId: p.id, name: p.name, left: p.stock, reorderLevel: p.reorderLevel, soldOutSizes, crossed, soldOut })
  }
  return events
}

/* ---------------- abandoned carts ---------------- */

/** how long a bag must sit untouched before it counts as abandoned */
export const REMINDER_AFTER_HOURS = 2
/** don't remind about bags older than this (stale prices and stock) */
export const REMINDER_MAX_AGE_DAYS = 7
/** never remind the same person more often than this */
export const REMINDER_COOLDOWN_DAYS = 14

export interface CartRow {
  updatedAt: string
  reminderSentAt: string | null
  recoveredAt: string | null
}
export type DueReason = "due" | "recovered" | "opted_out" | "ordered_since" | "too_recent" | "too_old" | "cooldown"

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Should this bag get its reminder now? (A reminder is sent at most once per bag and once per cooldown per person.) */
export function reminderDue(cart: CartRow, ctx: { now: number; optedOut: boolean; orderedSince: boolean }): { due: boolean; reason: DueReason } {
  const no = (reason: DueReason) => ({ due: false, reason })
  if (cart.recoveredAt) return no("recovered")
  if (ctx.optedOut) return no("opted_out")
  if (ctx.orderedSince) return no("ordered_since")
  const idle = ctx.now - Date.parse(cart.updatedAt)
  if (idle < REMINDER_AFTER_HOURS * HOUR) return no("too_recent")
  if (idle > REMINDER_MAX_AGE_DAYS * DAY) return no("too_old")
  if (cart.reminderSentAt && ctx.now - Date.parse(cart.reminderSentAt) < REMINDER_COOLDOWN_DAYS * DAY) return no("cooldown")
  return { due: true, reason: "due" }
}

export interface CartItem {
  productId: string
  size: string
  color: string
  qty: number
}

/** Tidies a bag sent from the browser: sane sizes, no duplicates of the same line merged wrongly, at most 20 lines. */
export function cleanCartItems(raw: unknown): CartItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) return null
  const out: CartItem[] = []
  for (const r of raw as Record<string, unknown>[]) {
    const productId = typeof r?.productId === "string" ? r.productId.slice(0, 60) : ""
    const size = typeof r?.size === "string" ? r.size.slice(0, 20) : ""
    const color = typeof r?.color === "string" ? r.color.slice(0, 40) : ""
    const qty = Number(r?.qty)
    if (!productId || !size || !color || !Number.isInteger(qty) || qty < 1 || qty > 10) return null
    out.push({ productId, size, color, qty })
  }
  return out
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase()
export const validEmail = (e: string) => EMAIL.test(e) && e.length <= 200
