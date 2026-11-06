"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { subscribe } from "@/app/(store)/actions"
import { offerFinePrint, offerHeadline } from "@/lib/offer-types"
import { useCatalog } from "./catalog"
import { useIntroReady } from "./fx"
import { ProductMedia } from "./product-media"

const KEY = "g4-welcome"
const SHOW_AFTER_MS = 4500

/** One-time offer for first-time visitors: $10 off in exchange for an email. */
export function WelcomePopup() {
  const { shop, welcome } = useCatalog()
  const ready = useIntroReady()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"form" | "busy" | "done">("form")
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const remember = (v: string) => {
    try {
      localStorage.setItem(KEY, v)
    } catch {}
  }
  const dismiss = () => {
    remember(state === "done" ? "joined" : "dismissed")
    setOpen(false)
  }

  // New visitors only (nothing stored yet), a few seconds after the intro curtain.
  useEffect(() => {
    if (!ready || !welcome) return
    let seen = false
    try {
      seen = Boolean(localStorage.getItem(KEY))
    } catch {}
    if (seen) return
    const t = window.setTimeout(() => setOpen(true), SHOW_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [ready, welcome])

  // Lock page scroll and support Escape while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss()
    window.addEventListener("keydown", onKey)
    const f = window.setTimeout(() => input.current?.focus(), 700)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
      window.clearTimeout(f)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState("busy")
    setError("")
    const r = await subscribe(email, "popup")
    if (!r.ok) {
      setError(r.error ?? "Something went wrong.")
      setState("form")
      return
    }
    try {
      if (welcome) localStorage.setItem("g4-code", welcome.code)
    } catch {}
    remember("joined")
    setState("done")
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(welcome?.code ?? "")
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  const featured = shop.find((p) => p.images[0]) ?? shop[0]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-lenis-prevent
          className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0d0d0d]/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onClick={dismiss}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Welcome offer"
            onClick={(e) => e.stopPropagation()}
            className="relative grid w-full max-w-[820px] bg-[var(--paper)] text-[var(--ink)] sm:grid-cols-[0.85fr_1fr]"
            initial={{ clipPath: "inset(100% 0 0 0)" }}
            animate={{ clipPath: "inset(0% 0 0 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="relative hidden min-h-[420px] overflow-hidden bg-[var(--paper-2)] sm:block">
              {featured && (
                <motion.div className="absolute inset-0" initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}>
                  <ProductMedia product={featured} sizes="340px" />
                </motion.div>
              )}
              <span className="label absolute left-4 top-4">FW26</span>
            </div>

            <div className="flex flex-col justify-between gap-10 p-6 sm:p-9">
              <button onClick={dismiss} aria-label="Close" className="label absolute right-4 top-4 p-2" data-cursor="CLOSE">
                <span className="u">Close</span>
              </button>

              {state !== "done" ? (
                <>
                  <div>
                    <p className="label text-[var(--mute)]">( Welcome )</p>
                    <h2 className="mt-5 text-[clamp(2.4rem,6vw,3.6rem)] font-medium leading-[0.92] tracking-[-0.055em]">
                      {welcome ? offerHeadline(welcome) : ""}
                      <br />
                      {welcome?.firstOrderOnly ? "your first order." : "your order."}
                    </h2>
                    <p className="mt-5 max-w-[34ch] text-[13px] leading-relaxed text-[var(--mute)]">
                      Join the list for new drops and restocks. We&apos;ll send your code straight away. {welcome ? offerFinePrint(welcome) : ""}.
                    </p>
                  </div>
                  <form onSubmit={submit}>
                    <div className="flex items-end gap-3 border-b border-[var(--ink)]">
                      <input
                        ref={input}
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        autoComplete="email"
                        className="w-full bg-transparent py-3 text-lg font-medium tracking-tight outline-none placeholder:text-[var(--mute)]"
                      />
                      <button disabled={state === "busy"} data-cursor="JOIN" className="label shrink-0 py-3 disabled:opacity-50">
                        <span className="u">{state === "busy" ? "…" : "Get code →"}</span>
                      </button>
                    </div>
                    {error && <p className="label mt-3 text-[#b3261e]">{error}</p>}
                    <button type="button" onClick={dismiss} className="label mt-5 text-[var(--mute)]"><span className="u">No thanks</span></button>
                  </form>
                </>
              ) : (
                <>
                  <div>
                    <p className="label text-[var(--mute)]">( You&apos;re in )</p>
                    <h2 className="mt-5 text-[clamp(2.4rem,6vw,3.6rem)] font-medium leading-[0.92] tracking-[-0.055em]">Here&apos;s your code.</h2>
                    <button onClick={copy} data-cursor={copied ? "COPIED" : "COPY"} className="group relative mt-7 flex w-full items-center justify-between overflow-hidden border border-dashed border-[var(--ink)] px-4 py-4 text-left">
                      <span className="absolute inset-0 origin-left scale-x-0 bg-[var(--ink)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100" />
                      <span className="relative text-2xl font-medium tracking-[-0.03em] transition-colors duration-300 group-hover:text-[var(--paper)]">{welcome?.code}</span>
                      <span className="label relative transition-colors duration-300 group-hover:text-[var(--paper)]">{copied ? "Copied" : "Copy"}</span>
                    </button>
                    <p className="mt-4 max-w-[34ch] text-[13px] leading-relaxed text-[var(--mute)]">It&apos;s saved to your bag and applied at checkout. {welcome ? offerFinePrint(welcome) : ""}.</p>
                  </div>
                  <button onClick={dismiss} data-cursor="SHOP" className="label group relative w-full overflow-hidden bg-[var(--ink)] py-4 text-[var(--paper)]">
                    <span className="absolute inset-0 origin-bottom scale-y-0 bg-[var(--paper)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100" />
                    <span className="relative mix-blend-difference">Start shopping</span>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
