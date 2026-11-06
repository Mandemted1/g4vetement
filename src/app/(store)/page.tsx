import Link from "next/link"
import { HomeHero } from "@/components/store/home-hero"
import { IndexList } from "@/components/store/index-list"
import { ProductCard } from "@/components/store/product-card"
import { Marquee, Reveal, Rise, ScrollText } from "@/components/store/fx"
import { getCatalog } from "@/lib/source"
import { isSoldOut, sortedForGrid, toShop } from "@/lib/store"

/** Asymmetric "new in" layout: product id + desktop grid placement. */
const NEW_IN = [
  { id: "p05", cls: "md:col-span-5 md:col-start-1" },
  { id: "p13", cls: "md:col-span-3 md:col-start-7 md:mt-28" },
  { id: "p09", cls: "md:col-span-3 md:col-start-10 md:mt-6" },
  { id: "p17", cls: "md:col-span-3 md:col-start-2 md:mt-10" },
  { id: "p14", cls: "md:col-span-4 md:col-start-6 md:-mt-6" },
  { id: "p01", cls: "md:col-span-3 md:col-start-10 md:mt-24" },
]

export default async function Home() {
  const shop = toShop(await getCatalog())
  const byId = new Map(shop.map((p) => [p.id, p]))
  const used = new Set<string>()
  // Preferred picks first; if one is hidden or sold out, the layout fills in with other in-stock products.
  const picks = NEW_IN.map((n) => {
    let p = byId.get(n.id)
    if (!p || used.has(p.id)) p = shop.find((x) => !used.has(x.id) && !isSoldOut(x))
    if (p) used.add(p.id)
    return p ? { ...n, p } : null
  }).filter((x): x is (typeof NEW_IN)[number] & { p: (typeof shop)[number] } => x !== null)

  return (
    <>
      <HomeHero />

      <Marquee items={["FW26 Collection", "Free shipping over $100", "G4 Clothing", "Heavyweight basics"]} className="label border-y py-3" />

      <section className="px-5 pt-28 md:px-8 md:pt-40">
        <div className="mb-14 flex items-end justify-between md:mb-20">
          <Rise text="New in" className="text-[clamp(3rem,10vw,9rem)] font-medium leading-[0.85] tracking-[-0.06em]" />
          <Link href="/shop" data-cursor="SHOP" className="label hidden md:block"><span className="u">View all →</span></Link>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-12 md:gap-x-6 md:gap-y-20">
          {picks.map((n, i) => (
            <Reveal key={n.p.id} delay={(i % 3) * 0.08} className={n.cls}>
              <ProductCard product={n.p} />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-5 pt-40 md:px-8 md:pt-64">
        <p className="label mb-8 text-[var(--mute)]">( About )</p>
        <ScrollText
          className="max-w-[18ch] text-[clamp(2.2rem,6.6vw,6.2rem)] font-medium leading-[0.98] tracking-[-0.05em] md:max-w-[22ch]"
          text="G4 is clothing without the noise. Heavy cotton, clean cuts and colours that go with everything. Made to be worn until it is yours."
        />
      </section>

      <section className="px-5 pt-40 md:px-8 md:pt-64">
        <div className="mb-10 flex items-end justify-between">
          <Rise text="Index" className="text-[clamp(3rem,10vw,9rem)] font-medium leading-[0.85] tracking-[-0.06em]" />
          <span className="label">{shop.length} pieces</span>
        </div>
        <IndexList products={sortedForGrid(shop)} />
      </section>
    </>
  )
}
