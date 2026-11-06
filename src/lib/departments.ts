/** Men / Women sections. A product is in one department, or "unisex" (listed under both). Categories sit under each. */

export type Department = "men" | "women" | "unisex"
/** the sections shoppers browse */
export type Section = "men" | "women"

export const SECTIONS: { key: Section; label: string }[] = [
  { key: "men", label: "Men" },
  { key: "women", label: "Women" },
]

export const DEPARTMENT_OPTIONS: { value: Department; label: string }[] = [
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "unisex", label: "Unisex (shown in both)" },
]

export const departmentLabel = (d: Department) => ({ men: "Men", women: "Women", unisex: "Unisex" })[d] ?? "Men"
export const isSection = (s: string | undefined | null): s is Section => s === "men" || s === "women"
export const isDepartment = (s: string): s is Department => s === "men" || s === "women" || s === "unisex"

/** Unisex products appear in both sections. */
export const inSection = (p: { department: Department }, s: Section) => p.department === s || p.department === "unisex"

/** Which side(s) of the store a category belongs to. */
export type CategoryDepartment = "men" | "women" | "both"
export const CATEGORY_DEPARTMENT_OPTIONS: { value: CategoryDepartment; label: string }[] = [
  { value: "both", label: "Both Men and Women" },
  { value: "men", label: "Men only" },
  { value: "women", label: "Women only" },
]
export const categoryDepartmentLabel = (d: CategoryDepartment) => ({ both: "Men & Women", men: "Men", women: "Women" })[d] ?? "Men & Women"
export const isCategoryDepartment = (s: string): s is CategoryDepartment => s === "men" || s === "women" || s === "both"

/** Can a product in this department use a category of that department? (Unisex products can use any.) */
export const categoryFits = (category: CategoryDepartment, product: Department) => category === "both" || product === "unisex" || category === product

/** The department a new category should get when it is created from a product: that product's side (unisex = both). */
export const categoryDepartmentFor = (product: Department): CategoryDepartment => (product === "unisex" ? "both" : product)
