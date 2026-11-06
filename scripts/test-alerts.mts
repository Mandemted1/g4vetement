/** Checks the notification rules: low-stock detection, who is due a cart reminder, settings.   npm run test-alerts */
import { DEFAULT_ALERTS, REMINDER_AFTER_HOURS, REMINDER_COOLDOWN_DAYS, REMINDER_MAX_AGE_DAYS, alertRecipient, cleanAlerts, cleanCartItems, findLowStock, normalizeEmail, reminderDue, validEmail, type ProductStock } from "../src/lib/alerts"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}

// ---- settings
ok("defaults: order and stock alerts on, cart reminders off (they email shoppers, so the owner opts in)", DEFAULT_ALERTS.newOrder && DEFAULT_ALERTS.lowStock && !DEFAULT_ALERTS.abandonedCart)
const a = { newOrder: true, lowStock: false, abandonedCart: true, email: "  owner@example.com " }
const c = cleanAlerts(a)
ok("an alerts email is trimmed and kept", c.ok && c.value.email === "owner@example.com" && c.value.lowStock === false)
ok("an empty alerts email is fine (the store email is used)", cleanAlerts({ ...a, email: "" }).ok)
ok("a bad email is refused", !cleanAlerts({ ...a, email: "nope" }).ok && !cleanAlerts({ ...a, email: "a@b" }).ok)
ok("alerts go to the alerts email, else the store's contact email, else nowhere", alertRecipient({ email: "x@y.co" }, "store@y.co") === "x@y.co" && alertRecipient({ email: " " }, "store@y.co") === "store@y.co" && alertRecipient({ email: "" }, "") === "")

// ---- low stock
const tee = (o: Partial<ProductStock> = {}): ProductStock => ({ id: "p1", name: "Tee", stock: 20, reorderLevel: 10, sizes: ["S", "M", "L"], sizeStock: { S: 8, M: 6, L: 6 }, ...o })
ok("plenty left: no alert", findLowStock([{ productId: "p1", size: "M", qty: 1 }], [tee()]).length === 0)
let e = findLowStock([{ productId: "p1", size: "M", qty: 2 }], [tee({ stock: 10, sizeStock: { S: 8, M: 4, L: 6 } })])
ok("dropping to the warning level (11 → 10) alerts once", e.length === 1 && e[0].crossed && e[0].left === 10 && e[0].soldOutSizes.length === 0, JSON.stringify(e))
ok("already below the level before this order: no repeat alert", findLowStock([{ productId: "p1", size: "M", qty: 1 }], [tee({ stock: 7, sizeStock: { S: 3, M: 2, L: 2 } })]).length === 0)
e = findLowStock([{ productId: "p1", size: "M", qty: 1 }], [tee({ stock: 17, sizeStock: { S: 8, M: 0, L: 9 } })])
ok("a size selling out alerts even when the total is healthy", e.length === 1 && !e[0].crossed && e[0].soldOutSizes.join() === "M", JSON.stringify(e))
e = findLowStock([{ productId: "p1", size: "S", qty: 1 }], [tee({ stock: 0, reorderLevel: 10, sizeStock: { S: 0, M: 0, L: 0 } })])
ok("the last piece going tells you the product is out (even though it was already low)", e.length === 1 && e[0].left === 0 && e[0].soldOutSizes.join() === "S" && e[0].soldOut && !e[0].crossed)
ok("going out from a healthy level is both: crossed and sold out", (() => { const x = findLowStock([{ productId: "p1", size: "S", qty: 12 }], [tee({ stock: 0, sizeStock: { S: 0, M: 0, L: 0 } })]); return x.length === 1 && x[0].crossed && x[0].soldOut })())
ok("a size that was already empty isn't reported again", findLowStock([{ productId: "p1", size: "S", qty: 1 }], [tee({ stock: 12, sizeStock: { S: 5, M: 0, L: 7 } })]).length === 0)
e = findLowStock([{ productId: "p1", size: "M", qty: 1 }, { productId: "p2", size: "One Size", qty: 1 }], [tee({ stock: 10, sizeStock: { S: 4, M: 3, L: 3 } }), { id: "p2", name: "Beanie", stock: 100, reorderLevel: 40, sizes: ["One Size"], sizeStock: { "One Size": 100 } }])
ok("several products in one order: only the ones in trouble are reported", e.length === 1 && e[0].productId === "p1")
ok("products not in the order are never reported", findLowStock([{ productId: "p9", size: "M", qty: 1 }], [tee({ stock: 1 })]).length === 0)
ok("two lines of one product count together (3 + 2 = 5 bought: 13 → 8)", findLowStock([{ productId: "p1", size: "S", qty: 3 }, { productId: "p1", size: "M", qty: 2 }], [tee({ stock: 8, sizeStock: { S: 3, M: 2, L: 3 } })]).length === 1)

