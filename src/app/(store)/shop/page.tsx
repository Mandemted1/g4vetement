import type { Metadata } from "next"
import { ShopView } from "@/components/store/shop-view"

export const metadata: Metadata = { title: "Shop" }

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const { c, q } = await searchParams
  return <ShopView key={`${c ?? "all"}|${q ?? ""}`} initial={c ?? "All"} query={(q ?? "").slice(0, 80)} />
}
