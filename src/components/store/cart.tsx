"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { FREE_SHIPPING_AT, SHIPPING, WELCOME_CODE, WELCOME_MIN, WELCOME_OFF, price } from "@/lib/store"
import { placeOrder } from "@/app/(store)/actions"
import { useCatalog } from "./catalog"
import { OrderSuccess, type SuccessData } from "./order-success"
import { track } from "@/lib/track"
import { ProductMedia } from "./product-media"

export interface CartLine {
  key: string
  productId: string
  size: string
  color: string
  colorHex: string
  qty: number
}

interface Flight {
  id: number
  from: DOMRect
  productId: string
  color: string
}

interface CartCtx {
  lines: CartLine[]
  count: number
  subtotal: number
  open: boolean
  setOpen: (v: boolean) => void
  add: (l: Omit<CartLine, "key" | "qty">, from?: DOMRect | null) => void
  setQty: (key: string, qty: number) => void
  clear: () => void
  bumped: number
  showSuccess: (d: SuccessData) => void
}

const Ctx = createContext<CartCtx | null>(null)
export const useCart = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error("useCart outside CartProvider")
  return c
}

const STORAGE = "g4-cart"
const MAX_QTY = 10

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { shopById } = useCatalog()
  const [lines, setLines] = useState<CartLine[]>([])
  const [open, setOpen] = useState(false)
  const [flights, setFlights] = useState<Flight[]>([])
  const [bumped, setBumped] = useState(0)
  const [success, setSuccess] = useState<SuccessData | null>(null)
  const loaded = useRef(false)
  const fid = useRef(0)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setLines((JSON.parse(raw) as CartLine[]).filter((l) => shopById.has(l.productId)))
    } catch {}
    loaded.current = true
  }, [shopById])
  useEffect(() => {
    if (!loaded.current) return
    try {
      localStorage.setItem(STORAGE, JSON.stringify(lines))
    } catch {}
  }, [lines])

  const add: CartCtx["add"] = useCallback((l, from) => {
    const p = shopById.get(l.productId)
    if (!p || p.stock <= 0) return
    const key = `${l.productId}|${l.size}|${l.color}`
    const cap = Math.min(MAX_QTY, p.stock)
    track("add_to_cart", { product_id: l.productId })
    const land = () => {
      setLines((prev) => {
        const found = prev.find((x) => x.key === key)
        if (found) return prev.map((x) => (x.key === key ? { ...x, qty: Math.min(cap, x.qty + 1) } : x))
        return [...prev, { ...l, key, qty: 1 }]
      })
      setBumped((n) => n + 1)
    }
    if (from && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFlights((f) => [...f, { id: ++fid.current, from, productId: l.productId, color: l.colorHex }])
      window.setTimeout(land, 650)
    } else land()
  }, [shopById])

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.key !== key) return [l]
        if (qty <= 0) return []
        return [{ ...l, qty: Math.min(qty, MAX_QTY, shopById.get(l.productId)?.stock ?? MAX_QTY) }]
      }),
    )
  }, [shopById])
  const clear = useCallback(() => setLines([]), [])

  const count = lines.reduce((s, l) => s + l.qty, 0)
  const subtotal = lines.reduce((s, l) => s + l.qty * (shopById.get(l.productId)?.price ?? 0), 0)
  const value = useMemo(() => ({ lines, count, subtotal, open, setOpen, add, setQty, clear, bumped, showSuccess: setSuccess }), [lines, count, subtotal, open, add, setQty, clear, bumped])

  return (
    <Ctx.Provider value={value}>
      {children}
      <FlightLayer flights={flights} done={(id) => setFlights((f) => f.filter((x) => x.id !== id))} />
      <CartDrawer />
      <OrderSuccess data={success} onClose={() => setSuccess(null)} />
    </Ctx.Provider>
  )
}