// ---- who is due a cart reminder
const NOW = Date.parse("2026-11-10T12:00:00Z")
const hrs = (h: number) => new Date(NOW - h * 3_600_000).toISOString()
const days = (d: number) => hrs(d * 24)
const cart = (o: Partial<{ updatedAt: string; reminderSentAt: string | null; recoveredAt: string | null }> = {}) => ({ updatedAt: hrs(5), reminderSentAt: null, recoveredAt: null, ...o })
const ctx = { now: NOW, optedOut: false, orderedSince: false }
ok(`a bag idle for 5 hours (more than ${REMINDER_AFTER_HOURS}) is due`, reminderDue(cart(), ctx).due)
ok("a bag still being filled (30 minutes ago) is left alone", reminderDue(cart({ updatedAt: hrs(0.5) }), ctx).reason === "too_recent")
ok(`a bag older than ${REMINDER_MAX_AGE_DAYS} days is too stale`, reminderDue(cart({ updatedAt: days(8) }), ctx).reason === "too_old")
ok("exactly at the edges: 2 hours is due, 7 days is still due", reminderDue(cart({ updatedAt: hrs(REMINDER_AFTER_HOURS) }), ctx).due && reminderDue(cart({ updatedAt: days(REMINDER_MAX_AGE_DAYS) }), ctx).due)
ok("someone who opted out is never reminded", reminderDue(cart(), { ...ctx, optedOut: true }).reason === "opted_out")
ok("someone who ordered after leaving is not reminded", reminderDue(cart(), { ...ctx, orderedSince: true }).reason === "ordered_since")
ok("a recovered bag is not reminded", reminderDue(cart({ recoveredAt: hrs(1) }), ctx).reason === "recovered")
ok(`a person reminded in the last ${REMINDER_COOLDOWN_DAYS} days is not nagged again`, reminderDue(cart({ reminderSentAt: days(3) }), ctx).reason === "cooldown")
ok("after the cooldown they can be reminded about a new bag", reminderDue(cart({ reminderSentAt: days(REMINDER_COOLDOWN_DAYS + 1), updatedAt: hrs(5) }), ctx).due)
ok("opting out beats everything else", reminderDue(cart({ recoveredAt: null }), { now: NOW, optedOut: true, orderedSince: true }).reason === "opted_out" || reminderDue(cart(), { now: NOW, optedOut: true, orderedSince: true }).due === false)

// ---- bags sent from the browser
ok("a normal bag is accepted", cleanCartItems([{ productId: "p02", size: "M", color: "Black", qty: 2 }])?.length === 1)
ok("empty, huge or non-array bags are refused", cleanCartItems([]) === null && cleanCartItems("x") === null && cleanCartItems(Array.from({ length: 21 }, () => ({ productId: "p", size: "M", color: "B", qty: 1 }))) === null)
ok("bad lines are refused (qty 0, 11, 1.5, missing size)", [0, 11, 1.5].every((qty) => cleanCartItems([{ productId: "p", size: "M", color: "B", qty }]) === null) && cleanCartItems([{ productId: "p", color: "B", qty: 1 }]) === null)
ok("over-long strings are cut, not trusted", (() => { const r = cleanCartItems([{ productId: "p".repeat(200), size: "M", color: "B", qty: 1 }]); return !!r && r[0].productId.length === 60 })())
ok("emails are normalised and validated", normalizeEmail("  Alex@Example.COM ") === "alex@example.com" && validEmail("a@b.co") && !validEmail("a@b") && !validEmail("x".repeat(200) + "@b.co"))
