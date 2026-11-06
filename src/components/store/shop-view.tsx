"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { SECTIONS, inSection, type Section } from "@/lib/departments"
import { searchProducts } from "@/lib/search"
import { pad, sortedForGrid } from "@/lib/store"
import { useCatalog } from "./catalog"
import { IndexList } from "./index-list"
import { ProductCard } from "./product-card"
import { Rise } from "./fx"

type View = "grid" | "index"

export function ShopView({ initial, initialSection = "all", query = "" }: { initial: string; initialSection?: Section | "all"; query?: string }) {
  const { shop, categories: allCategories, sections } = useCatalog()
  // Men / Women only exist as a choice when both sides have products
  const [section, setSection] = useState<Section | "all">(sections.some((s) => s.key === initialSection) ? initialSection : "all")
  const [cat, setCat] = useState(allCategories.includes(initial as never) ? initial : "All")
  const [view, setView] = useState<View>("grid")

  // a search narrows the shop first (best match first); the category tabs then narrow it further
  const searched = useMemo(() => (query ? searchProducts(shop, query) : shop), [shop, query])
  const base = useMemo(() => (section === "all" ? searched : searched.filter((p) => inSection(p, section))), [searched, section])
  // categories shown are the ones that have something in this section
  const categories = useMemo(() => allCategories.filter((c) => base.some((p) => p.category === c)), [allCategories, base])
  const activeCat = cat !== "All" && !categories.includes(cat) ? "All" : cat
  const list = useMemo(() => sortedForGrid(activeCat === "All" ? base : base.filter((p) => p.category === activeCat)), [activeCat, base])
  const tabs = ["All", ...categories]
  const count = (c: string) => (c === "All" ? base.length : base.filter((p) => p.category === c).length)
  const sectionLabel = SECTIONS.find((s) => s.key === section)?.label

  const sync = (s: Section | "all", c: string) => {
    try {
      const params = new URLSearchParams()
      if (s !== "all") params.set("d", s)
      if (c !== "All") params.set("c", c)
      if (query) params.set("q", query)
      window.history.replaceState(null, "", params.size ? `/shop?${params}` : "/shop")
    } catch {}
  }
  const pick = (c: string) => {
    setCat(c)
    sync(section, c)
  }
  const pickSection = (s: Section | "all") => {
    setSection(s)
    // keep the category only if the new section has it
    const keep = s === "all" || searched.some((p) => inSection(p, s) && p.category === cat) ? cat : "All"
    setCat(keep)
    sync(s, keep)
  }

  return (
    <div className="px-5 pb-10 pt-28 md:px-8 md:pt-36">
      <div className="flex items-end justify-between">
        <Rise as="h1" text={query ? "Search" : activeCat !== "All" ? activeCat : sectionLabel ?? "Shop"} className="text-[clamp(3rem,10vw,9rem)] font-medium leading-[0.85] tracking-[-0.06em]" />
        <span className="label pb-2">{pad(list.length)} items</span>
      </div>
      {sections.length > 0 && (
        <div className="label mt-6 flex gap-6" role="tablist" aria-label="Department">
          {([{ key: "all" as const, label: "All" }, ...sections]).map((s) => (
            <button key={s.key} role="tab" aria-selected={section === s.key} onClick={() => pickSection(s.key)} data-cursor="FILTER" className={section === s.key ? "" : "text-[var(--mute)] transition-colors hover:text-[var(--ink)]"}>
              <span className={section === s.key ? "u !bg-[length:100%_1px]" : "u"}>{s.label}</span>
            </button>
          ))}
        </div>
      )}
      {query && (
        <p className="label mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[var(--mute)]">
          <span>Results for “{query}”</span>
          <Link href={activeCat === "All" ? "/shop" : `/shop?c=${encodeURIComponent(activeCat)}`} className="u text-[var(--ink)]" data-cursor="CLEAR">Clear search</Link>
        </p>
      )}

      <div className="sticky top-[52px] z-30 -mx-5 mt-10 flex items-center justify-between gap-6 border-y bg-[var(--paper)]/90 px-5 backdrop-blur-md md:-mx-8 md:px-8">
        <div className="no-scrollbar flex gap-6 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t} onClick={() => pick(t)} data-cursor="FILTER" className="label relative shrink-0 py-4">
              <span className={activeCat === t ? "" : "text-[var(--mute)] transition-colors hover:text-[var(--ink)]"}>
                {t} <sup className="text-[8px]">{count(t)}</sup>
              </span>
              {activeCat === t && <motion.span layoutId="tab-line" className="absolute inset-x-0 -bottom-[1px] h-px bg-[var(--ink)]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
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
        {query && list.length === 0 && (
          <p className="max-w-md text-[15px] leading-relaxed">Nothing matches “{query}”{activeCat !== "All" ? ` in ${activeCat}` : ""}. Check the spelling, or <Link href="/shop" className="u">browse everything</Link>.</p>
        )}
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
