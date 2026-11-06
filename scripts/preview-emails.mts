/** Renders the default email templates to HTML files.   Run: npx tsx scripts/preview-emails.mts <outDir> */
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import store from "../src/data/store.json"
import { DEFAULT_CAMPAIGN, DEFAULT_TEMPLATES } from "../src/lib/email/defaults"
import { renderEmail } from "../src/lib/email/render"

const out = process.argv[2]
if (!out) throw new Error("usage: preview-emails.mts <outDir>")
mkdirSync(out, { recursive: true })
const products = store.products.slice(0, 6).map((p) => ({ id: p.id, name: p.name, price: p.price, image: p.id === "p05" ? "/products/p05.jpg" : undefined, color: p.colors[0].hex }))
const items = [
  { name: "Classic Pullover Hoodie", color: "Heather Grey", size: "M", qty: 1, price: 78 },
  { name: "Ribbed Beanie", color: "Black", size: "One Size", qty: 2, price: 24 },
]
const order = { items, subtotal: 126, discount: 10, shipping: 0, total: 116 }
const vars = { name: "Alex Morgan", first_name: "Alex", order_id: "G4-2048", total: "$116", store_url: "http://localhost:3100", discount_code: "WELCOME10" }
const base = { vars, storeUrl: "http://localhost:3100", address: "G4 Clothing, 120 Wythe Ave, Brooklyn, NY 11249", products, order }

for (const [k, t] of Object.entries(DEFAULT_TEMPLATES)) {
  writeFileSync(join(out, `${k}.html`), renderEmail(t.doc, { ...base, kind: "transactional" }, { subject: t.subject, preheader: t.preheader }).html)
}
const c = { ...DEFAULT_CAMPAIGN.doc, blocks: DEFAULT_CAMPAIGN.doc.blocks.map((b) => (b.type === "products" ? { ...b, ids: ["p05", "p06", "p12", "p01"] } : b)) }
writeFileSync(join(out, "campaign.html"), renderEmail(c, { ...base, kind: "marketing", unsubscribeUrl: "http://localhost:3100/unsubscribe/x" }, { subject: DEFAULT_CAMPAIGN.subject, preheader: DEFAULT_CAMPAIGN.preheader }).html)
console.log("rendered 4 emails to", out)
