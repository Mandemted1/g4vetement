import type { Metadata } from "next"
import Link from "next/link"
import { NotFoundContent } from "@/components/store/not-found-content"

export const metadata: Metadata = { title: { absolute: "Page not found | G4" }, robots: { index: false } }

/** A mistyped address anywhere on the site: a standalone version of the same page, with a simple header. */
export default function NotFound() {
  return (
    <div className="store flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="grid h-[52px] grid-cols-3 items-center px-5 md:px-8">
          <span />
          <Link href="/" className="justify-self-center text-[19px] font-semibold leading-none tracking-[-0.06em]" aria-label="G4 home">G4</Link>
          <Link href="/shop" className="label justify-self-end"><span className="u">Shop</span></Link>
        </div>
      </header>
      <main className="flex-1">
        <NotFoundContent />
      </main>
    </div>
  )
}
