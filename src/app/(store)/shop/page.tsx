import type { Metadata } from "next"
import { ShopView } from "@/components/store/shop-view"

export const metadata: Metadata = { title: "Shop" }

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams
  return <ShopView key={c ?? "all"} initial={c ?? "All"} />
}
