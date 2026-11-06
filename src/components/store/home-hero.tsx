"use client"

import { useRef } from "react"
import Link from "next/link"
import { motion, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from "motion/react"
import { type ShopProduct } from "@/lib/store"
import { PriceTag } from "./price-tag"
import { useCatalog } from "./catalog"
import { ProductMedia } from "./product-media"
import { Magnetic, useIntroReady } from "./fx"

/** id, tailwind position/size classes (mobile first), parallax depth */
const FLOATERS = [
  { id: "p05", cls: "left-[5%] top-[17%] w-[40vw] md:left-[6%] md:top-[19%] md:w-[19vw]", depth: 0.5, speed: -90 },
  { id: "p12", cls: "right-[6%] top-[28%] w-[34vw] md:left-[30%] md:right-auto md:top-[44%] md:w-[15vw]", depth: 1, speed: -190 },
  { id: "p06", cls: "left-[26%] top-[56%] w-[36vw] md:left-[52%] md:top-[15%] md:w-[17vw]", depth: 0.7, speed: -60 },
  { id: "p10", cls: "hidden md:block md:right-[7%] md:top-[34%] md:w-[20vw]", depth: 1.2, speed: -140 },
]

export function HomeHero() {
  const { shop, shopById } = useCatalog()
  const ref = useRef<HTMLElement>(null)
  const ready = useIntroReady()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const mx = useSpring(useMotionValue(0), { stiffness: 80, damping: 20 })
  const my = useSpring(useMotionValue(0), { stiffness: 80, damping: 20 })
  const word = useTransform(scrollYProgress, [0, 1], ["0%", "28%"])
  const wordScale = useTransform(scrollYProgress, [0, 1], [1, 1.12])

  return (
    <section
      ref={ref}
      className="relative h-[100svh] min-h-[560px] overflow-hidden"
      onPointerMove={(e) => {
        mx.set((e.clientX / window.innerWidth - 0.5) * 2)
        my.set((e.clientY / window.innerHeight - 0.5) * 2)
      }}
    >
      <motion.div style={{ y: word, scale: wordScale }} className="pointer-events-none absolute inset-x-0 bottom-[-6vw] select-none text-center text-[min(62vw,72vh)] font-semibold leading-[0.72] tracking-[-0.07em]" aria-hidden>
        <span className="inline-block overflow-hidden">
          <motion.span className="inline-block" initial={{ y: "100%" }} animate={ready ? { y: 0 } : {}} transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}>
            G4
          </motion.span>
        </span>
      </motion.div>

      {FLOATERS.map((f, i) => {
        const p = shopById.get(f.id) ?? shop[i]
        return p ? <Floater key={f.id} {...f} p={p} i={i} ready={ready} mx={mx} my={my} scroll={scrollYProgress} /> : null
      })}

      <div className="label pointer-events-none absolute inset-x-0 top-0 flex justify-between px-5 pt-20 md:px-8 md:pt-24">
        <span>FW26 / Clothing</span>
        <span className="hidden md:block">Heavyweight basics</span>
        <span>19 pieces</span>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-5 pb-6 md:px-8 md:pb-8">
        <div className="label flex items-center gap-3">
          <span className="relative block h-8 w-px overflow-hidden bg-[var(--line)]">
            <motion.span className="absolute inset-x-0 top-0 h-3 bg-[var(--ink)]" animate={{ y: [-12, 32] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
          </span>
          Scroll
        </div>
        <Magnetic>
          <Link href="/shop" data-cursor="ENTER" className="label group flex items-center gap-3 border border-[var(--ink)] bg-[var(--paper)] px-5 py-4 transition-colors duration-500 hover:bg-[var(--ink)] hover:text-[var(--paper)]">
            Enter shop <span className="transition-transform duration-500 group-hover:translate-x-1">→</span>
          </Link>
        </Magnetic>
      </div>
    </section>
  )
}

function Floater({ p, cls, depth, speed, i, ready, mx, my, scroll }: { p: ShopProduct; cls: string; depth: number; speed: number; i: number; ready: boolean; mx: MotionValue<number>; my: MotionValue<number>; scroll: MotionValue<number> }) {
  const px = useTransform(mx, (v) => v * 16 * depth)
  const py = useTransform(my, (v) => v * 12 * depth)
  const sy = useTransform(scroll, [0, 1], [0, speed])
  return (
    <motion.div className={`absolute ${cls}`} style={{ x: px, y: sy }}>
      <motion.div style={{ y: py }}>
        <Link href={p.href} data-cursor="VIEW" className="group block">
          <motion.div
            className="relative aspect-[4/5] overflow-hidden bg-[var(--paper-2)]"
            initial={{ clipPath: "inset(100% 0 0 0)" }}
            animate={ready ? { clipPath: "inset(0% 0 0 0)" } : {}}
            transition={{ duration: 1.2, delay: 0.25 + i * 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="absolute inset-0 transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]">
              <ProductMedia product={p} priority sizes="(min-width: 768px) 20vw, 40vw" />
            </div>
          </motion.div>
          <motion.div className="label flex justify-between gap-3 bg-[var(--paper)] pt-2" initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : {}} transition={{ delay: 0.9 + i * 0.14, duration: 0.8 }}>
            <span>{p.name}</span>
            <PriceTag p={p} />
          </motion.div>
        </Link>
      </motion.div>
    </motion.div>
  )
}
