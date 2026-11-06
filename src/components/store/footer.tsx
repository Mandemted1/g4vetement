"use client"

import { useState } from "react"
import Link from "next/link"
import { subscribe } from "@/app/(store)/actions"
import { useCatalog } from "./catalog"
import { Reveal } from "./fx"

export function StoreFooter() {
  const { categories, sections, store, policyLinks, account } = useCatalog()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  return (
    <footer className="mt-32 overflow-hidden border-t px-5 pt-10 md:px-8">
      <div className="grid gap-12 md:grid-cols-12">
        <Reveal className="md:col-span-5">
          <p className="label text-[var(--mute)]">Newsletter</p>
          {sent ? (
            <p className="mt-4 text-2xl font-medium tracking-tight">You&apos;re on the list.</p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setError("")
                const r = await subscribe(email)
                if (r.ok) setSent(true)
                else setError(r.error ?? "Try again.")
              }}
              className="mt-4 flex items-end gap-4 border-b border-[var(--ink)] pb-2"
            >
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email address" className="w-full bg-transparent text-2xl font-medium tracking-tight outline-none placeholder:text-[var(--mute)]" />
              <button className="label shrink-0 pb-1"><span className="u">Join</span></button>
            </form>
          )}
          {error && <p className="label mt-3 text-[#b3261e]">{error}</p>}
        </Reveal>
        <Reveal delay={0.1} className="md:col-span-3 md:col-start-8">
          <p className="label text-[var(--mute)]">Shop</p>
          <ul className="label mt-4 space-y-2.5">
            <li><Link href="/shop" className="u">All products</Link></li>
            {sections.length > 0
              ? sections.map((s) => <li key={s.key}><Link href={`/shop?d=${s.key}`} className="u">{s.label}</Link></li>)
              : categories.map((c) => (
                  <li key={c}><Link href={`/shop?c=${encodeURIComponent(c)}`} className="u">{c}</Link></li>
                ))}
          </ul>
        </Reveal>
        <Reveal delay={0.2} className="md:col-span-2">
          <p className="label text-[var(--mute)]">Help</p>
          <ul className="label mt-4 space-y-2.5">
            <li><Link href="/account" className="u">{account ? "Account" : "Sign in"}</Link></li>
            {policyLinks.map((l) => (
              <li key={l.slug}><Link href={`/policies/${l.slug}`} className="u">{l.title}</Link></li>
            ))}
            {store.email && <li><a href={`mailto:${store.email}`} className="u break-all">Contact</a></li>}
            {store.instagram && <li><a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noreferrer" className="u">Instagram</a></li>}
            {store.tiktok && <li><a href={`https://tiktok.com/@${store.tiktok}`} target="_blank" rel="noreferrer" className="u">TikTok</a></li>}
          </ul>
        </Reveal>
      </div>
      {(store.address || store.phone) && (
        <p className="label mb-12 mt-16 max-w-[44ch] whitespace-pre-line text-[var(--mute)]">{[store.address, store.phone].filter(Boolean).join("\n")}</p>
      )}
      <div className="pointer-events-none select-none text-[43vw] font-semibold leading-[0.74] tracking-[-0.07em] md:text-[34vw]" aria-hidden>
        G4
      </div>
    </footer>
  )
}