/** A small square of the product flies from the button to the BAG link. */
function FlightLayer({ flights, done }: { flights: Flight[]; done: (id: number) => void }) {
  const { shopById } = useCatalog()
  return (
    <>
      {flights.map((f) => {
        const target = document.getElementById("bag-link")?.getBoundingClientRect()
        const p = shopById.get(f.productId)!
        const tx = target ? target.left + target.width / 2 : window.innerWidth - 40
        const ty = target ? target.top + target.height / 2 : 20
        const size = 72
        return (
          <motion.div
            key={f.id}
            className="pointer-events-none fixed left-0 top-0 z-[90] overflow-hidden"
            style={{ width: size, height: size }}
            initial={{ x: f.from.left + f.from.width / 2 - size / 2, y: f.from.top + f.from.height / 2 - size / 2, scale: 1, opacity: 1 }}
            animate={{ x: tx - size / 2, y: ty - size / 2, scale: 0.12, opacity: 0.9 }}
            transition={{ duration: 0.65, ease: [0.65, 0, 0.2, 1] }}
            onAnimationComplete={() => done(f.id)}
          >
            <div className="relative h-full w-full">
              <ProductMedia product={p} color={f.color} sizes="72px" />
            </div>
          </motion.div>
        )
      })}
    </>
  )
}

