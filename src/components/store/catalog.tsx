"use client"

import { createContext, useContext, useMemo } from "react"
import type { Product } from "@/lib/data"
import { categoriesOf, toShop, type ShopProduct } from "@/lib/store"

interface Ctx {
  shop: ShopProduct[]
  shopById: Map<string, ShopProduct>
  categories: string[]
}
const C = createContext<Ctx | null>(null)

/** Live product catalog for every client component in the storefront. */
export function CatalogProvider({ products, children }: { products: Product[]; children: React.ReactNode }) {
  const value = useMemo(() => {
    const shop = toShop(products)
    return { shop, shopById: new Map(shop.map((p) => [p.id, p])), categories: categoriesOf(shop) }
  }, [products])
  return <C.Provider value={value}>{children}</C.Provider>
}

export function useCatalog() {
  const c = useContext(C)
  if (!c) throw new Error("useCatalog outside CatalogProvider")
  return c
}
