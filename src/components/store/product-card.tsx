"use client"

import Link from "next/link"
import { isSoldOut, pad, price, type ShopProduct } from "@/lib/store"
import { useCart } from "./cart"
import { ProductMedia } from "./product-media"
import { cn } from "@/lib/utils"

export function ProductCard({ product: p, className, ratio = "aspect-[4/5]", priority, showIndex = true }: { product: ShopProduct; className?: string; ratio?: string; priority?: boolean; showIndex?: boolean }) {
  const { add, setOpen } = useCart()
  const sold = isSoldOut(p)
  const hasSecond = p.images.length > 1
  const low = !sold && p.stock <= p.reorderLevel

  return (
    <div className={cn("group relative", className)}>
      <Link href={p.href} data-cursor="VIEW" className="block">
        <div className={cn("relative overflow-hidden bg-[var(--paper-2)]", ratio)}>
          <div className={cn("absolute inset-0 transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.045]", sold && "opacity-50")}>
            <ProductMedia product={p} priority={priority} />
          </div>
          {hasSecond && (
            <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
              <ProductMedia product={p} index={1} />
            </div>
          )}
          <span className="label absolute left-3 top-3">{showIndex ? pad(p.index) : ""}</span>
          {(sold || low) && <span className="label absolute right-3 top-3">{sold ? "Sold out" : `${p.stock} left`}</span>}
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <span className="text-[13px] leading-tight">{p.name}</span>
          <span className="label shrink-0">{price(p.price)}</span>
        </div>
        <p className="label mt-1 text-[var(--mute)]">{p.colors.length} {p.colors.length === 1 ? "colour" : "colours"}</p>
      </Link>

      {!sold && (
        <div className="pointer-events-none absolute inset-x-0 top-0 hidden aspect-[4/5] items-end md:flex">
          <div className="pointer-events-auto flex w-full translate-y-full gap-px bg-[var(--line)] opacity-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100">
            {p.sizes.map((s) => (
              <button
                key={s}
                data-cursor="ADD"
                onClick={(e) => {
                  add({ productId: p.id, size: s, color: p.colors[0].name, colorHex: p.colors[0].hex }, e.currentTarget.getBoundingClientRect())
                  window.setTimeout(() => setOpen(true), 700)
                }}
                className="label flex-1 bg-[var(--paper)] py-3 transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)]"
              >
                {s === "One Size" ? "Add" : s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
