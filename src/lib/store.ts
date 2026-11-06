import type { GarmentType, Product } from "./data"

export type { GarmentType }

export const FREE_SHIPPING_AT = 100
export const SHIPPING = 9
export const WELCOME_CODE = "WELCOME10"
export const WELCOME_OFF = 10
export const WELCOME_MIN = 50

export interface ShopProduct extends Product {
  type: GarmentType
  href: string
  index: number
}

export const toShop = (products: Product[]): ShopProduct[] =>
  products.filter((p) => p.active).map((p, i) => ({ ...p, href: `/product/${p.id}`, index: i + 1 }))

export const categoriesOf = (shop: ShopProduct[]) => [...new Set(shop.map((p) => p.category))]
export const isSoldOut = (p: Pick<Product, "stock">) => p.stock <= 0
/** In-stock first, sold out last. */
export const sortedForGrid = (list: ShopProduct[]) => [...list].sort((a, b) => Number(isSoldOut(a)) - Number(isSoldOut(b)))
export const price = (n: number) => `$${n}`
export const pad = (n: number) => String(n).padStart(2, "0")
