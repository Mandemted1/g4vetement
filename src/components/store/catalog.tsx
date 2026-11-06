"use client"

import { createContext, useContext, useMemo } from "react"
import type { Product } from "@/lib/data"
import { toShop, type ShopProduct } from "@/lib/store"
import type { StoreSettings } from "@/lib/settings-types"
import type { WelcomeOffer } from "@/lib/offer-types"
import type { ShippingZone } from "@/lib/shipping"
import { SECTIONS, inSection, type Section } from "@/lib/departments"

interface Ctx {
  shop: ShopProduct[]
  shopById: Map<string, ShopProduct>
  categories: string[]
  /** Men / Women sections, each with its own categories. Empty unless both sides have products (then the shop stays one flat list). */
  sections: { key: Section; label: string; count: number; categories: string[] }[]
  store: StoreSettings
  /** null when the WELCOME10 code is switched off: the popup then stays away */
  welcome: WelcomeOffer | null
  /** policy pages that have content, for footer/menu links */
  policyLinks: { slug: string; title: string }[]
  /** where the store ships, what it costs (active zones) */
  shipping: ShippingZone[]
}
const C = createContext<Ctx | null>(null)

/** Live product catalog for every client component in the storefront. */
export function CatalogProvider({ products, categoryNames, store, welcome, policyLinks, shipping, children }: { products: Product[]; categoryNames: string[]; store: StoreSettings; welcome: WelcomeOffer | null; policyLinks: { slug: string; title: string }[]; shipping: ShippingZone[]; children: React.ReactNode }) {
  const value = useMemo(() => {
    const shop = toShop(products)
    // the admin-chosen order, but only categories that currently have a visible product
    const used = new Set(shop.map((p) => p.category))
    const categories = categoryNames.filter((n) => used.has(n))
    const secs = SECTIONS.map((s) => {
      const ps = shop.filter((p) => inSection(p, s.key))
      return { key: s.key, label: s.label, count: ps.length, categories: categories.filter((c) => ps.some((p) => p.category === c)) }
    }).filter((s) => s.count > 0)
    return { shop, shopById: new Map(shop.map((p) => [p.id, p])), categories, sections: secs.length >= 2 ? secs : [], store, welcome, policyLinks, shipping }
  }, [products, categoryNames, store, welcome, policyLinks, shipping])
  return <C.Provider value={value}>{children}</C.Provider>
}

export function useCatalog() {
  const c = useContext(C)
  if (!c) throw new Error("useCatalog outside CatalogProvider")
  return c
}
