/**
 * Product CSV: the export format, and the planner that checks an uploaded file before anything is saved.
 * Pure: it is handed the current products and categories and returns what it WOULD do, or what's wrong with the file.
 */
import { nearestColorName, parseColor } from "./colors"
import { parseCsvRecords, restore, toCsv } from "./csv"
import type { Product } from "./data"
import type { CategoryDepartment } from "./departments"
import { isDepartment } from "./departments"
import { GARMENT_TYPES, isGarmentType, validateProduct, type ProductInput } from "./product-input"
import { evenSplit } from "./stock"

export const MAX_IMPORT_ROWS = 500

/** Column order of the export (and of the downloadable template). */
export const PRODUCT_COLUMNS = ["id", "sku", "name", "department", "category", "type", "price", "reorder_level", "active", "description", "fabric", "fit", "colors", "sizes", "stock_by_size", "total_stock", "images"] as const

const KNOWN = new Set<string>([...PRODUCT_COLUMNS, "stock"])

/* ---------------- export ---------------- */

const colorsCell = (p: Pick<Product, "colors">) => p.colors.map((c) => `${c.name}:${c.hex}`).join("|")
const stockCell = (p: Pick<Product, "sizes" | "sizeStock">) => p.sizes.map((s) => `${s}:${p.sizeStock[s] ?? 0}`).join("|")

export function productsToCsv(products: Product[]): string {
  return toCsv(
    [...PRODUCT_COLUMNS],
    products.map((p) => [p.id, p.sku, p.name, p.department, p.category, p.type, p.price, p.reorderLevel, p.active, p.description, p.fabric, p.fit, colorsCell(p), p.sizes.join("|"), stockCell(p), p.stock, p.images.join("|")]),
  )
}

/** A header row plus one example, for people starting a spreadsheet from scratch. */
export function productTemplateCsv(): string {
  return toCsv([...PRODUCT_COLUMNS], [["", "", "Example Tee", "women", "Tees", "tee", 40, 10, true, "A soft everyday tee.", "100% cotton", "Regular. True to size.", "Black:#141414|Sand:#d4c5a3", "S|M|L", "S:5|M:5|L:5", "", ""]])
}

/* ---------------- import ---------------- */

export interface ExistingProduct extends ProductInput {
  id: string
  sku: string
}

export interface ImportRow {
  line: number
  action: "create" | "update" | "unchanged"
  id?: string
  sku?: string
  name: string
  input: ProductInput
  /** for updates: what differs ("price", "stock", ...) */
  changes: string[]
}
export interface ImportPlan {
  rows: ImportRow[]
  errors: { line: number; message: string }[]
  /** columns in the file we don't use */
  ignoredColumns: string[]
  /** categories that don't exist yet and will be created */
  newCategories: { name: string; department: CategoryDepartment }[]
  counts: { create: number; update: number; unchanged: number }
  fatal?: string
}

const TRUE = new Set(["true", "yes", "y", "1", "active", "visible", "on"])
const FALSE = new Set(["false", "no", "n", "0", "hidden", "off", "inactive"])
const split = (v: string) => v.split(/[|;]/).map((x) => x.trim()).filter(Boolean)

function parseInt0(raw: string, what: string): number | string {
  const t = raw.replace(/[$,\s]/g, "")
  if (!/^-?\d+(\.0+)?$/.test(t)) return `${what} must be a whole number (got “${raw}”)`
  return Number(t)
}

