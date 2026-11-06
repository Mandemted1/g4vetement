/** Checks the tracking block and delivery address in order emails.   npm run test-shipping-email */
import { DEFAULT_TEMPLATES } from "../src/lib/email/defaults"
import { renderEmail, withTrackingBlock, type OrderInfo, type RenderContext } from "../src/lib/email/render"
import type { EmailDoc } from "../src/lib/email/types"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}
const base: OrderInfo = {
  items: [{ name: "Essential Tee", color: "Black", size: "M", qty: 1, price: 32 }],
  subtotal: 32, discount: 0, shipping: 9, total: 41,
  shipTo: ["Alex Morgan", "12 Example Street", "Accra, GA, 00233", "Ghana"], estimate: "3–7 business days",
}
const withTracking: OrderInfo = { ...base, tracking: { carrier: "UPS", number: "1Z999AA10123456784", url: "https://www.ups.com/track?tracknum=1Z999AA10123456784" } }
const ctx = (order?: OrderInfo, vars: Record<string, string> = {}): RenderContext => ({ vars: { first_name: "Alex", order_id: "G4-2050", store_url: "https://shop.example", ...vars }, storeUrl: "https://shop.example", address: "", kind: "transactional", order })
const tpl = DEFAULT_TEMPLATES.order_shipped
const render = (doc: EmailDoc, order?: OrderInfo, vars?: Record<string, string>) => renderEmail(doc, ctx(order, vars), { subject: tpl.subject, preheader: tpl.preheader })

const a = render(tpl.doc, withTracking)
ok("the shipped email shows the tracking number", a.html.includes("1Z999AA10123456784") && /Tracking · UPS/.test(a.html))
ok("…with a 'Track your package' button linking to the carrier", /<a href="https:\/\/www\.ups\.com\/track\?tracknum=1Z999AA10123456784"[^>]*>Track your package<\/a>/.test(a.html))
ok("…and the delivery address and estimate", a.html.includes("Delivering to") && a.html.includes("12 Example Street") && a.html.includes("Ghana") && a.html.includes("Estimated delivery: 3–7 business days"))
ok("the plain-text version has them too", a.text.includes("Tracking (UPS): 1Z999AA10123456784") && a.text.includes("Delivering to:") && a.text.includes("12 Example Street"))

const b = render(tpl.doc, base)
ok("shipped without tracking: no tracking box, no button", !b.html.includes("Track your package") && !/Tracking ·/.test(b.html) && !b.html.includes("Tracking details appear here"))
ok("…but the address is still there", b.html.includes("Delivering to"))
ok("an order from before addresses were collected has no address box", !render(tpl.doc, { ...base, shipTo: [], estimate: undefined }).html.includes("Delivering to"))
ok("in the editor (no order yet) the block shows a placeholder", render(tpl.doc, undefined).html.includes("Tracking details appear here"))

const noLink = render(tpl.doc, { ...base, tracking: { carrier: "Other", number: "ABC12345", url: "" } })
ok("a carrier without a link shows the number but no button", noLink.html.includes("ABC12345") && !noLink.html.includes("Track your package"))
const unsafe = render(tpl.doc, { ...base, tracking: { carrier: "Other", number: "ABC12345", url: "javascript:alert(1)" } })
ok("an unsafe link is never rendered", !unsafe.html.includes("javascript:") && !unsafe.html.includes("Track your package"))
const evil = render(tpl.doc, { ...base, tracking: { carrier: "<b>X</b>", number: "<img src=x onerror=1>", url: "https://a.com/?q=\"><script>" } })
ok("everything is escaped", !evil.html.includes("<img src=x") && !evil.html.includes("<b>X</b>") && !evil.html.includes("<script>") && evil.html.includes("&lt;img src=x"))
const addr = render(tpl.doc, { ...base, shipTo: ["<script>alert(1)</script>"] })
ok("the address is escaped too", !addr.html.includes("<script>alert(1)") && addr.html.includes("&lt;script&gt;"))

// variables
const custom: EmailDoc = { theme: tpl.doc.theme, blocks: [{ id: "t", type: "text", text: "Your {{carrier}} number is {{tracking_number}}", align: "left" }] }
ok("{{carrier}} and {{tracking_number}} fill in", render(custom, withTracking, { carrier: "UPS", tracking_number: "1Z999" }).html.includes("Your UPS number is 1Z999"))

// templates saved before this feature
const old: EmailDoc = { theme: tpl.doc.theme, blocks: tpl.doc.blocks.filter((x) => x.type !== "tracking") }
const patched = withTrackingBlock(old)
const kinds = patched.blocks.map((x) => x.type)
ok("an older saved template gets a tracking block, just above the order summary", kinds.indexOf("tracking") === kinds.indexOf("order") - 1 && kinds.filter((k) => k === "tracking").length === 1, kinds.join(","))
ok("one that already has it is left alone", withTrackingBlock(tpl.doc) === tpl.doc)
ok("a template without an order summary gets it at the end", (() => { const d = withTrackingBlock({ theme: tpl.doc.theme, blocks: [tpl.doc.blocks[0]] }); return d.blocks.at(-1)?.type === "tracking" })())
ok("the patched email now shows the tracking", render(patched, withTracking).html.includes("1Z999AA10123456784"))
ok("the default shipped template includes the block", tpl.doc.blocks.some((x) => x.type === "tracking"))
ok("the confirmation email never shows tracking (it has no block)", !render(DEFAULT_TEMPLATES.order_confirmation.doc, withTracking).html.includes("1Z999AA10123456784"))
