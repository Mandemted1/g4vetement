"use client"

import { useEffect, useRef, useState } from "react"
import { track } from "@/lib/track"
import { AnimatePresence, motion, useAnimationControls } from "motion/react"
import { isSoldOut, onSale, pad, price, sizeLeft, unitPrice, type ShopProduct } from "@/lib/store"
import { BackLink } from "./back-link"
import { PriceTag } from "./price-tag"
import { useCart } from "./cart"
import { Magnetic, Rise } from "./fx"
import { ProductMedia } from "./product-media"
import { ProductCard } from "./product-card"

export function ProductView({ product: p, related }: { product: ShopProduct; related: ShopProduct[] }) {
  const { add, setOpen } = useCart()
  const [color, setColor] = useState(p.colors[0])
  const [size, setSize] = useState<string | null>(p.sizes.length === 1 ? p.sizes[0] : null)
  const [added, setAdded] = useState(false)
  const shake = useAnimationControls()
  const btn = useRef<HTMLButtonElement>(null)
  const sold = isSoldOut(p)
  const left = size ? sizeLeft(p, size) : null
  // once a size is chosen, the warning is about that size; before that, about the whole product
  const warn = sold ? null : left !== null ? (left <= 3 ? `Only ${left} left in ${size}` : null) : p.stock <= p.reorderLevel ? `Only ${p.stock} left` : null
  const photos = p.images.length

  useEffect(() => {
    track("product_view", { product_id: p.id })
  }, [p.id])

  const onAdd = () => {
    if (sold) return
    if (!size) {
      shake.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.45 } })
      return
    }
    add({ productId: p.id, size, color: color.name, colorHex: color.hex }, btn.current?.getBoundingClientRect())
    setAdded(true)
    window.setTimeout(() => setOpen(true), 700)
    window.setTimeout(() => setAdded(false), 2200)
  }

  return (
    <>
      <div className="grid gap-y-10 px-5 pt-24 md:grid-cols-12 md:gap-x-8 md:px-8 md:pt-28">
        <div className="-mb-8 -mt-3 md:col-span-12 md:-mb-6">
          <BackLink label="Back" />
        </div>

        {/* gallery */}
        <div className="space-y-3 md:col-span-7 md:space-y-4">
          <Zoom product={p} color={color.hex} index={0} priority />
          {photos > 1 ? Array.from({ length: photos - 1 }, (_, i) => <Zoom key={i} product={p} color={color.hex} index={i + 1} />) : <Detail product={p} color={color.hex} />}
        </div>

        {/* spec sheet */}
        <div className="md:col-span-5 md:col-start-8">
          <div className="md:sticky md:top-24">
            <div className="label flex justify-between text-[var(--mute)]">
              <span>Ref. {p.sku}</span>
              <span>No. {pad(p.index)}</span>
            </div>
            <Rise as="h1" text={p.name} className="mt-5 text-[clamp(2.4rem,4.6vw,4.4rem)] font-medium leading-[0.92] tracking-[-0.05em]" />
            <p className="mt-5 flex flex-wrap items-baseline gap-x-3 text-lg font-medium tracking-tight">
              <PriceTag p={p} strikeClassName="font-normal" />
              {onSale(p) && <span className="label font-normal">−{p.salePercent}%{p.saleName ? ` · ${p.saleName}` : ""}</span>}
            </p>
            <p className="mt-5 max-w-[42ch] text-[13px] leading-relaxed text-[var(--mute)]">{p.description}</p>

            <div className="mt-9 border-t pt-5">
              <div className="label flex justify-between"><span>Colour</span><span className="text-[var(--mute)]">{color.name}</span></div>
              <div className="mt-3 flex gap-2">
                {p.colors.map((c) => (
                  <button key={c.name} onClick={() => setColor(c)} aria-label={c.name} aria-pressed={color.name === c.name} data-cursor={c.name} className={`relative size-11 border transition-transform md:size-9 duration-300 hover:scale-110 ${color.name === c.name ? "border-[var(--ink)]" : ""}`}>
                    <span className="absolute inset-[3px]" style={{ background: c.hex }} />
                  </button>
                ))}
              </div>
            </div>

            <motion.div animate={shake} className="mt-7">
              <div className="label flex justify-between"><span>Size</span><span className="text-[var(--mute)]">{size ?? "Select"}</span></div>
              <div className="mt-3 grid grid-cols-5 gap-px bg-[var(--line)]" role="radiogroup" aria-label="Size">
                {p.sizes.map((s) => {
                  const out = sizeLeft(p, s) <= 0
                  return (
                    <button key={s} role="radio" aria-checked={size === s} aria-label={out ? `${s}, sold out` : s} disabled={sold || out} onClick={() => setSize(s)} data-cursor={out ? "" : "SELECT"} className={`label relative py-3.5 transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${size === s ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-[var(--paper)] hover:bg-[var(--paper-2)]"} ${p.sizes.length === 1 ? "col-span-5" : ""}`}>
                      <span className={out ? "line-through decoration-[1.5px]" : ""}>{s}</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>

            <Magnetic strength={0.08} className="mt-8">
              <button ref={btn} onClick={onAdd} disabled={sold} data-cursor={sold ? "" : "ADD"} className="label group relative w-full overflow-hidden bg-[var(--ink)] py-5 text-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-40">
                <span className="absolute inset-0 origin-bottom scale-y-0 bg-[var(--paper)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100 group-disabled:hidden" />
                <span className="relative inline-block mix-blend-difference">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={sold ? "s" : added ? "a" : "d"} className="inline-block" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.25 }}>
                      {sold ? "Sold out" : added ? "Added to bag" : `Add to bag — ${price(unitPrice(p))}`}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </button>
            </Magnetic>
            {warn && <p className="label mt-3 text-[var(--mute)]">{warn}</p>}

            <div className="mt-10 border-t">
              <Spec title="Fabric" body={p.fabric} />
              <Spec title="Fit" body={p.fit} />
              <Spec title="Shipping" body="Free shipping over $100. $9 flat rate below. Prices in USD." />
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="px-5 pt-32 md:px-8 md:pt-48">
          <div className="mb-10 flex items-end justify-between">
            <Rise text="Also from" className="text-[clamp(2.4rem,7vw,6rem)] font-medium leading-[0.88] tracking-[-0.055em]" />
            <span className="label">{related[0].category}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-4 md:gap-x-6">
            {related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

/** Full image with a pointer-tracked zoom. */
function Zoom({ product, color, index, priority }: { product: ShopProduct; color: string; index: number; priority?: boolean }) {
  const [o, setO] = useState("50% 50%")
  const [on, setOn] = useState(false)
  return (
    <div
      className="relative aspect-[4/5] overflow-hidden bg-[var(--paper-2)]"
      data-cursor="ZOOM"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setO(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
      }}
      onPointerEnter={(e) => e.pointerType === "mouse" && setOn(true)}
      onPointerLeave={() => setOn(false)}
    >
      <motion.div className="absolute inset-0" style={{ transformOrigin: o }} animate={{ scale: on ? 1.9 : 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
        <ProductMedia product={product} color={color} index={index} priority={priority} sizes="(min-width: 768px) 58vw, 100vw" />
      </motion.div>
    </div>
  )
}

/** Second panel when a product has a single image: a close crop. */
function Detail({ product, color }: { product: ShopProduct; color: string }) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden bg-[var(--paper-2)]">
      <motion.div className="absolute inset-0 origin-[50%_22%]" initial={{ scale: 1.9 }} whileInView={{ scale: 2.3 }} viewport={{ once: false, amount: 0.3 }} transition={{ duration: 2.4, ease: [0.22, 1, 0.36, 1] }}>
        <ProductMedia product={product} color={color} sizes="(min-width: 768px) 58vw, 100vw" />
      </motion.div>
      <span className="label absolute bottom-3 left-3">Detail</span>
    </div>
  )
}

function Spec({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} data-cursor={open ? "−" : "+"} className="label flex w-full items-center justify-between py-4">
        <span>{title}</span>
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.3 }} className="text-base leading-none">+</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <p className="pb-5 text-[13px] leading-relaxed text-[var(--mute)]">{body}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