function parseColors(raw: string): { name: string; hex: string }[] | string {
  const out: { name: string; hex: string }[] = []
  for (const part of split(raw)) {
    const i = part.lastIndexOf(":")
    const left = i > 0 ? part.slice(0, i).trim() : ""
    const right = i > 0 ? part.slice(i + 1).trim() : ""
    if (left && parseColor(right)) out.push({ name: left, hex: parseColor(right)! })                        // Name:#hex
    else if (parseColor(part)) out.push({ name: /^#?[0-9a-f]{3,6}$/i.test(part) ? nearestColorName(parseColor(part)!) : part, hex: parseColor(part)! })  // #hex alone, or a known colour name
    else return `“${part}” isn't a colour. Write it as Name:#hex, like Black:#141414`
  }
  return out
}

function parseStock(raw: string, sizes: string[]): Record<string, number> | string {
  const out: Record<string, number> = {}
  for (const part of split(raw)) {
    const i = part.lastIndexOf(":")
    if (i < 1) return `Stock must look like S:5|M:3 (got “${part}”)`
    const size = part.slice(0, i).trim()
    const n = parseInt0(part.slice(i + 1), `Stock for ${size}`)
    if (typeof n === "string") return n
    if (!sizes.some((s) => s.toLowerCase() === size.toLowerCase())) return `Stock names size “${size}”, which isn't one of the sizes (${sizes.join(", ")})`
    out[sizes.find((s) => s.toLowerCase() === size.toLowerCase())!] = n
  }
  return out
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function diff(before: ProductInput, after: ProductInput): string[] {
  const out: string[] = []
  const check = (label: string, a: unknown, b: unknown) => { if (!same(a, b)) out.push(label) }
  check("name", before.name.trim(), after.name.trim()); check("department", before.department, after.department); check("category", before.category.trim(), after.category.trim())
  check("shape", before.type, after.type); check("price", before.price, after.price); check("reorder level", before.reorderLevel, after.reorderLevel)
  check("description", before.description, after.description); check("fabric", before.fabric, after.fabric); check("fit", before.fit, after.fit); check("visibility", before.active, after.active)
  check("colours", before.colors.map((c) => [c.name.trim(), c.hex.toLowerCase()]), after.colors.map((c) => [c.name.trim(), c.hex.toLowerCase()]))
  check("sizes", before.sizes, after.sizes); check("stock", before.sizes.map((s) => before.sizeStock[s] ?? 0), after.sizes.map((s) => after.sizeStock[s] ?? 0)); check("photos", before.images, after.images)
  return out
}

/**
 * Works out what a CSV would do. Rows are matched to products by `id`, else by `sku`; no match means a new product.
 * For an existing product only the columns present in the file change; everything else is left as it is.
 * Nothing is saved here. If `errors` is not empty, the file must not be applied.
 */
export function planProductImport(csv: string, existing: ExistingProduct[], categories: { name: string; department: CategoryDepartment }[]): ImportPlan {
  const plan: ImportPlan = { rows: [], errors: [], ignoredColumns: [], newCategories: [], counts: { create: 0, update: 0, unchanged: 0 } }
  const { headers, records, error } = parseCsvRecords(csv)
  if (error) return { ...plan, fatal: error }
  const has = (h: string) => headers.includes(h)
  plan.ignoredColumns = headers.filter((h) => h && !KNOWN.has(h))
  if (!has("name") && !has("id") && !has("sku")) return { ...plan, fatal: "The first row must be column titles, and include at least `name` (or `id`). Download the template to see the format." }
  if (records.length === 0) return { ...plan, fatal: "The file has no products in it (only the title row)." }
  if (records.length > MAX_IMPORT_ROWS) return { ...plan, fatal: `That's ${records.length} rows. Import up to ${MAX_IMPORT_ROWS} at a time.` }

  const byId = new Map(existing.map((p) => [p.id.toLowerCase(), p]))
  const bySku = new Map(existing.map((p) => [p.sku.toLowerCase(), p]))
  const catByLower = new Map(categories.map((c) => [c.name.toLowerCase(), c.name]))
  const seen = new Set<string>()
  const newSkus = new Set<string>()
  const newCats = new Map<string, { name: string; departments: Set<string> }>()

  for (const { line, values: v } of records) {
    const fail = (message: string) => { plan.errors.push({ line, message }) }
    const id = (v.id ?? "").trim()
    const sku = (v.sku ?? "").trim()
    let current: ExistingProduct | undefined
    if (id) {
      current = byId.get(id.toLowerCase())
      if (!current) { fail(`There's no product with the id “${id}”. Leave the id empty to add a new product.`); continue }
    } else if (sku) current = bySku.get(sku.toLowerCase())
    if (current) {
      if (seen.has(current.id)) { fail(`This is the same product (${current.id}) as an earlier row.`); continue }
      seen.add(current.id)
    }

    // start from what exists (or sensible defaults for a new product), then apply the columns the file provides
    const base: ProductInput = current
      ? structuredClone({ name: current.name, department: current.department, category: current.category, type: current.type, price: current.price, sizeStock: current.sizeStock, reorderLevel: current.reorderLevel, description: current.description, fabric: current.fabric, fit: current.fit, active: current.active, colors: current.colors, sizes: current.sizes, images: current.images })
      : { name: "", department: "men", category: "", type: "other", price: 0, sizeStock: {}, reorderLevel: 10, description: "", fabric: "", fit: "", active: true, colors: [], sizes: [], images: [] }
    const p = base
    let problem = ""
    const provided = (h: string) => has(h) && (v[h] ?? "") !== ""

    if (!current) {
      for (const need of ["name", "category", "price", "colors", "sizes"] as const) if (!provided(need)) problem ||= `A new product needs a ${need} (column “${need}” is empty or missing).`
      if (problem) { fail(problem); continue }
    }
    if (provided("name")) p.name = restore(v.name)
    if (provided("department")) { const d = v.department.toLowerCase(); if (isDepartment(d)) p.department = d; else problem ||= `Department must be men, women or unisex (got “${v.department}”).` }
    if (provided("category")) p.category = catByLower.get(restore(v.category).toLowerCase()) ?? restore(v.category)
    if (provided("type")) { const t = v.type.toLowerCase(); if (isGarmentType(t)) p.type = t; else problem ||= `Shape “${v.type}” isn't one we draw. Use one of: ${GARMENT_TYPES.join(", ")}.` }
    if (provided("price")) { const n = parseInt0(v.price, "Price"); if (typeof n === "string") problem ||= n; else p.price = n }
    if (provided("reorder_level")) { const n = parseInt0(v.reorder_level, "Reorder level"); if (typeof n === "string") problem ||= n; else p.reorderLevel = n }
    if (provided("active")) { const a = v.active.toLowerCase(); if (TRUE.has(a)) p.active = true; else if (FALSE.has(a)) p.active = false; else problem ||= `“active” must be true or false (got “${v.active}”).` }
    if (has("description") && v.description !== undefined && (v.description !== "" || !current)) p.description = restore(v.description)
    if (has("fabric") && v.fabric !== undefined && (v.fabric !== "" || !current)) p.fabric = restore(v.fabric)
    if (has("fit") && v.fit !== undefined && (v.fit !== "" || !current)) p.fit = restore(v.fit)
    if (provided("colors")) { const c = parseColors(v.colors); if (typeof c === "string") problem ||= c; else p.colors = c }
    if (provided("images")) p.images = split(v.images)

    // sizes and stock
    const oldSizes = p.sizes
    if (provided("sizes")) p.sizes = split(v.sizes)
    const carried: Record<string, number> = {}
    for (const s of p.sizes) carried[s] = current && oldSizes.includes(s) ? (current.sizeStock[s] ?? 0) : 0
    p.sizeStock = carried
    if (provided("stock_by_size")) { const st = parseStock(v.stock_by_size, p.sizes); if (typeof st === "string") problem ||= st; else p.sizeStock = { ...carried, ...st } }
    else if (provided("stock")) { const n = parseInt0(v.stock, "Stock"); if (typeof n === "string") problem ||= n; else p.sizeStock = evenSplit(n, p.sizes) }

    if (problem) { fail(problem); continue }
    const bad = validateProduct(p)
    if (bad) { fail(bad + "."); continue }

    // a code the shop already uses, or that appears twice in this file
    if (!current && sku) {
      if (bySku.has(sku.toLowerCase()) || newSkus.has(sku.toLowerCase())) { fail(`The code “${sku}” is already used.`); continue }
      newSkus.add(sku.toLowerCase())
    }
    if (!catByLower.has(p.category.toLowerCase())) {
      const k = p.category.toLowerCase()
      const e = newCats.get(k) ?? { name: p.category, departments: new Set<string>() }
      e.departments.add(p.department === "unisex" ? "both" : p.department)
      newCats.set(k, e)
    }

    const changes = current ? diff(current, p) : []
    const action = !current ? "create" : changes.length ? "update" : "unchanged"
    plan.counts[action]++
    plan.rows.push({ line, action, id: current?.id, sku: current?.sku ?? (sku || undefined), name: p.name.trim(), input: p, changes })
  }

  plan.newCategories = [...newCats.values()].map((c) => ({ name: c.name, department: (c.departments.size === 1 ? [...c.departments][0] : "both") as CategoryDepartment }))
  return plan
}
