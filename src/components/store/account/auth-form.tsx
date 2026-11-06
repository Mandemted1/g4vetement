"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { signInCustomer, signUpCustomer } from "@/app/(store)/account/actions"
import { cn } from "@/lib/utils"

const input = "w-full border-b bg-transparent py-3 text-[15px] outline-none transition-colors placeholder:text-[var(--mute)] focus:border-[var(--ink)]"

/** Sign in / create account, in the store's style. `next` is where to go afterwards (a path on this site). */
export function AuthForm({ next = "/account", notice = "" }: { next?: string; notice?: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<"in" | "up">("in")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  const [pending, start] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    start(async () => {
      const r = mode === "in" ? await signInCustomer({ email, password }) : await signUpCustomer({ name, email, password })
      if (!r.ok) return setError(r.error)
      if (r.confirm) return setSent(true)
      router.replace(next)
      router.refresh()
    })
  }

  if (sent) {
    return (
      <div role="status" className="max-w-md">
        <p className="text-2xl font-medium leading-tight tracking-tight">Check your email.</p>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--mute)]">
          We sent a link to <b className="font-medium text-[var(--ink)]">{email}</b>. Open it to confirm your account, then sign in.
        </p>
        <button onClick={() => { setSent(false); setMode("in") }} className="label mt-8"><span className="u">Back to sign in</span></button>
      </div>
    )
  }

  return (
    <div className="max-w-md">
      <div className="label flex gap-6" role="tablist" aria-label="Account">
        {([["in", "Sign in"], ["up", "Create account"]] as const).map(([m, label]) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError("") }} className={mode === m ? "" : "text-[var(--mute)] transition-colors hover:text-[var(--ink)]"}>
            <span className={mode === m ? "u !bg-[length:100%_1px]" : "u"}>{label}</span>
          </button>
        ))}
      </div>

      {notice && <p className="label mt-6 leading-relaxed text-[#b3261e]">{notice}</p>}

      <form onSubmit={submit} className="mt-8 space-y-1">
        {mode === "up" && <input className={input} required placeholder="Full name" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}
        <input className={input} required type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="relative">
          <input
            className={cn(input, "pr-16")}
            required
            type={show ? "text" : "password"}
            placeholder={mode === "up" ? "Password (8+ characters)" : "Password"}
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            minLength={mode === "up" ? 8 : undefined}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} className="label absolute right-0 top-1/2 -translate-y-1/2 py-2 pl-3"><span className="u">{show ? "Hide" : "Show"}</span></button>
        </div>

        {error && <p role="alert" className="label !mt-5 leading-relaxed text-[#b3261e]">{error}</p>}

        <button type="submit" disabled={pending} data-cursor={mode === "in" ? "SIGN IN" : "JOIN"} className="label group relative !mt-8 w-full overflow-hidden bg-[var(--ink)] py-5 text-[var(--paper)] disabled:opacity-60">
          <span className="absolute inset-0 origin-bottom scale-y-0 bg-[var(--paper)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100" />
          <span className="relative mix-blend-difference">{pending ? "One moment…" : mode === "in" ? "Sign in" : "Create account"}</span>
        </button>
      </form>

      <p className="label mt-6 leading-relaxed text-[var(--mute)]">
        {mode === "in" ? "No account? You can still check out as a guest. An account keeps your orders and address in one place." : "Orders you place while signed in show up in your account."}
      </p>
    </div>
  )
}
