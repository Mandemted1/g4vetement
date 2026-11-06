/** What the storefront knows about a signed-in customer. */
export interface Address {
  address: string
  city: string
  state: string
  postcode: string
  /** ISO country code, e.g. "GH" */
  country: string
}

export interface AccountInfo {
  id: string
  email: string
  name: string
  /** the saved delivery address, if any (prefilled at checkout) */
  address: Address | null
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

/** Tidies an address from user metadata or a form. Returns null when there's nothing in it. */
export function cleanAddress(raw: unknown): Address | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const a: Address = { address: str(r.address, 200), city: str(r.city, 80), state: str(r.state, 80), postcode: str(r.postcode, 20), country: str(r.country, 2).toUpperCase() }
  return a.address || a.city ? a : null
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Order received",
  processing: "Being prepared",
  shipped: "On its way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
}
