import Image from "next/image"
import type { ShopProduct } from "@/lib/store"
import { Garment } from "./garment"
import { cn } from "@/lib/utils"

/**
 * One product visual: the real photo if one is mapped, otherwise a drawn garment in `color`.
 * Fills its parent (parent must be `relative` with a size).
 */
export function ProductMedia({
  product,
  color,
  index = 0,
  className,
  sizes = "(min-width: 1024px) 30vw, 60vw",
  priority,
}: {
  product: ShopProduct
  color?: string
  index?: number
  className?: string
  sizes?: string
  priority?: boolean
}) {
  const src = product.images[index]
  if (src) {
    return <Image src={src} alt={product.name} fill sizes={sizes} priority={priority} className={cn("object-cover", className)} />
  }
  const c = color ?? product.colors[0].hex
  return (
    <div className={cn("absolute inset-0 flex items-center justify-center bg-[var(--paper-2)]", className)}>
      <Garment type={product.type} color={c} className="h-[72%] w-auto drop-shadow-[0_18px_22px_rgba(0,0,0,0.10)]" />
    </div>
  )
}
