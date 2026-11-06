import Link from "next/link"
import { Rise } from "./fx"

/** The "page not found" message, in the store's style. Shown inside the store (with its header and footer) and, for mistyped addresses, on its own. */
export function NotFoundContent() {
  return (
    <div className="px-5 pb-24 pt-32 md:px-8 md:pt-44">
      <p className="label mb-6 text-[var(--mute)]">( 404 )</p>
      <Rise as="h1" text="Page not found." className="text-[clamp(3rem,10vw,9rem)] font-medium leading-[0.85] tracking-[-0.06em]" />
      <p className="mt-10 max-w-[42ch] text-[15px] leading-relaxed text-[var(--mute)]">
        The page you are looking for may have moved, sold out of the catalogue, or the link may not be quite right.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/shop" data-cursor="SHOP" className="label group relative overflow-hidden bg-[var(--ink)] px-8 py-4 text-[var(--paper)]">
          <span className="absolute inset-0 origin-bottom scale-y-0 bg-[var(--paper)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100" />
          <span className="relative mix-blend-difference">Shop all</span>
        </Link>
        <Link href="/" className="label border border-[var(--ink)] px-8 py-4 transition-colors duration-500 hover:bg-[var(--ink)] hover:text-[var(--paper)]">Back home</Link>
      </div>
    </div>
  )
}
