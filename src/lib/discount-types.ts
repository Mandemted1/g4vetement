export type CodeKind = "percent" | "fixed" | "free_shipping"
export type SaleScope = "all" | "categories" | "products"

export interface DiscountCode {
  id: string
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
  createdAt: string
}

export interface CodeStats {
  /** orders that used it (not cancelled), real and demo */
  uses: number
  /** real orders only: what the usage limit counts */
  realUses: number
  revenue: number
  discounted: number
  recent: { id: string; date: string; total: number }[]
}

export interface Sale {
  id: string
  name: string
  percent: number
  scope: SaleScope
  categories: string[] | null
  productIds: string[] | null
  startsAt: string | null
  endsAt: string | null
  active: boolean
}

export type Status = "active" | "scheduled" | "expired" | "disabled" | "used_up"

export function codeStatus(c: DiscountCode, realUses: number, now = Date.now()): Status {
  if (!c.active) return "disabled"
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return "scheduled"
  if (c.endsAt && new Date(c.endsAt).getTime() <= now) return "expired"
  if (c.usageLimit !== null && realUses >= c.usageLimit) return "used_up"
  return "active"
}

export function saleStatus(s: Sale, now = Date.now()): Status {
  if (!s.active) return "disabled"
  if (s.startsAt && new Date(s.startsAt).getTime() > now) return "scheduled"
  if (s.endsAt && new Date(s.endsAt).getTime() <= now) return "expired"
  return "active"
}

const usd = (n: number) => `$${n}`
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

/** One plain-English line describing what a code does. */
export function describeCode(c: Pick<DiscountCode, "kind" | "value" | "minSpend" | "categories" | "endsAt" | "oncePerCustomer" | "firstOrderOnly" | "usageLimit">, opts: { dates?: boolean } = {}): string {
  const what = c.kind === "percent" ? `${c.value}% off` : c.kind === "fixed" ? `${usd(c.value)} off` : "Free shipping"
  const parts = [what + (c.categories?.length ? ` ${c.categories.join(", ")}` : c.kind === "free_shipping" ? "" : "")]
  if (c.minSpend > 0) parts.push(`bags over ${usd(c.minSpend)}`)
  if (c.firstOrderOnly) parts.push("first orders only")
  else if (c.oncePerCustomer) parts.push("once per customer")
  if (c.usageLimit) parts.push(`first ${c.usageLimit} uses`)
  if (c.endsAt && opts.dates !== false) parts.push(`until ${day(c.endsAt)}`)
  return parts.join(" · ")
}

export function describeSale(s: Pick<Sale, "percent" | "scope" | "categories" | "productIds" | "startsAt" | "endsAt">, opts: { dates?: boolean } = {}): string {
  const where = s.scope === "all" ? "everything" : s.scope === "categories" ? (s.categories ?? []).join(", ") : `${s.productIds?.length ?? 0} product${(s.productIds?.length ?? 0) === 1 ? "" : "s"}`
  if (opts.dates === false) return `${s.percent}% off ${where}`
  const when = s.startsAt && s.endsAt ? `${day(s.startsAt)} – ${day(s.endsAt)}` : s.endsAt ? `until ${day(s.endsAt)}` : s.startsAt ? `from ${day(s.startsAt)}` : "no end date"
  return `${s.percent}% off ${where} · ${when}`
}
