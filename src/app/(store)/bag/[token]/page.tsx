import type { Metadata } from "next"
import Link from "next/link"
import { RestoreBag } from "@/components/store/restore-bag"
import { getCartByToken } from "@/lib/email/abandoned"
import { getCatalog } from "@/lib/source"
import { sizeLeft } from "@/lib/stock"

export const metadata: Metadata = { title: "Your bag", robots: { index: false } }

/** The "return to your bag" link in the reminder email. Lines that can no longer be bought are dropped. */
export default async function BagPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const cart = await getCartByToken(token)
  const catalog = new Map((await getCatalog()).filter((p) => p.active).map((p) => [p.id, p]))
  const lines = (cart?.items ?? []).flatMap((i) => {
    const p = catalog.get(i.productId)
    const c = p?.colors.find((x) => x.name === i.color)
    if (!p || !c || sizeLeft(p, i.size) <= 0) return []
    return [{ productId: i.productId, size: i.size, color: i.color, colorHex: c.hex, qty: Math.min(i.qty, sizeLeft(p, i.size)) }]
  })
  if (lines.length > 0) return <RestoreBag lines={lines} />
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-[1200px] flex-col justify-center px-5 pb-10 pt-32 md:px-8">
      <p className="label text-[var(--mute)]">( Your bag )</p>
      <h1 className="mt-5 text-[clamp(2.6rem,8vw,6.5rem)] font-medium leading-[0.9] tracking-[-0.055em]">{cart ? <>Those pieces<br />have sold out.</> : <>This link<br />isn&apos;t valid.</>}</h1>
      <p className="mt-6 max-w-[40ch] text-[14px] leading-relaxed text-[var(--mute)]">{cart ? "Nothing from your bag is available right now. Have a look at what's new." : "It may have expired. You can always start again from the shop."}</p>
      <Link href="/shop" className="label mt-10 inline-block w-fit border border-[var(--ink)] px-8 py-4 transition-colors duration-500 hover:bg-[var(--ink)] hover:text-[var(--paper)]">Shop</Link>
    </div>
  )
}
