"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCart } from "./cart"

/** Puts a saved bag back (straight into the bag, not via browser storage), opens it, and goes to the shop. */
export function RestoreBag({ lines }: { lines: { productId: string; size: string; color: string; colorHex: string; qty: number }[] }) {
  const router = useRouter()
  const { restore } = useCart()
  useEffect(() => {
    restore(lines.map((l) => ({ ...l, key: `${l.productId}|${l.size}|${l.color}` })))
    // a client-side navigation: the bag lives in the store layout, so what was just restored carries over
    router.replace("/")
  }, [lines, restore, router])
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-[1200px] flex-col justify-center px-5 pt-32 md:px-8">
      <p className="label text-[var(--mute)]">( Your bag )</p>
      <p className="mt-5 text-[clamp(2rem,6vw,4.5rem)] font-medium leading-[0.95] tracking-[-0.05em]">Putting your bag back…</p>
    </div>
  )
}
