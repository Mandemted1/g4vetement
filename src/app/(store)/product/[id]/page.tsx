import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ProductView } from "@/components/store/product-view"
import { getCatalog } from "@/lib/source"
import { sortedForGrid, toShop } from "@/lib/store"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const p = toShop(await getCatalog()).find((x) => x.id === id)
  return { title: p?.name ?? "Product", description: p?.description }
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const shop = toShop(await getCatalog())
  const product = shop.find((p) => p.id === id)
  if (!product) notFound()
  const same = sortedForGrid(shop.filter((p) => p.category === product.category && p.id !== product.id))
  const others = sortedForGrid(shop.filter((p) => p.category !== product.category && p.id !== product.id))
  const related = [...same, ...others].slice(0, 4)
  return <ProductView key={product.id} product={product} related={related} />
}
