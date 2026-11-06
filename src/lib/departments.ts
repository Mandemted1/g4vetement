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
