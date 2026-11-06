import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PolicyText } from "@/components/store/policy-text"
import { Rise } from "@/components/store/fx"
import { getPolicies, getStoreSettings } from "@/lib/settings"
import { POLICY_META } from "@/lib/settings-types"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return { title: POLICY_META.find((m) => m.slug === slug)?.title ?? "Policy" }
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const meta = POLICY_META.find((m) => m.slug === slug)
  if (!meta) notFound()
  const [policies, store] = await Promise.all([getPolicies(), getStoreSettings()])
  const text = policies[meta.slug].trim()
  if (!text) notFound()
  const others = POLICY_META.filter((m) => m.slug !== slug && policies[m.slug].trim())

  return (
    <div className="px-5 pb-10 pt-28 md:px-8 md:pt-36">
      <p className="label mb-6 text-[var(--mute)]">( {store.name} / Policies )</p>
      <Rise as="h1" text={meta.title} className="text-[clamp(3rem,10vw,9rem)] font-medium leading-[0.85] tracking-[-0.06em]" />
      <div className="mt-14 grid gap-12 md:grid-cols-12">
        <PolicyText text={text} className="text-[15px] leading-[1.7] text-[#2a2a28] md:col-span-7 md:col-start-1" />
        <aside className="md:col-span-3 md:col-start-10">
          <p className="label text-[var(--mute)]">Also</p>
          <ul className="label mt-4 space-y-2.5">
            {others.map((o) => (
              <li key={o.slug}><Link href={`/policies/${o.slug}`} className="u">{o.title}</Link></li>
            ))}
            {store.email && <li><a href={`mailto:${store.email}`} className="u break-all">Contact us</a></li>}
          </ul>
        </aside>
      </div>
    </div>
  )
}
