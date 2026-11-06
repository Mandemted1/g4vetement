/** Checks the content of the owner alerts and the abandoned-cart reminder.   npm run test-alert-emails */
import { lowStockDoc, lowStockSubject, newOrderDoc, newOrderSubject } from "../src/lib/email/alert-docs"
import { DEFAULT_TEMPLATES } from "../src/lib/email/defaults"
import { renderEmail, type OrderInfo, type RenderContext } from "../src/lib/email/render"
import type { LowStockEvent } from "../src/lib/alerts"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}
const base: Omit<RenderContext, "vars"> = { storeUrl: "https://shop.example", address: "1 Main St", kind: "transactional", storeName: "G4" }
const order: OrderInfo = {
  items: [{ name: "Boxy Tee", color: "Black", size: "M", qty: 2, price: 38 }],
  subtotal: 76, discount: 0, shipping: 9, total: 85, giftAmount: 30,
  shipTo: ["Alex Morgan", "12 Example Street", "Accra, GA", "Ghana"], estimate: "3–7 business days",
}

// ---- new-order alert
const n = renderEmail(newOrderDoc(), { ...base, vars: { admin_url: "https://shop.example/admin", customer_name: "Alex Morgan", customer_email: "alex@example.com", order_id: "G4-2200", order_total: "$85" }, order, footerNote: "This alert is for the G4 owner." }, { subject: "" })
ok("the new-order alert names the customer, order and total", /Alex Morgan/.test(n.html) && /alex@example\.com/.test(n.html) && /G4-2200/.test(n.html) && /\$85/.test(n.html))
ok("…lists the items and the delivery address", /Boxy Tee/.test(n.html) && /12 Example Street/.test(n.html) && /Ghana/.test(n.html))
ok("…shows a gift card payment and what's left to collect ($85 - $30 = $55)", /Gift card/.test(n.html) && /To pay/.test(n.html) && /\$55/.test(n.html))
ok("…links to the orders page in the admin", n.html.includes('href="https://shop.example/admin/orders"'))
ok("…and its footer says it's for the owner (not 'because you placed an order')", /alert is for the G4 owner/i.test(n.html) && !/because you placed an order/i.test(n.html))
ok("the plain-text version has the essentials", /Boxy Tee/.test(n.text) && /Delivering to:/.test(n.text))
const evil = renderEmail(newOrderDoc(), { ...base, vars: { admin_url: "https://shop.example/admin", customer_name: "<script>alert(1)</script>", customer_email: "a@b.co", order_id: "G4-1", order_total: "$1" }, order }, { subject: "" })
ok("a customer name with HTML is escaped", !evil.html.includes("<script>alert(1)") && evil.html.includes("&lt;script&gt;"))
ok("subject: 'New order G4-2200 · $85 · Alex Morgan'", newOrderSubject("G4-2200", 85, "Alex Morgan") === "New order G4-2200 · $85 · Alex Morgan" && newOrderSubject("G4-1", 5, "  ") === "New order G4-1 · $5")

// ---- low-stock alert
const low: LowStockEvent = { productId: "p1", name: "Boxy Tee", left: 7, reorderLevel: 10, soldOutSizes: [], crossed: true, soldOut: false }
const out: LowStockEvent = { productId: "p2", name: "Zip-Up Hoodie", left: 0, reorderLevel: 20, soldOutSizes: ["M", "L"], crossed: false, soldOut: true }
const sizeOnly: LowStockEvent = { productId: "p3", name: "Cap", left: 40, reorderLevel: 10, soldOutSizes: ["One Size"], crossed: false, soldOut: false }
const l = renderEmail(lowStockDoc([low, out, sizeOnly]), { ...base, vars: { admin_url: "https://shop.example/admin" } }, { subject: "" })
ok("each product gets its own line with the right wording", /Boxy Tee<\/strong>: 7 left \(your warning level is 10\)/.test(l.html) && /Zip-Up Hoodie<\/strong> is sold out/.test(l.html) && /Cap<\/strong>: 40 left\./.test(l.html))
ok("sold-out sizes are named (singular and plural)", /Sold out in sizes M, L/.test(l.html) && /Sold out in size One Size/.test(l.html))
ok("the heading is 'Stock alert' when something sold out, 'Running low' otherwise", /Stock alert/.test(l.html) && /Running low/.test(renderEmail(lowStockDoc([low]), { ...base, vars: { admin_url: "x" } }, { subject: "" }).html))
ok("it links to the products page", l.html.includes('href="https://shop.example/admin/products"'))
ok("subjects: single low, single sold out, size only, several", lowStockSubject([low]) === "Low stock: Boxy Tee (7 left)" && lowStockSubject([out]) === "Sold out: Zip-Up Hoodie" && lowStockSubject([sizeOnly]) === "Cap: One Size sold out" && lowStockSubject([low, out]) === "Stock alert: 2 products need attention")
ok("a product name with HTML is escaped", !renderEmail(lowStockDoc([{ ...low, name: "<img src=x onerror=1>" }]), { ...base, vars: { admin_url: "x" } }, { subject: "" }).html.includes("<img src=x"))

// ---- abandoned-cart reminder
const tpl = DEFAULT_TEMPLATES.abandoned_cart
const cart = { items: [{ name: "Boxy Tee", color: "Black", size: "M", qty: 1, price: 38 }, { name: "Cap", color: "Sand", size: "One Size", qty: 2, price: 30 }], subtotal: 98 }
const tok = "11111111-2222-3333-4444-555555555555"
const r = renderEmail(tpl.doc, { ...base, kind: "marketing", vars: { first_name: "there", store_url: "https://shop.example", bag_url: `https://shop.example/bag/${tok}` }, cart, unsubscribeUrl: `https://shop.example/reminders/stop/${tok}`, unsubscribeLabel: "Stop reminders", footerNote: "You're receiving this because you started an order at G4. We only send this once." }, { subject: tpl.subject, preheader: tpl.preheader })
ok("the reminder lists the bag with quantities and the subtotal ($98)", /Boxy Tee/.test(r.html) && /Qty 2/.test(r.html) && /Subtotal/.test(r.html) && /\$98/.test(r.html))
ok("…a button back to the bag, carrying the token", r.html.includes(`href="https://shop.example/bag/${tok}"`) && />Return to your bag</.test(r.html))
ok("…and a 'Stop reminders' link in the footer", r.html.includes(`href="https://shop.example/reminders/stop/${tok}"`) && />Stop reminders</.test(r.html))
ok("…saying why they got it and that it's the only one", /started an order at G4/.test(r.html) && /only send this once/i.test(r.html) && !/subscribed to/i.test(r.html))
ok("the greeting falls back to 'there'", /Hi there/.test(r.html))
ok("the plain-text version lists the items and the link", /1 x Boxy Tee/.test(r.text) && r.text.includes(`/bag/${tok}`))
ok("the template's subject is friendly", tpl.subject === "You left something in your bag")
ok("in the editor (no bag yet) the block shows a placeholder", renderEmail(tpl.doc, { ...base, vars: {}, kind: "marketing" }, { subject: "" }).html.includes("bag appears here"))
const hostile = renderEmail(tpl.doc, { ...base, kind: "marketing", vars: { first_name: "x", bag_url: "javascript:alert(1)" }, cart: { items: [{ name: "<b>Tee</b>", color: "<i>c</i>", size: "M", qty: 1, price: 1 }], subtotal: 1 } }, { subject: "" })
ok("a hostile link is never rendered, and item names are escaped", !hostile.html.includes("javascript:") && !hostile.html.includes("<b>Tee</b>") && hostile.html.includes("&lt;b&gt;Tee"))