function CartDrawer() {
  const { lines, open, setOpen, subtotal, setQty, clear, count, showSuccess } = useCart()
  const { shopById } = useCatalog()
  const [step, setStep] = useState<"bag" | "details">("bag")
  const [form, setForm] = useState({ name: "", email: "", city: "", state: "" })
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  // pick up the code handed out by the welcome popup
  useEffect(() => {
    if (!open) return
    try {
      const c = localStorage.getItem("g4-code")
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (c) setCode((v) => v || c)
    } catch {}
  }, [open])

  const codeOk = code.trim().toUpperCase() === WELCOME_CODE && subtotal >= WELCOME_MIN
  const discount = codeOk ? WELCOME_OFF : 0
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_AT ? 0 : SHIPPING
  const total = subtotal - discount + shipping
  const toFree = Math.max(0, FREE_SHIPPING_AT - subtotal)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, setOpen])

  const close = () => {
    setOpen(false)
    window.setTimeout(() => {
      setStep("bag")
      setError("")
    }, 500)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    const r = await placeOrder({
      ...form,
      code: code.trim() || undefined,
      items: lines.map((l) => ({ productId: l.productId, size: l.size, color: l.color, qty: l.qty })),
    })
    setBusy(false)
    if (!r.ok) return setError(r.error)
    try {
      localStorage.removeItem("g4-code")
    } catch {}
    track("purchase")
    showSuccess({
      orderId: r.orderId,
      total: r.total,
      discount: r.discount,
      email: form.email,
      items: lines.map((l) => ({ productId: l.productId, name: shopById.get(l.productId)?.name ?? "Item", color: l.color, colorHex: l.colorHex, size: l.size, qty: l.qty, price: shopById.get(l.productId)?.price ?? 0 })),
    })
    clear()
    setOpen(false)
    window.setTimeout(() => {
      setStep("bag")
      setForm({ name: "", email: "", city: "", state: "" })
      setCode("")
    }, 600)
  }

  const input = "w-full border-b bg-transparent py-3 text-[15px] outline-none transition-colors placeholder:text-[var(--mute)] focus:border-[var(--ink)]"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" className="fixed inset-0 z-[60] bg-[#0d0d0d]/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} data-cursor="CLOSE" />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-label="Bag"
            className="store fixed right-0 top-0 z-[70] flex h-dvh w-full max-w-[440px] flex-col border-l bg-[var(--paper)] text-[var(--ink)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.65, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              {step === "details" ? (
                <button onClick={() => setStep("bag")} className="label"><span className="u">← Bag</span></button>
              ) : (
                <span className="label">{`Bag (${count})`}</span>
              )}
              <button onClick={close} className="label"><span className="u">Close</span></button>
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col justify-between p-5">
                <p className="text-4xl font-medium leading-none tracking-tight">Your bag<br />is empty.</p>
                <Link href="/shop" onClick={close} className="label w-full bg-[var(--ink)] py-4 text-center text-[var(--paper)]">Shop all</Link>
              </div>
            ) : (
              <>
                <div className="border-b px-5 py-3">
                  <p className="label">{toFree > 0 ? `${price(toFree)} away from free shipping` : "Free shipping unlocked"}</p>
                  <div className="mt-2 h-px w-full bg-[var(--line)]">
                    <motion.div className="h-px bg-[var(--ink)]" animate={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING_AT) * 100)}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                </div>

                {step === "bag" ? (
                  <ul data-lenis-prevent className="flex-1 overflow-y-auto">
                    <AnimatePresence initial={false}>
                      {lines.map((l) => {
                        const p = shopById.get(l.productId)
                        if (!p) return null
                        return (
                          <motion.li key={l.key} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden border-b">
                            <div className="flex gap-4 p-5">
                              <Link href={p.href} onClick={close} className="relative block h-28 w-24 shrink-0 overflow-hidden">
                                <ProductMedia product={p} color={l.colorHex} sizes="96px" />
                              </Link>
                              <div className="flex min-w-0 flex-1 flex-col justify-between">
                                <div>
                                  <div className="flex justify-between gap-3 text-[13px]"><span>{p.name}</span><span className="label">{price(p.price * l.qty)}</span></div>
                                  <p className="label mt-1.5 text-[var(--mute)]">{l.color} / {l.size}</p>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="label flex items-center border">
                                    <button aria-label="Decrease" onClick={() => setQty(l.key, l.qty - 1)} className="px-3 py-2">−</button>
                                    <span className="w-5 text-center">{l.qty}</span>
                                    <button aria-label="Increase" onClick={() => setQty(l.key, l.qty + 1)} className="px-3 py-2">+</button>
                                  </div>
                                  <button onClick={() => setQty(l.key, 0)} className="label text-[var(--mute)]"><span className="u">Remove</span></button>
                                </div>
                              </div>
                            </div>
                          </motion.li>
                        )
                      })}
                    </AnimatePresence>
                  </ul>
                ) : (
                  <form id="checkout" onSubmit={submit} data-lenis-prevent className="flex-1 space-y-1 overflow-y-auto p-5">
                    <p className="label mb-3 text-[var(--mute)]">Your details</p>
                    <input className={input} required placeholder="Full name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <input className={input} required type="email" placeholder="Email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <div className="grid grid-cols-[1fr_5rem] gap-4">
                      <input className={input} placeholder="City" autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                      <input className={input} placeholder="State" autoComplete="address-level1" maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
                    </div>
                    <p className="label !mt-7 text-[var(--mute)]">Discount code</p>
                    <input className={input} placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
                    {code.trim().toUpperCase() === WELCOME_CODE && (
                      <p className="label !mt-2">{codeOk ? `${WELCOME_CODE} applied: ${price(WELCOME_OFF)} off` : `Add ${price(WELCOME_MIN - subtotal)} more to use ${WELCOME_CODE}`}</p>
                    )}
                    {error && <p className="label !mt-5 text-[#b3261e]">{error}</p>}
                  </form>
                )}

                <div className="border-t p-5">
                  <dl className="label space-y-2">
                    <div className="flex justify-between"><dt>Subtotal</dt><dd>{price(subtotal)}</dd></div>
                    {discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{price(discount)}</dd></div>}
                    <div className="flex justify-between"><dt>Shipping</dt><dd>{shipping ? price(shipping) : "Free"}</dd></div>
                    <div className="flex justify-between pt-1 text-[12px]"><dt>Total</dt><dd>{price(total)}</dd></div>
                  </dl>
                  {step === "bag" ? (
                    <button onClick={() => { track("checkout_start"); setStep("details") }} data-cursor="NEXT" className="label group relative mt-5 w-full overflow-hidden bg-[var(--ink)] py-4 text-[var(--paper)]">
                      <span className="absolute inset-0 origin-bottom scale-y-0 bg-[var(--paper)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100" />
                      <span className="relative mix-blend-difference">Checkout — {price(total)}</span>
                    </button>
                  ) : (
                    <button form="checkout" type="submit" disabled={busy} data-cursor="PAY" className="label group relative mt-5 w-full overflow-hidden bg-[var(--ink)] py-4 text-[var(--paper)] disabled:opacity-60">
                      <span className="absolute inset-0 origin-bottom scale-y-0 bg-[var(--paper)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100" />
                      <span className="relative mix-blend-difference">{busy ? "Placing order…" : `Place order — ${price(total)}`}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
