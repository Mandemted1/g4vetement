"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { pad, sortedForGrid } from "@/lib/store"
import { useCatalog } from "./catalog"
import { IndexList } from "./index-list"
import { ProductCard } from "./product-card"
import { Rise } from "./fx"

type View = "grid" | "index"

export function ShopView({ initial }: { initial: string }) {
  const { shop, categories } = useCatalog()
  const [cat, setCat] = useState(categories.includes(initial as never) ? initial : "All")
  const [view, setView] = useState<View>("grid")

  const list = useMemo(() => sortedForGrid(cat === "All" ? shop : shop.filter((p) => p.category === cat)), [cat, shop])
  const tabs = ["All", ...categories]
  const count = (c: string) => (c === "All" ? shop.length : shop.filter((p) => p.category === c).length)

  const pick = (c: string) => {
    setCat(c)
    try {
      window.history.replaceState(null, "", c === "All" ? "/shop" : `/shop?c=${encodeURIComponent(c)}`)
    } catch {}
  }

  return (
    <div className="px-5 pb-10 pt-28 md:px-8 md:pt-36">
      <div className="flex items-end justify-between">
        <Rise as="h1" text={cat === "All" ? "Shop" : cat} className="text-[clamp(3rem,10vw,9rem)] font-medium leading-[0.85] tracking-[-0.06em]" />
        <span className="label pb-2">{pad(list.length)} items</span>
      </div>

      <div className="sticky top-[52px] z-30 -mx-5 mt-10 flex items-center justify-between gap-6 border-y bg-[var(--paper)]/90 px-5 backdrop-blur-md md:-mx-8 md:px-8">
        <div className="no-scrollbar flex gap-6 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t} onClick={() => pick(t)} data-cursor="FILTER" className="label relative shrink-0 py-4">
              <span className={cat === t ? "" : "text-[var(--mute)] transition-colors hover:text-[var(--ink)]"}>
                {t} <sup className="text-[8px]">{count(t)}</sup>
              </span>
              {cat === t && <motion.span layoutId="tab-line" className="absolute inset-x-0 -bottom-[1px] h-px bg-[var(--ink)]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
            </button>
          ))}
        </div>
        <div className="label flex shrink-0 gap-4">
          {(["grid", "index"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} data-cursor={v === "grid" ? "GRID" : "INDEX"} className={`py-4 ${view === v ? "" : "text-[var(--mute)]"}`}>
              <span className={view === v ? "u !bg-[length:100%_1px]" : "u"}>{v}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 md:mt-14">
        {view === "grid" ? (
          <motion.div layout className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-3 md:gap-x-6 md:gap-y-20 lg:grid-cols-4 lg:[&>div:nth-child(4n+2)]:mt-14 lg:[&>div:nth-child(4n+4)]:mt-28">
            <AnimatePresence mode="popLayout" initial={false}>
              {list.map((p, i) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.8, delay: Math.min(i, 8) * 0.045, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ProductCard product={p} priority={i < 4} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <IndexList products={list} />
        )}
      </div>
    </div>
  )
}
