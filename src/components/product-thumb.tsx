import Image from "next/image"
import { ShirtIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Product photo when we have one, otherwise a tile in the product's colour. */
export function ProductThumb({ image, color, className }: { image?: string; color: string; className?: string }) {
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden border bg-muted", className)} style={image ? undefined : { background: color }}>
      {image ? <Image src={image} alt="" fill sizes="64px" className="object-cover" /> : <ShirtIcon className="size-1/2 text-white/60 mix-blend-difference" />}
    </span>
  )
}
