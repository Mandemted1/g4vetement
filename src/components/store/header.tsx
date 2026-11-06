"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { pad } from "@/lib/store"
import { useCatalog } from "./catalog"
import { useCart } from "./cart"

const EASE = [0.76, 0, 0.24, 1] as const

export function StoreHeader() {
  const { count, setOpen, bumped } = useCart()
  const { shop, categories } = useCatalog()
  const [menu, setMenu] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24)
    on()
    window.addEventListener("scroll", on, { passive: true })
    return () => window.removeEventListener("scroll", on)
  }, [])

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menu])

  const links = [
    { label: "All products", href: "/shop", n: shop.length },
    ...categories.map((c) => ({ label: c, href: `/shop?c=${encodeURIComponent(c)}`, n: shop.filter((p) => p.category === c).length })),
  ]

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 text-[var(--ink)] transition-[background-color,backdrop-filter,border-color] duration-500 ${scrolled && !menu ? "border-b bg-[var(--paper)]/80 backdrop-blur-md" : "border-b border-transparent"}`}>
        <div className="grid h-[52px] grid-cols-3 items-center px-5 md:px-8">
          <button onClick={() => setMenu((m) => !m)} className="label -m-3 justify-self-start p-3" aria-expanded={menu} data-cursor={menu ? "CLOSE" : "MENU"}>
            <span className="u">{menu ? "Close" : "Menu"}</span>
          </button>
          <Link href="/" onClick={() => setMenu(false)} className="-m-3 justify-self-center p-3 text-[19px] font-semibold leading-none tracking-[-0.06em]" aria-label="G4 home">
            G4
          </Link>
          <button id="bag-link" onClick={() => setOpen(true)} className="label -m-3 justify-self-end p-3" data-cursor="BAG">
            <span className="u">
              Bag (<span key={bumped} className={bumped ? "bump inline-block" : "inline-block"}>{count}</span>)
            </span>
          </button>
        </div>
      </header>

      <AnimatePresence>
        {menu && (
          <motion.nav
            data-lenis-prevent
            className="store fixed inset-0 z-40 flex flex-col justify-between overflow-y-auto bg-[var(--paper)] px-5 pb-8 pt-24 text-[var(--ink)] md:px-8"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <ul className="group/list">
              {links.map((l, i) => (
                <li key={l.href} className="overflow-hidden border-b first:border-t">
                  <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.25 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}>
                    <Link
                      href={l.href}
                      onClick={() => setMenu(false)}
                      data-cursor="GO"
                      className="flex items-baseline justify-between py-3 text-[clamp(2.2rem,8.5vw,6.5rem)] font-medium leading-[0.95] tracking-[-0.045em] transition-opacity duration-300 hover:!opacity-100 group-hover/list:opacity-25 md:py-4"
                    >
                      <span>{l.label}</span>
                      <span className="label tracking-normal">{pad(l.n)}</span>
                    </Link>
                  </motion.div>
                </li>
              ))}
            </ul>
            <motion.div className="mt-10 flex flex-wrap items-end justify-between gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }}>
              <p className="label max-w-[28ch] text-[var(--mute)]">Free shipping on orders over $100. $9 flat rate below.</p>
              <div className="label flex gap-6">
                <Link href="/admin" className="u">Admin</Link>
              </div>
            </motion.div>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  )
}
