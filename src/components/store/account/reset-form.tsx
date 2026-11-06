"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { setNewPassword } from "@/app/(store)/account/actions"

const input = "w-full border-b bg-transparent py-3 text-[15px] outline-none transition-colors placeholder:text-[var(--mute)] focus:border-[var(--ink)]"

export function ResetForm() {
  const router = useRouter()
  const [pw, setPw] = useState("")
  const [again, setAgain] = useState("")
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (pw !== again) return setError("The two passwords don't match.")
    start(async () => {
      const r = await setNewPassword(pw)
      if (!r.ok) return setError(r.error)
      router.replace("/account")
      router.refresh()
    })
  }
  return (
    <form onSubmit={submit} className="max-w-md space-y-1">
      <input className={input} required type="password" placeholder="New password (8+ characters)" autoComplete="new-password" minLength={8} maxLength={72} value={pw} onChange={(e) => setPw(e.target.value)} />
      <input className={input} required type="password" placeholder="Repeat new password" autoComplete="new-password" minLength={8} maxLength={72} value={again} onChange={(e) => setAgain(e.target.value)} />
      {error && <p role="alert" className="label !mt-5 leading-relaxed text-[#b3261e]">{error}</p>}
      <button type="submit" disabled={pending} className="label !mt-8 w-full bg-[var(--ink)] py-5 text-[var(--paper)] disabled:opacity-60">{pending ? "One moment…" : "Save new password"}</button>
    </form>
  )
}
