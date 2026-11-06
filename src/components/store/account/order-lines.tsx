"use client"

import Link from "next/link"
import type { Order } from "@/lib/data"
import { price } from "@/lib/store"
import { useCatalog } from "../catalog"
import { ProductMedia } from "../product-media"

/** An order's items with their photos (looked up from the live catalog; items for products since removed still show their name). */
export function OrderLines({ order, canReview = false }: { order: Order; canReview?: boolean }) {
  const { shopById } = useCatalog()
  return (
    <ul className="divide-y border-y">
      {order.items.map((i) => {
        const p = shopById.get(i.productId)
        return (
          <li key={`${i.productId}-${i.size}-${i.color}`} className="flex items-center gap-4 py-4">
            <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-[var(--paper-2)]">{p && <ProductMedia product={p} color={i.colorHex} sizes="64px" />}</div>
            <div className="min-w-0 flex-1">
              {p ? <Link href={p.href} className="u block truncate text-[13px]">{i.name}</Link> : <p className="truncate text-[13px]">{i.name}</p>}
              <p className="label mt-1 text-[var(--mute)]">{i.color} / {i.size} / Qty {i.qty}</p>
              {canReview && p && <Link href={`${p.href}#reviews`} data-cursor="REVIEW" className="label mt-2 inline-block"><span className="u">Write a review</span></Link>}
            </div>
            <span className="label">{price(i.price * i.qty)}</span>
          </li>
        )
      })}
    </ul>
  )
}
