import type { CodeKind, SaleScope } from "./discount-types"

type Cleaned<T> = { ok: true; value: T } | { ok: false; error: string }

export interface CodeInput {
  code: string
  kind: CodeKind
  value: number
  minSpend: number
  categories: string[] | null
  startsAt: string | null
  endsAt: string | null
  usageLimit: number | null
  oncePerCustomer: boolean
  firstOrderOnly: boolean
  active: boolean
  note: string
}
export interface SaleInput {
  name: string
  percent: number
  scope: SaleScope
  categories: string[] | null
  productIds: string[] | null
  startsAt: string | null
  endsAt: string | null
  active: boolean
}

const wholeDollars = (n: unknown) => typeof n === "number" && Number.isInteger(n)
const validDate = (s: string | null) => s === null || !Number.isNaN(new Date(s).getTime())

function checkDates(startsAt: string | null, endsAt: string | null): string | null {
  if (!validDate(startsAt) || !validDate(endsAt)) return "That date doesn't look right."
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return "The end date must be after the start date."
  return null
}

const cleanList = (v: string[] | null) => {
  if (!v) return null
  const out = [...new Set(v.map((x) => x.trim()).filter(Boolean))]
  return out.length ? out : null
}

/** Codes are stored in capitals, letters/numbers/dash/underscore, 3 to 24 characters. */
export function cleanCode(v: CodeInput): Cleaned<CodeInput> {
  const code = v.code.trim().toUpperCase()
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return { ok: false, error: "Codes are 3 to 24 letters, numbers, dashes or underscores (no spaces)." }
  if (!["percent", "fixed", "free_shipping"].includes(v.kind)) return { ok: false, error: "Choose what the code does." }
  let value = v.value
  if (v.kind === "free_shipping") value = 0
  else if (!wholeDollars(value)) return { ok: false, error: v.kind === "percent" ? "Enter a whole percentage." : "Enter a whole number of dollars." }
  else if (v.kind === "percent" && (value < 1 || value > 100)) return { ok: false, error: "A percentage must be between 1 and 100." }
  else if (v.kind === "fixed" && value < 1) return { ok: false, error: "The amount must be at least $1." }
  if (!wholeDollars(v.minSpend) || v.minSpend < 0) return { ok: false, error: "Minimum spend must be $0 or more." }
  if (v.usageLimit !== null && (!wholeDollars(v.usageLimit) || v.usageLimit < 1)) return { ok: false, error: "Usage limit must be 1 or more (or empty for unlimited)." }
  const dateError = checkDates(v.startsAt, v.endsAt)
  if (dateError) return { ok: false, error: dateError }
  const categories = cleanList(v.categories)
  return {
    ok: true,
    value: {
      code, kind: v.kind, value, minSpend: v.minSpend, categories, startsAt: v.startsAt, endsAt: v.endsAt, usageLimit: v.usageLimit,
      oncePerCustomer: v.oncePerCustomer, firstOrderOnly: v.firstOrderOnly, active: v.active, note: v.note.trim().slice(0, 200),
    },
  }
}

export function cleanSale(v: SaleInput): Cleaned<SaleInput> {
  const name = v.name.trim()
  if (!name || name.length > 60) return { ok: false, error: "Give the sale a name (up to 60 characters)." }
  if (!wholeDollars(v.percent) || v.percent < 1 || v.percent > 90) return { ok: false, error: "Percent off must be a whole number from 1 to 90." }
  if (!["all", "categories", "products"].includes(v.scope)) return { ok: false, error: "Choose what the sale applies to." }
  const categories = v.scope === "categories" ? cleanList(v.categories) : null
  const productIds = v.scope === "products" ? cleanList(v.productIds) : null
  if (v.scope === "categories" && !categories) return { ok: false, error: "Pick at least one category." }
  if (v.scope === "products" && !productIds) return { ok: false, error: "Pick at least one product." }
  const dateError = checkDates(v.startsAt, v.endsAt)
  if (dateError) return { ok: false, error: dateError }
  return { ok: true, value: { name, percent: v.percent, scope: v.scope, categories, productIds, startsAt: v.startsAt, endsAt: v.endsAt, active: v.active } }
}
