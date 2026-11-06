/**
 * Checks store details + policies end to end: validation rules, the real storefront (footer, policy pages),
 * HTML safety, and the business address in email footers.
 *   npm run test-store-settings      (needs `npm run dev` on port 3100)
 * Restores your real settings afterwards.
 */
import { createClient } from "@supabase/supabase-js"
import { cleanPolicies, cleanStore, handle } from "../src/lib/settings-validate"
import { DEFAULT_POLICIES, DEFAULT_STORE } from "../src/lib/settings-types"

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}
const get = async (path: string) => {
  const r = await fetch(`http://localhost:3100${path}`, { cache: "no-store" })
  return { status: r.status, html: await r.text() }
}

// ---------- validation (pure) ----------
ok("handle: @name", handle("@g4.vet") === "g4.vet")
ok("handle: profile link", handle("https://www.instagram.com/g4vet/?hl=en") === "g4vet")
ok("handle: tiktok link", handle("tiktok.com/@g4vet") === "g4vet")
const base = { ...DEFAULT_STORE, name: "G4" }
ok("rejects empty store name", !cleanStore({ ...base, name: "  " }).ok)
ok("rejects bad contact email", !cleanStore({ ...base, email: "not-an-email" }).ok)
ok("rejects a handle with spaces/symbols", !cleanStore({ ...base, instagram: "bad handle!" }).ok)
ok("rejects an over-long address", !cleanStore({ ...base, address: "x".repeat(301) }).ok)
ok("rejects an over-long policy", !cleanPolicies({ ...DEFAULT_POLICIES, terms: "x".repeat(12001) }).ok)
const good = cleanStore({ ...base, email: " hello@g4test.example ", instagram: "@g4test", tiktok: "https://tiktok.com/@g4test", address: "G4 Clothing\r\n12 Test St, Brooklyn, NY 11201" })
ok("accepts + normalises good details", good.ok && good.value.email === "hello@g4test.example" && good.value.instagram === "g4test" && good.value.tiktok === "g4test" && !good.value.address.includes("\r"))

// ---------- live behaviour ----------
const prev = (await db.from("site_settings").select("key, value").in("key", ["store", "policies"])).data ?? []
const put = (key: string, value: object) => db.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() })

try {
  if (!good.ok) throw new Error("setup failed")
  await put("store", good.value)
  await put("policies", { ...DEFAULT_POLICIES, returns: "", terms: "## Safe\n<script>alert(1)</script>\n\n- one\n- two" })

  const shop = await get("/shop")
  ok("footer shows contact email", shop.html.includes("mailto:hello@g4test.example"))
  ok("footer shows Instagram + TikTok links", shop.html.includes("instagram.com/g4test") && shop.html.includes("tiktok.com/@g4test"))
  ok("footer shows the business address", shop.html.includes("12 Test St, Brooklyn, NY 11201"))
  ok("footer links Shipping, Privacy and Terms", ["shipping", "privacy", "terms"].every((s) => shop.html.includes(`/policies/${s}`)))
  ok("an empty policy (Returns) is not linked", !shop.html.includes("/policies/returns"))

  const ship = await get("/policies/shipping")
  ok("shipping page renders your text", ship.status === 200 && ship.html.includes("Orders over $100 ship free") && ship.html.includes("Shipping rates"))
  ok("empty policy page is a 404", (await get("/policies/returns")).status === 404)
  ok("unknown policy page is a 404", (await get("/policies/nonsense")).status === 404)

  const terms = await get("/policies/terms")
  ok("HTML in a policy is shown as text, never run", terms.status === 200 && terms.html.includes("&lt;script&gt;alert(1)&lt;/script&gt;") && !terms.html.includes("<script>alert(1)</script>"))
  ok("bullet lists render as lists", /<li[^>]*>one<\/li>/.test(terms.html))

  // email footers use the saved address + name
  const { getAddressLine } = await import("../src/lib/settings")
  const { renderEmail } = await import("../src/lib/email/render")
  const { DEFAULT_TEMPLATES } = await import("../src/lib/email/defaults")
  const address = await getAddressLine()
  ok("address line for emails is one line", address === "G4 Clothing, 12 Test St, Brooklyn, NY 11201", address)
  const t = DEFAULT_TEMPLATES.welcome
  const mail = renderEmail(t.doc, { vars: {}, storeUrl: "https://x.test", address, storeName: "Acme Wear", kind: "marketing", unsubscribeUrl: "https://x.test/u" }, { subject: t.subject })
  ok("email footer has the address and store name", mail.html.includes("12 Test St, Brooklyn, NY 11201") && mail.html.includes("subscribed to Acme Wear"))
} finally {
  // put back exactly what was there (or remove rows that didn't exist)
  for (const key of ["store", "policies"]) {
    const before = prev.find((r) => r.key === key)
    if (before) await put(key, before.value as object)
    else await db.from("site_settings").delete().eq("key", key)
  }
  const after = await get("/shop")
  ok("settings restored (test address gone from the footer)", !after.html.includes("12 Test St"))
}
