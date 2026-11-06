"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { browserClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"

/** Email + password form. `tone="dark"` is for sitting on top of a photo. */
export function LoginForm({ tone = "light", tagline }: { tone?: "light" | "dark"; tagline: string }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const dark = tone === "dark"

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    const { error } = await browserClient().auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message)
      setBusy(false)
      return
    }
    router.replace("/admin")
    router.refresh()
  }

  const input = cn(
    "w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors",
    dark ? "liquid-input text-white placeholder:text-white/45" : "border-input bg-transparent focus:border-ring focus:ring-3 focus:ring-ring/50",
  )

  return (
    <div className={dark ? "text-white" : "text-foreground"}>
      <div className={cn("mb-5 flex size-10 items-center justify-center rounded-xl text-sm font-bold tracking-tight", dark ? "bg-white/90 text-black shadow-[inset_0_1px_0_#fff,0_6px_16px_-4px_rgba(0,0,0,0.5)]" : "bg-primary text-primary-foreground")}>G4</div>
      <h1 className="text-xl font-semibold tracking-tight">G4 Admin</h1>
      <p className={cn("mt-1.5 text-sm", dark ? "text-white/65" : "text-muted-foreground")}>{tagline}</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5 text-sm">
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </label>
        <div className="flex flex-col gap-1.5 text-sm">
          <label htmlFor="admin-password">Password</label>
          <div className="relative">
            <input id="admin-password" type={show ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={cn(input, "pr-11")} />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              className={cn("absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors", dark ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </div>
        {error && <p className={cn("text-sm", dark ? "text-red-300" : "text-negative")}>{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className={cn("mt-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-60", dark ? "liquid-button text-black" : "bg-primary text-primary-foreground hover:bg-primary/90")}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  )
}
