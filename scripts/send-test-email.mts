/** Sends the order-confirmation email (sample data) through Resend.
 *  Run: npm run test-email -- you@gmail.com
 *  Until you verify a domain in Resend, it only delivers to the email address your Resend account was created with. */
import store from "../src/data/store.json"
import { DEFAULT_TEMPLATES } from "../src/lib/email/defaults"
import { renderEmail } from "../src/lib/email/render"

const { fromAddress, sendEmail, storeUrl, storeAddress, emailConfigured } = await import("../src/lib/email/send")
const to = process.argv[2]
if (!to) {
  console.error("Usage: npm run test-email -- you@example.com")
  process.exit(1)
}
if (!emailConfigured()) {
  console.error("Set RESEND_API_KEY in .env.local first.")
  process.exit(1)
}
const t = DEFAULT_TEMPLATES.order_confirmation
const items = store.products.slice(4, 6).map((p, i) => ({ name: p.name, color: p.colors[0].name, size: "M", qty: i + 1, price: p.price }))
const subtotal = items.reduce((s, l) => s + l.price * l.qty, 0)
const shipping = subtotal >= 100 ? 0 : 9
const vars = { name: "Alex Morgan", first_name: "Alex", order_id: "G4-TEST", total: `$${subtotal + shipping}`, store_url: storeUrl(), discount_code: "WELCOME10" }
const { html, text } = renderEmail(
  t.doc,
  { vars, storeUrl: storeUrl(), address: storeAddress(), kind: "transactional", order: { items, subtotal, discount: 0, shipping, total: subtotal + shipping } },
  { subject: t.subject, preheader: t.preheader },
)
console.log(`Sending from ${fromAddress()} to ${to} …`)
const r = await sendEmail({ to, subject: "[Test] Your G4 order G4-TEST", html, text })
console.log(r.ok ? "✓ Sent. Check the inbox (and spam folder)." : `✗ ${r.error}`)
process.exit(r.ok ? 0 : 1)
