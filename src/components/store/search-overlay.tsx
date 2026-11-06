"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { searchProducts } from "@/lib/search"
import { pad, sortedForGrid } from "@/lib/store"
import { useCatalog } from "./catalog"
import { ProductCard } from "./product-card"

const EASE = [0.76, 0, 0.24, 1] as const

/** Full-screen store search. Results update as you type; Enter shows them all on the shop page. */
export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { shop, categories } = useCatalog()
  const router = useRouter()
  const [q, setQ] = useState("")
  const input = useRef<HTMLInputElement>(null)

  const results = useMemo(() => searchProducts(shop, q), [shop, q])
  const typed = q.trim().length > 0
  // shown before anything is typed: the first few pieces in the shop (in stock first)
  const suggested = useMemo(() => sortedForGrid(shop).slice(0, 4), [shop])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => input.current?.focus(), 350)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  const close = () => {
    onClose()
    setQ("")
  }
  const seeAll = () => {
    if (!typed) return
    router.push(`/shop?q=${encodeURIComponent(q.trim())}`)
    close()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          data-lenis-prevent
          className="store fixed inset-0 z-[60] overflow-y-auto bg-[var(--paper)] px-5 pb-16 pt-5 text-[var(--ink)] md:px-8"
          initial={{ clipPath: "inset(0 0 100% 0)" }}
          animate={{ clipPath: "inset(0 0 0% 0)" }}
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="flex h-[32px] items-center justify-between">
            <span className="label text-[var(--mute)]">Search</span>
            <button onClick={close} className="label -m-3 p-3" data-cursor="CLOSE">
              <span className="u">Close</span>
            </button>
          </div>

          <form
            role="search"
            className="mt-10 border-b border-[var(--ink)] md:mt-16"
            onSubmit={(e) => {
              e.preventDefault()
              seeAll()
            }}
          >
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Search the shop"
              aria-label="Search the shop"
              className="w-full bg-transparent pb-3 text-[clamp(2.2rem,7vw,6rem)] font-medium leading-none tracking-[-0.05em] outline-none placeholder:text-[var(--ink)]/20 [&::-webkit-search-cancel-button]:hidden"
            />
          </form>

          <div className="label mt-4 flex items-center justify-between text-[var(--mute)]" aria-live="polite">
            <span>{typed ? (results.length ? `${pad(results.length)} ${results.length === 1 ? "result" : "results"}` : "No results") : "Name, colour, category…"}</span>
            {typed && results.length > 0 && (
              <button onClick={seeAll} className="text-[var(--ink)]" data-cursor="GO">
                <span className="u">Press enter to see all</span>
              </button>
            )}
          </div>

          <div className="mt-10 md:mt-14">
            {typed && results.length > 0 && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4 md:gap-x-6" onClick={(e) => (e.target as HTMLElement).closest("a") && close()}>
                {results.slice(0, 8).map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 4} />
                ))}
              </div>
            )}

            {typed && results.length === 0 && (
              <div className="max-w-md">
                <p className="text-[15px] leading-relaxed">
                  Nothing matches <span className="font-medium">“{q.trim()}”</span>. Check the spelling, or try a category.
                </p>
                <div className="label mt-6 flex flex-wrap gap-x-6 gap-y-3">
                  {categories.map((c) => (
                    <Link key={c} href={`/shop?c=${encodeURIComponent(c)}`} onClick={close} className="u">{c}</Link>
                  ))}
                  <Link href="/shop" onClick={close} className="u">All products</Link>
                </div>
              </div>
            )}

            {!typed && (
              <>
                <div className="label flex flex-wrap gap-x-6 gap-y-3">
                  <span className="text-[var(--mute)]">Browse</span>
                  {categories.map((c) => (
                    <Link key={c} href={`/shop?c=${encodeURIComponent(c)}`} onClick={close} className="u">{c}</Link>
                  ))}
                </div>
                {suggested.length > 0 && (
                  <>
                    <p className="label mt-12 text-[var(--mute)]">Start here</p>
                    <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4 md:gap-x-6" onClick={(e) => (e.target as HTMLElement).closest("a") && close()}>
                      {suggested.map((p) => (
                        <ProductCard key={p.id} product={p} showIndex={false} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
