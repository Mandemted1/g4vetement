"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { price } from "@/lib/store"
import { useCatalog } from "./catalog"
import { ProductMedia } from "./product-media"

export interface SuccessData {
  orderId: string
  total: number
  discount: number
  /** what automatic sales took off (already in the item prices) */
  saleDiscount: number
  shipping: number
  /** after sale, before the code */
  subtotal: number
  email: string
  items: { productId: string; name: string; color: string; colorHex: string; size: string; qty: number; price: number }[]
}

const EASE = [0.22, 1, 0.36, 1] as const

/** Full-screen confirmation shown after a successful checkout. */
export function OrderSuccess({ data, onClose }: { data: SuccessData | null; onClose: () => void }) {
  const { shopById } = useCatalog()

  useEffect(() => {
    if (!data) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [data, onClose])

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          key="success"
          data-lenis-prevent
          role="dialog"
          aria-modal="true"
          aria-label="Order confirmed"
          className="store fixed inset-0 z-[85] overflow-y-auto bg-[var(--paper)] text-[var(--ink)]"
          initial={{ clipPath: "inset(100% 0 0 0)" }}
          animate={{ clipPath: "inset(0% 0 0 0)" }}
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.95, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="mx-auto grid min-h-dvh max-w-[1200px] gap-12 px-5 pb-10 pt-24 md:grid-cols-12 md:gap-8 md:px-8 md:pt-32">
            <div className="flex flex-col justify-between md:col-span-7">
              <div>
                <Check />
                <p className="label mt-8 text-[var(--mute)]">Order confirmed</p>
                <h2 aria-label="Thank you." className="mt-4 overflow-hidden text-[clamp(3.4rem,11vw,9rem)] font-medium leading-[0.86] tracking-[-0.06em]">
                  {["Thank", "you."].map((w, i) => (
                    <span key={w} aria-hidden className="mr-[0.2em] -mb-[0.16em] inline-block overflow-hidden pb-[0.16em] align-bottom">
                      <motion.span className="inline-block" initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 1.1, delay: 0.7 + i * 0.1, ease: EASE }}>
                        {w}
                      </motion.span>
                    </span>
                  ))}
                </h2>
                <motion.p className="mt-8 max-w-[44ch] text-[15px] leading-relaxed text-[var(--mute)]" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.8, ease: EASE }}>
                  We&apos;ve got your order and we&apos;re getting it ready. A confirmation is on its way to <b className="font-medium text-[var(--ink)]">{data.email}</b>.
                </motion.p>
              </div>

              <motion.div className="mt-12 flex flex-wrap gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 0.8 }}>
                <button onClick={onClose} data-cursor="SHOP" className="label group relative overflow-hidden bg-[var(--ink)] px-8 py-4 text-[var(--paper)]">
                  <span className="absolute inset-0 origin-bottom scale-y-0 bg-[var(--paper)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100" />
                  <span className="relative mix-blend-difference">Continue shopping</span>
                </button>
                <Link href="/" onClick={onClose} className="label border border-[var(--ink)] px-8 py-4 transition-colors duration-500 hover:bg-[var(--ink)] hover:text-[var(--paper)]">
                  Home
                </Link>
              </motion.div>
            </div>

            <motion.aside className="border-t md:col-span-5 md:col-start-8 md:border-l md:border-t-0 md:pl-8" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.9, ease: EASE }}>
              <div className="flex items-baseline justify-between pt-5 md:pt-0">
                <span className="label text-[var(--mute)]">Order</span>
                <span className="label">{data.orderId}</span>
              </div>
              <ul className="mt-6 divide-y border-y">
                {data.items.map((i, n) => {
                  const p = shopById.get(i.productId)
                  return (
                    <motion.li key={`${i.productId}-${i.size}-${i.color}`} className="flex items-center gap-4 py-4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.2 + n * 0.08, duration: 0.7, ease: EASE }}>
                      <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-[var(--paper-2)]">{p && <ProductMedia product={p} color={i.colorHex} sizes="64px" />}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px]">{i.name}</p>
                        <p className="label mt-1 text-[var(--mute)]">{i.color} / {i.size} / Qty {i.qty}</p>
                      </div>
                      <span className="label">{price(i.price * i.qty)}</span>
                    </motion.li>
                  )
                })}
              </ul>
              <dl className="label mt-5 space-y-2">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{price(data.subtotal + data.saleDiscount)}</dd></div>
                {data.saleDiscount > 0 && <div className="flex justify-between"><dt>Sale</dt><dd>−{price(data.saleDiscount)}</dd></div>}
                {data.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{price(data.discount)}</dd></div>}
                <div className="flex justify-between"><dt>Shipping</dt><dd>{data.shipping ? price(data.shipping) : "Free"}</dd></div>
                <div className="flex justify-between text-[12px]"><dt>Total</dt><dd>{price(data.total)}</dd></div>
              </dl>
            </motion.aside>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** A circle and tick that draw themselves. */
function Check() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden>
      <motion.circle cx="32" cy="32" r="29" initial={{ pathLength: 0, rotate: -90 }} animate={{ pathLength: 1 }} style={{ originX: "50%", originY: "50%" }} transition={{ duration: 1, delay: 0.5, ease: EASE }} />
      <motion.path d="M19 33.5 L28 42 L45 23" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 1.25, ease: EASE }} />
    </svg>
  )
}
