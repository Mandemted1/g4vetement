import { onSale, price, unitPrice } from "@/lib/store"
import { cn } from "@/lib/utils"

/** The price shoppers pay. During a sale the old price is struck through beside the new one. */
export function PriceTag({ p, className, strikeClassName }: { p: { price: number; salePrice?: number }; className?: string; strikeClassName?: string }) {
  if (!onSale(p)) return <span className={className}>{price(p.price)}</span>
  return (
    <span className={className}>
      <s className={cn("mr-1.5 text-[var(--mute)]", strikeClassName)}>{price(p.price)}</s>
      {price(unitPrice(p))}
    </span>
  )
}
