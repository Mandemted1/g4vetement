/** Tracking numbers: validation and the link a customer clicks to follow their parcel. */

export const CARRIERS = ["UPS", "USPS", "FedEx", "DHL", "Other"] as const
export type Carrier = (typeof CARRIERS)[number]

export interface Tracking {
  carrier: Carrier
  number: string
  /** where to follow the parcel; built for known carriers, supplied by the admin for "Other" (may be empty) */
  url: string
}

const LINKS: Record<Exclude<Carrier, "Other">, (n: string) => string> = {
  UPS: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
  FedEx: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  DHL: (n) => `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(n)}`,
}

export const isCarrier = (c: string): c is Carrier => (CARRIERS as readonly string[]).includes(c)

/** Cleans what the admin typed. Known carriers get an automatic link; "Other" may carry the admin's own link. */
export function cleanTracking(input: { carrier: string; number: string; url?: string }): { ok: true; value: Tracking } | { ok: false; error: string } {
  if (!isCarrier(input.carrier)) return { ok: false, error: "Choose a carrier." }
  const number = input.number.replace(/\s+/g, "").toUpperCase()
  if (!number) return { ok: false, error: "Enter the tracking number." }
  if (!/^[A-Z0-9-]{5,40}$/.test(number)) return { ok: false, error: "A tracking number is 5–40 letters, numbers or dashes (no other symbols)." }

  if (input.carrier !== "Other") return { ok: true, value: { carrier: input.carrier, number, url: LINKS[input.carrier](number) } }

  const custom = (input.url ?? "").trim()
  if (!custom) return { ok: true, value: { carrier: "Other", number, url: "" } }
  if (custom.length > 300 || !/^https?:\/\/[^\s]+$/i.test(custom)) return { ok: false, error: "The tracking link must start with http:// or https://." }
  return { ok: true, value: { carrier: "Other", number, url: custom } }
}
