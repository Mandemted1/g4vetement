/**
 * Shipping zones: where you ship, what it costs, and when shipping is free.
 * Pure rules shared by the storefront, the admin form, and the demo-mode checkout.
 * The database applies the same rules at checkout (see supabase/008_shipping.sql), so the shopper is always charged what they were quoted.
 */
import { COUNTRIES, countryName, isCountry } from "./countries"

/** the "everywhere else" marker in a zone's country list */
export const WORLD = "*"

export interface ShippingZone {
  id: string
  name: string
  /** ISO country codes, or ["*"] for every country not covered by another zone */
  countries: string[]
  /** whole dollars */
  rate: number
  /** shipping is free when the bag (after sales) reaches this; null = never free */
  freeOver: number | null
  /** e.g. "3–5 business days" */
  estimate: string
  active: boolean
  sort: number
}

/** What a store has until the admin sets up zones: the original flat rate for everyone. */
export const DEFAULT_ZONE: ShippingZone = { id: "default", name: "Everywhere", countries: [WORLD], rate: 9, freeOver: 100, estimate: "3–7 business days", active: true, sort: 0 }

export interface ZoneInput {
  name: string
  countries: string[]
  rate: number
  freeOver: number | null
  estimate: string
  active: boolean
}

export type Cleaned<T> = { ok: true; value: T } | { ok: false; error: string }

/** Validates a zone from the admin form. `others` = every other zone (so overlaps can be caught). */
export function cleanZone(i: ZoneInput, others: ShippingZone[]): Cleaned<ZoneInput> {
  const name = i.name.trim()
  if (!name) return { ok: false, error: "Give the zone a name, like “Ghana” or “Europe”." }
  if (name.length > 40) return { ok: false, error: "The zone name is too long (40 characters max)." }

  const countries = [...new Set(i.countries.map((c) => c.trim().toUpperCase()).filter(Boolean))]
  if (countries.length === 0) return { ok: false, error: "Choose at least one country." }
  const bad = countries.find((c) => c !== WORLD && !isCountry(c))
  if (bad) return { ok: false, error: `“${bad}” isn't a country code we know.` }

  if (countries.includes(WORLD)) {
    if (countries.length > 1) return { ok: false, error: "“Everywhere else” can't be mixed with specific countries." }
    const clash = others.find((z) => z.countries.includes(WORLD))
    if (clash) return { ok: false, error: `You already have an “everywhere else” zone (“${clash.name}”). Edit that one instead.` }
  } else {
    for (const c of countries) {
      const clash = others.find((z) => z.countries.includes(c))
      if (clash) return { ok: false, error: `${countryName(c)} is already in the zone “${clash.name}”. A country can only be in one zone.` }
    }
  }

  if (!Number.isInteger(i.rate) || i.rate < 0 || i.rate > 10_000) return { ok: false, error: "The shipping price must be a whole number of dollars, 0 or more." }
  let freeOver: number | null = i.freeOver
  if (freeOver !== null) {
    if (!Number.isInteger(freeOver) || freeOver < 1 || freeOver > 100_000) return { ok: false, error: "“Free over” must be a whole number of dollars, 1 or more. Leave it empty for never." }
    if (i.rate === 0) freeOver = null // already free
  }
  const estimate = i.estimate.trim()
  if (estimate.length > 60) return { ok: false, error: "The delivery estimate is too long (60 characters max)." }

  // specific countries read nicely in a fixed order
  countries.sort((a, b) => countryName(a).localeCompare(countryName(b), "en"))
  return { ok: true, value: { name, countries, rate: i.rate, freeOver, estimate, active: i.active } }
}

const bySort = (a: ShippingZone, b: ShippingZone) => a.sort - b.sort

/**
 * The zone that serves a country: a zone naming it wins, otherwise the “everywhere else” zone.
 * With no country given (nothing chosen yet) the first active zone is used.
 */
export function zoneFor(zones: ShippingZone[], country: string | null | undefined): ShippingZone | null {
  const active = zones.filter((z) => z.active).sort(bySort)
  const c = (country ?? "").trim().toUpperCase()
  if (!c) return active[0] ?? null
  return active.find((z) => z.countries.includes(c)) ?? active.find((z) => z.countries.includes(WORLD)) ?? null
}

export interface ShippingQuote {
  zone: string
  price: number
  estimate: string
  freeOver: number | null
  /** set when the country isn't served */
  error: string | null
}

/** What shipping costs for a bag worth `subtotal` (after sales). `free` = a free-shipping code is applied. */
export function quoteShipping(zones: ShippingZone[], country: string | null | undefined, subtotal: number, free = false): ShippingQuote {
  const z = zoneFor(zones, country)
  if (!z) return { zone: "", price: 0, estimate: "", freeOver: null, error: `We don't ship to ${country ? countryName(country) : "that country"} yet.` }
  const price = free || (z.freeOver !== null && subtotal >= z.freeOver) ? 0 : z.rate
  return { zone: z.name, price, estimate: z.estimate, freeOver: z.freeOver, error: null }
}

/** Countries a shopper can pick at checkout. */
export function shippableCountries(zones: ShippingZone[]): { code: string; name: string }[] {
  const active = zones.filter((z) => z.active)
  if (active.some((z) => z.countries.includes(WORLD))) return COUNTRIES
  const codes = new Set(active.flatMap((z) => z.countries))
  return COUNTRIES.filter((c) => codes.has(c.code))
}

/** One-line summary of a zone for the admin list. */
export function describeZone(z: Pick<ShippingZone, "countries" | "rate" | "freeOver" | "estimate">): string {
  const where = z.countries.includes(WORLD)
    ? "Everywhere else"
    : z.countries.length <= 3
      ? z.countries.map(countryName).join(", ")
      : `${z.countries.slice(0, 3).map(countryName).join(", ")} +${z.countries.length - 3} more`
  const parts = [where, z.rate === 0 ? "Free shipping" : `$${z.rate}`]
  if (z.rate > 0 && z.freeOver !== null) parts.push(`free over $${z.freeOver}`)
  if (z.estimate) parts.push(z.estimate)
  return parts.join(" · ")
}

/** A sentence about shipping for the product page and menu. */
export function shippingSummary(zones: ShippingZone[]): string {
  const active = zones.filter((z) => z.active)
  if (active.length === 0) return "Shipping is calculated at checkout."
  const same = active.every((z) => z.rate === active[0].rate && z.freeOver === active[0].freeOver)
  if (same) {
    const { rate, freeOver } = active[0]
    if (rate === 0) return "Free shipping."
    if (freeOver !== null) return `Free shipping over $${freeOver}. $${rate} flat rate below.`
    return `$${rate} flat-rate shipping.`
  }
  const min = Math.min(...active.map((z) => z.rate))
  return `Shipping from ${min === 0 ? "free" : `$${min}`}. Rates depend on your country and are shown at checkout.`
}
