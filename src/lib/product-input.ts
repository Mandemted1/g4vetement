/**
 * The rules for a product, shared by the product editor and the CSV importer so neither can save something the other would refuse.
 * Pure: no database in here.
 */
import { parseColor } from "./colors"
import { isDepartment, type Department } from "./departments"
import type { GarmentType } from "./data"

export interface ProductInput {
  name: string
  /** men / women / unisex */
  department: Department
  category: string
  type: GarmentType
  price: number
  /** units left per size; every size in `sizes` needs an entry. The product's total stock is worked out from this. */
  sizeStock: Record<string, number>
  reorderLevel: number
  description: string
  fabric: string
  fit: string
  active: boolean
  colors: { name: string; hex: string }[]
  sizes: string[]
  images: string[]
}

export const GARMENT_TYPES: GarmentType[] = [
  "tee", "longsleeve", "hoodie", "zip", "sweat", "jogger", "cargo", "straight", "wide", "shorts", "coach", "bomber", "puffer", "beanie", "cap", "tote", "socks",
  "tank", "crop", "shirt", "dress", "skirt", "leggings", "blazer", "other",
]
export const isGarmentType = (t: string): t is GarmentType => (GARMENT_TYPES as string[]).includes(t)

const HTTP = /^https?:\/\/[^\s]+$/i

/** The first problem with a product, in plain words, or null if it's fine. */
export function validateProduct(p: ProductInput): string | null {
  if (!p.name.trim()) return "Name is required"
  if (p.name.trim().length > 120) return "The name is too long (120 characters max)"
  if (!isDepartment(p.department)) return "Choose Men, Women or Unisex"
  if (!p.category.trim()) return "Category is required"
  if (p.category.trim().length > 40) return "The category name is too long (40 characters max)"
  if (!isGarmentType(p.type)) return `Unknown shape “${p.type}”`
  if (!Number.isInteger(p.price) || p.price < 0) return "Price must be a whole number of dollars"
  if (p.price > 100_000) return "Price is too high"
  if (!Number.isInteger(p.reorderLevel) || p.reorderLevel < 0) return "Reorder level must be 0 or more"
  if (p.description.length > 2000) return "The description is too long (2000 characters max)"
  if (p.fabric.length > 200 || p.fit.length > 200) return "Fabric and fit notes are limited to 200 characters"

  if (p.colors.length === 0) return "Add at least one colour"
  if (p.colors.length > 30) return "Too many colours (30 max)"
  const colourNames = new Set<string>()
  for (const c of p.colors) {
    const name = c.name.trim()
    if (!name) return "Every colour needs a name"
    if (name.length > 40) return `The colour name “${name.slice(0, 20)}…” is too long`
    if (colourNames.has(name.toLowerCase())) return `Two colours are called “${name}”. Each needs its own name`
    colourNames.add(name.toLowerCase())
    if (parseColor(c.hex) !== c.hex.toLowerCase() || !/^#[0-9a-f]{6}$/i.test(c.hex)) return `“${c.hex}” isn't a colour code for ${name}`
  }

  if (p.sizes.length === 0) return "Add at least one size"
  if (p.sizes.length > 30) return "Too many sizes (30 max)"
  if (p.sizes.some((s) => !s.trim() || s.length > 20)) return "Size names must be 1 to 20 characters"
  if (new Set(p.sizes.map((x) => x.toLowerCase())).size !== p.sizes.length) return "Two sizes have the same name"
  for (const s of p.sizes) {
    const n = p.sizeStock[s]
    if (!Number.isInteger(n) || n < 0) return `Stock for size ${s} must be a whole number, 0 or more`
    if (n > 1_000_000) return `Stock for size ${s} is too high`
  }

  if (p.images.length > 20) return "Too many photos (20 max)"
  const bad = p.images.find((u) => !HTTP.test(u) || u.length > 500)
  if (bad) return `“${bad.slice(0, 40)}” isn't a web address for a photo (it must start with https://)`
  return null
}

/** The database row for a product (the total `stock` is worked out by the database from the sizes). */
export const productRow = (p: ProductInput) => ({
  name: p.name.trim(), department: p.department, category: p.category.trim() || "Other", type: p.type, price: p.price,
  size_stock: Object.fromEntries(p.sizes.map((s) => [s, p.sizeStock[s] ?? 0])), reorder_level: p.reorderLevel,
  description: p.description, fabric: p.fabric, fit: p.fit, active: p.active, colors: p.colors, sizes: p.sizes, images: p.images,
})

/** Next ids for new products (p32, p33, …) and their codes, continuing from the highest number in use. */
export function nextProductIds(existingIds: string[], existingSorts: number[], categories: string[]): { id: string; sku: string; sort: number }[] {
  const top = Math.max(0, ...existingIds.map((i) => Number(String(i).replace(/\D/g, "")) || 0))
  const sort = Math.max(0, ...existingSorts)
  return categories.map((category, i) => {
    const n = top + 1 + i
    return { id: `p${String(n).padStart(2, "0")}`, sku: `G4-${(category.replace(/[^A-Za-z]/g, "").slice(0, 3) || "NEW").toUpperCase()}-${String(n).padStart(3, "0")}`, sort: sort + 1 + i }
  })
}
