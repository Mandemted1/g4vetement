import type { Metadata } from "next"
import { ShopView } from "@/components/store/shop-view"
import { isSection } from "@/lib/departments"

export const metadata: Metadata = { title: "Shop" }

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string; d?: string }> }) {
  const { c, q, d } = await searchParams
  return <ShopView key={`${d ?? ""}|${c ?? "all"}|${q ?? ""}`} initial={c ?? "All"} initialSection={isSection(d) ? d : "all"} query={(q ?? "").slice(0, 80)} />
}
