/** Checks the rules the admin's discount and sale forms enforce.   npm run test-discount-validate */
import { codeStatus, describeCode, describeSale, saleStatus, type DiscountCode } from "../src/lib/discount-types"
import { cleanCode, cleanSale, type CodeInput, type SaleInput } from "../src/lib/discount-validate"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}
const base: CodeInput = { code: "summer20", kind: "percent", value: 20, minSpend: 0, categories: null, startsAt: null, endsAt: null, usageLimit: null, oncePerCustomer: false, firstOrderOnly: false, active: true, note: "" }
const sale: SaleInput = { name: "Black Friday", percent: 25, scope: "all", categories: null, productIds: null, startsAt: null, endsAt: null, active: true }
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "" : (r as { error: string }).error)

// ---- codes
const good = cleanCode(base)
ok("a normal code is accepted and stored in capitals", good.ok && good.value.code === "SUMMER20")
ok("rejects spaces / symbols", !cleanCode({ ...base, code: "SUMMER 20" }).ok && !cleanCode({ ...base, code: "SALE!" }).ok)
ok("rejects too short / too long", !cleanCode({ ...base, code: "AB" }).ok && !cleanCode({ ...base, code: "X".repeat(25) }).ok)
ok("percent must be 1-100", !cleanCode({ ...base, value: 0 }).ok && !cleanCode({ ...base, value: 101 }).ok && cleanCode({ ...base, value: 100 }).ok)
ok("percent must be a whole number", !cleanCode({ ...base, value: 12.5 }).ok)
ok("fixed amount must be at least $1", !cleanCode({ ...base, kind: "fixed", value: 0 }).ok && cleanCode({ ...base, kind: "fixed", value: 5 }).ok)
const free = cleanCode({ ...base, kind: "free_shipping", value: 99 })
ok("free shipping ignores any stray value (stored as 0)", free.ok && free.value.value === 0)
ok("negative minimum spend is refused", !cleanCode({ ...base, minSpend: -5 }).ok)
ok("usage limit must be 1 or more", !cleanCode({ ...base, usageLimit: 0 }).ok && cleanCode({ ...base, usageLimit: 50 }).ok)
ok("end date must be after start date", !cleanCode({ ...base, startsAt: "2026-12-01T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" }).ok, err(cleanCode({ ...base, startsAt: "2026-12-01T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" })))
ok("a nonsense date is refused", !cleanCode({ ...base, endsAt: "not a date" }).ok)
const cats = cleanCode({ ...base, categories: ["Tees", " Tees ", "", "Bottoms"] })
ok("categories are tidied (blanks and duplicates removed)", cats.ok && JSON.stringify(cats.value.categories) === '["Tees","Bottoms"]')
ok("an empty category list means 'everything'", (() => { const r = cleanCode({ ...base, categories: [] }); return r.ok && r.value.categories === null })())
ok("notes are trimmed and capped", (() => { const r = cleanCode({ ...base, note: "  " + "x".repeat(300) }); return r.ok && r.value.note.length === 200 })())

// ---- sales
ok("a normal sale is accepted", cleanSale(sale).ok)
ok("sale needs a name", !cleanSale({ ...sale, name: "  " }).ok)
ok("sale percent is 1-90", !cleanSale({ ...sale, percent: 0 }).ok && !cleanSale({ ...sale, percent: 95 }).ok && cleanSale({ ...sale, percent: 90 }).ok)
ok("a category sale needs at least one category", !cleanSale({ ...sale, scope: "categories", categories: [] }).ok && cleanSale({ ...sale, scope: "categories", categories: ["Tees"] }).ok)
ok("a product sale needs at least one product", !cleanSale({ ...sale, scope: "products", productIds: null }).ok && cleanSale({ ...sale, scope: "products", productIds: ["p01"] }).ok)
ok("whole-store sale drops leftover category/product picks", (() => { const r = cleanSale({ ...sale, scope: "all", categories: ["Tees"], productIds: ["p01"] }); return r.ok && r.value.categories === null && r.value.productIds === null })())
ok("sale dates must run forwards", !cleanSale({ ...sale, startsAt: "2026-12-01T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" }).ok)

// ---- status + plain-English summaries
const code = (o: Partial<DiscountCode> = {}): DiscountCode => ({ id: "x", code: "X", kind: "percent", value: 10, minSpend: 0, categories: null, startsAt: null, endsAt: null, usageLimit: null, oncePerCustomer: false, firstOrderOnly: false, active: true, note: "", createdAt: "", ...o })
const now = Date.parse("2026-11-10T12:00:00Z")
ok("status: active", codeStatus(code(), 0, now) === "active")
ok("status: switched off", codeStatus(code({ active: false }), 0, now) === "disabled")
ok("status: scheduled", codeStatus(code({ startsAt: "2026-12-01T00:00:00Z" }), 0, now) === "scheduled")
ok("status: expired", codeStatus(code({ endsAt: "2026-11-01T00:00:00Z" }), 0, now) === "expired")
ok("status: used up at the limit", codeStatus(code({ usageLimit: 5 }), 5, now) === "used_up" && codeStatus(code({ usageLimit: 5 }), 4, now) === "active")
ok("sale status follows the dates", saleStatus({ id: "s", name: "s", percent: 10, scope: "all", categories: null, productIds: null, startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-30T00:00:00Z", active: true }, now) === "active" && saleStatus({ id: "s", name: "s", percent: 10, scope: "all", categories: null, productIds: null, startsAt: null, endsAt: "2026-11-05T00:00:00Z", active: true }, now) === "expired")
const d = describeCode({ kind: "percent", value: 15, minSpend: 50, categories: ["Tees"], endsAt: null, oncePerCustomer: true, firstOrderOnly: false, usageLimit: 100 })
ok("summary reads naturally", d === "15% off Tees · bags over $50 · once per customer · first 100 uses", d)
ok("free-shipping summary", describeCode({ kind: "free_shipping", value: 0, minSpend: 0, categories: null, endsAt: null, oncePerCustomer: false, firstOrderOnly: true, usageLimit: null }) === "Free shipping · first orders only")
ok("sale summary", /^25% off everything · /.test(describeSale({ percent: 25, scope: "all", categories: null, productIds: null, startsAt: null, endsAt: null })))
