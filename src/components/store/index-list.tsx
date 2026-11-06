"use client"

import { useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react"
import { isSoldOut, pad, type ShopProduct } from "@/lib/store"
import { PriceTag } from "./price-tag"
import { ProductMedia } from "./product-media"

/** Text index of products. Hover a row and its image follows the cursor. */
export function IndexList({ products }: { products: ShopProduct[] }) {
  const [hover, setHover] = useState<ShopProduct | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 260, damping: 30, mass: 0.6 })
  const sy = useSpring(y, { stiffness: 260, damping: 30, mass: 0.6 })

  return (
    <div
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return
        const flip = e.clientX > window.innerWidth * 0.6
        x.set(e.clientX + (flip ? -290 : 36))
        y.set(e.clientY - 140)
      }}
      onPointerLeave={() => setHover(null)}
    >
      <ul className="group/list border-t">
        {products.map((p) => {
          const sold = isSoldOut(p)
          return (
            <li key={p.id} className="border-b">
              <Link
                href={p.href}
                onPointerEnter={(e) => e.pointerType === "mouse" && setHover(p)}
                className="group/row grid grid-cols-[auto_1fr_auto] items-center gap-x-4 py-3 transition-opacity duration-300 hover:!opacity-100 group-hover/list:opacity-30 md:grid-cols-[3rem_1.4fr_1fr_1fr_5rem] md:py-4"
              >
                <span className="label text-[var(--mute)] md:order-none">{pad(p.index)}</span>
                <span className="flex items-center gap-3 text-[clamp(1.25rem,2.6vw,2.2rem)] font-medium leading-none tracking-[-0.035em] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/row:translate-x-3">
                  <span className="relative block h-11 w-9 shrink-0 overflow-hidden md:hidden">
                    <ProductMedia product={p} sizes="40px" />
                  </span>
                  {p.name}
                </span>
                <span className="label hidden text-[var(--mute)] md:block">{p.category}</span>
                <span className="label hidden text-[var(--mute)] md:block">{p.colors.map((c) => c.name).join(", ")}</span>
                <span className="label text-right">{sold ? "Sold out" : <PriceTag p={p} />}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      <motion.div style={{ x: sx, y: sy }} className="pointer-events-none fixed left-0 top-0 z-30 hidden md:block">
        <AnimatePresence mode="popLayout">
          {hover && (
            <motion.div
              key={hover.id}
              className="relative h-[280px] w-[224px] overflow-hidden"
              initial={{ clipPath: "inset(100% 0 0 0)", scale: 1.08 }}
              animate={{ clipPath: "inset(0% 0 0 0)", scale: 1 }}
              exit={{ clipPath: "inset(0 0 100% 0)" }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <ProductMedia product={hover} sizes="224px" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
