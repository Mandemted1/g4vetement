"use client"

import { createContext, useContext, useMemo } from "react"
import type { Product } from "@/lib/data"
import { toShop, type ShopProduct } from "@/lib/store"
import type { StoreSettings } from "@/lib/settings-types"
import type { WelcomeOffer } from "@/lib/offer-types"

interface Ctx {
  shop: ShopProduct[]
  shopById: Map<string, ShopProduct>
  categories: string[]
  store: StoreSettings
  /** null when the WELCOME10 code is switched off: the popup then stays away */
  welcome: WelcomeOffer | null
  /** policy pages that have content, for footer/menu links */
  policyLinks: { slug: string; title: string }[]
}
const C = createContext<Ctx | null>(null)

/** Live product catalog for every client component in the storefront. */
export function CatalogProvider({ products, categoryNames, store, welcome, policyLinks, children }: { products: Product[]; categoryNames: string[]; store: StoreSettings; welcome: WelcomeOffer | null; policyLinks: { slug: string; title: string }[]; children: React.ReactNode }) {
  const value = useMemo(() => {
    const shop = toShop(products)
    // the admin-chosen order, but only categories that currently have a visible product
    const used = new Set(shop.map((p) => p.category))
    return { shop, shopById: new Map(shop.map((p) => [p.id, p])), categories: categoryNames.filter((n) => used.has(n)), store, welcome, policyLinks }
  }, [products, categoryNames, store, welcome, policyLinks])
  return <C.Provider value={value}>{children}</C.Provider>
}

export function useCatalog() {
  const c = useContext(C)
  if (!c) throw new Error("useCatalog outside CatalogProvider")
  return c
}
