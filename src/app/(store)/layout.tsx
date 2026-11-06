import type { Metadata } from "next"
import { CartProvider } from "@/components/store/cart"
import { CatalogProvider } from "@/components/store/catalog"
import { Cursor, Preloader, SmoothScroll } from "@/components/store/fx"
import { StoreFooter } from "@/components/store/footer"
import { StoreHeader } from "@/components/store/header"
import { Tracker } from "@/components/store/tracker"
import { WelcomePopup } from "@/components/store/welcome-popup"
import { getCatalog, getCategoryNames } from "@/lib/source"

// Stock and prices change from the admin, so never serve a stale build.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: { default: "G4 — Clothing", template: "%s — G4" },
  description: "G4 clothing. Heavyweight basics, clean cuts.",
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const products = await getCatalog()
  const categoryNames = await getCategoryNames(products)
  return (
    <div className="store min-h-dvh">
      <CatalogProvider products={products} categoryNames={categoryNames}>
      <CartProvider>
        <Preloader />
        <SmoothScroll />
        <Cursor />
        <StoreHeader />
        <main>{children}</main>
        <StoreFooter />
        <WelcomePopup />
        <Tracker />
      </CartProvider>
      </CatalogProvider>
    </div>
  )
}
