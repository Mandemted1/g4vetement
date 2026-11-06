"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { setSubscription } from "./actions"

export function UnsubscribeForm({ token, email, initiallyOut }: { token: string; email: string; initiallyOut: boolean }) {
  const [out, setOut] = useState(initiallyOut)
  const [error, setError] = useState("")
  const [pending, start] = useTransition()

  const flip = (subscribed: boolean) =>
    start(async () => {
      setError("")
      const r = await setSubscription(token, subscribed)
      if (r.ok) setOut(!subscribed)
      else setError("Something went wrong. Please try again.")
    })

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={out ? "out" : "in"} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <p className="label text-[var(--mute)]">( {out ? "Unsubscribed" : "Unsubscribe"} )</p>
        <h1 className="mt-5 text-[clamp(2.6rem,8vw,6.5rem)] font-medium leading-[0.9] tracking-[-0.055em]">
          {out ? (
            <>You&apos;re off<br />the list.</>
          ) : (
            <>Leave the<br />list?</>
          )}
        </h1>
        <p className="mt-6 max-w-[42ch] text-[14px] leading-relaxed text-[var(--mute)]">
          {out ? (
            <>We won&apos;t send marketing emails to <b className="font-medium text-[var(--ink)]">{email}</b> any more. You&apos;ll still get emails about orders you place.</>
          ) : (
            <>Stop marketing emails to <b className="font-medium text-[var(--ink)]">{email}</b>. Order updates will keep coming if you buy something.</>
          )}
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          {out ? (
            <button onClick={() => flip(true)} disabled={pending} className="label border border-[var(--ink)] px-8 py-4 transition-colors duration-500 hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-50">
              {pending ? "…" : "Changed my mind, resubscribe"}
            </button>
          ) : (
            <button onClick={() => flip(false)} disabled={pending} className="label group relative overflow-hidden bg-[var(--ink)] px-8 py-4 text-[var(--paper)] disabled:opacity-50">
              <span className="absolute inset-0 origin-bottom scale-y-0 bg-[var(--paper)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100" />
              <span className="relative mix-blend-difference">{pending ? "…" : "Yes, unsubscribe me"}</span>
            </button>
          )}
          <Link href="/" className="label border px-8 py-4 transition-colors duration-500 hover:bg-[var(--paper-2)]">Back to G4</Link>
        </div>
        {error && <p className="label mt-5 text-[#b3261e]">{error}</p>}
      </motion.div>
    </AnimatePresence>
  )
}
