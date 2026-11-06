"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { stopReminders } from "./actions"

export function StopForm({ token, email }: { token: string; email: string }) {
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  return (
    <div>
      <p className="label text-[var(--mute)]">( Reminders )</p>
      <h1 className="mt-5 text-[clamp(2.6rem,8vw,6.5rem)] font-medium leading-[0.9] tracking-[-0.055em]">{done ? <>No more<br />reminders.</> : <>Stop reminders<br />about your bag?</>}</h1>
      <p className="mt-6 max-w-[44ch] text-[14px] leading-relaxed text-[var(--mute)]">
        {done ? `We've deleted the saved bag and won't remind ${email} again.` : `We'll delete the bag we saved for ${email} and never send a reminder to this address again.`}
      </p>
      {error && <p role="alert" className="label mt-5 text-[#b3261e]">{error}</p>}
      {done ? (
        <Link href="/" className="label mt-10 inline-block border border-[var(--ink)] px-8 py-4 transition-colors duration-500 hover:bg-[var(--ink)] hover:text-[var(--paper)]">Back to G4</Link>
      ) : (
        <button
          disabled={pending}
          onClick={() => start(async () => { const r = await stopReminders(token); if (r.ok) setDone(true); else setError("Couldn't do that. Try again, or reply to the email and we'll remove you.") })}
          className="label mt-10 bg-[var(--ink)] px-8 py-4 text-[var(--paper)] disabled:opacity-60"
        >
          {pending ? "One moment…" : "Yes, stop reminders"}
        </button>
      )}
    </div>
  )
}
