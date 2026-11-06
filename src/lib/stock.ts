/** Per-size stock helpers (pure, shared by the storefront, admin and scripts). */

export type SizeStock = Record<string, number>

/** Splits a total across sizes as evenly as possible (10 over 3 sizes = 4, 3, 3). Matches the database's backfill. */
export function evenSplit(total: number, sizes: string[]): SizeStock {
  const out: SizeStock = {}
  const k = sizes.length
  sizes.forEach((s, i) => (out[s] = k ? Math.floor(total / k) + (i < total % k ? 1 : 0) : 0))
  return out
}

export const totalStock = (m: SizeStock) => Object.values(m).reduce((a, b) => a + b, 0)

/** Per-size numbers from the database; falls back to an even split for rows saved before sizes were tracked. */
export function readSizeStock(raw: unknown, stock: number, sizes: string[]): SizeStock {
  if (raw && typeof raw === "object" && Object.keys(raw as object).length > 0) {
    const m = raw as Record<string, unknown>
    return Object.fromEntries(sizes.map((s) => [s, Math.max(0, Number(m[s]) || 0)]))
  }
  return evenSplit(stock, sizes)
}

/** How many of one size are left. */
export const sizeLeft = (p: { sizeStock: SizeStock }, size: string) => p.sizeStock[size] ?? 0

/** Sizes with nothing left (only meaningful while the product still has stock somewhere). */
export const soldOutSizes = (p: { sizes: string[]; sizeStock: SizeStock }) => p.sizes.filter((s) => sizeLeft(p, s) <= 0)
