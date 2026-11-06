"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { onSale, price, sizeLeft, unitPrice } from "@/lib/store"
import { guessCountry } from "@/lib/countries"
import { quoteShipping, shippableCountries } from "@/lib/shipping"
import { placeOrder, quoteOrder, type QuoteResult } from "@/app/(store)/actions"
import { saveAddress } from "@/app/(store)/account/actions"
import { saveCartSnapshot } from "@/app/(store)/actions"
import { cn } from "@/lib/utils"
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
  /** replace the bag with these lines (when someone returns from a reminder email) and show it */
  restore: (lines: CartLine[]) => void
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
  // set when a bag was restored from a reminder email: the saved bag in this browser must not overwrite it
  const restored = useRef(false)
  const fid = useRef(0)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw && !restored.current) setLines((JSON.parse(raw) as CartLine[]).filter((l) => shopById.has(l.productId)))
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
    if (!p || sizeLeft(p, l.size) <= 0) return
    const key = `${l.productId}|${l.size}|${l.color}`
    // a line can't go past what's left in its size (checkout also checks all colours of a size together)
    const cap = Math.min(MAX_QTY, sizeLeft(p, l.size))
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
        const p = shopById.get(l.productId)
        return [{ ...l, qty: Math.min(qty, MAX_QTY, p ? sizeLeft(p, l.size) : MAX_QTY) }]
      }),
    )
  }, [shopById])
  const clear = useCallback(() => setLines([]), [])
  const restore = useCallback((next: CartLine[]) => {
    restored.current = true
    setLines(next.filter((l) => shopById.has(l.productId)))
    setOpen(true)
  }, [shopById])

  const count = lines.reduce((s, l) => s + l.qty, 0)
  const subtotal = lines.reduce((s, l) => s + l.qty * unitPrice(shopById.get(l.productId) ?? { price: 0 }), 0)
  const value = useMemo(() => ({ lines, count, subtotal, open, setOpen, add, setQty, restore, clear, bumped, showSuccess: setSuccess }), [lines, count, subtotal, open, add, setQty, restore, clear, bumped])

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
  const { lines, open, setOpen, setQty, clear, count, showSuccess } = useCart()
  const { shopById, shipping, account, cartReminders } = useCatalog()
  const [step, setStep] = useState<"bag" | "details">("bag")
  // signed in: start from the saved name, email and address
  const blankForm = () => ({ name: account?.name ?? "", email: account?.email ?? "", address: account?.address?.address ?? "", city: account?.address?.city ?? "", state: account?.address?.state ?? "", postcode: account?.address?.postcode ?? "" })
  const [form, setForm] = useState(blankForm)
  const [saveAddr, setSaveAddr] = useState(true)
  // where the order is going: remembered between visits, guessed from the browser language the first time
  const countries = useMemo(() => shippableCountries(shipping), [shipping])
  const [country, setCountry] = useState("")
  useEffect(() => {
    const codes = new Set(countries.map((c) => c.code))
    let saved = ""
    try {
      saved = localStorage.getItem("g4-country") ?? ""
    } catch {}
    const guess = guessCountry(typeof navigator === "undefined" ? [] : navigator.languages ?? [])
    const mine = account?.address?.country ?? ""
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountry((cur) => (cur && codes.has(cur) ? cur : codes.has(mine) ? mine : codes.has(saved) ? saved : guess && codes.has(guess) ? guess : (countries[0]?.code ?? "")))
  }, [countries, account])
  const pickCountry = (c: string) => {
    setCountry(c)
    try {
      localStorage.setItem("g4-country", c)
    } catch {}
  }
  const [typed, setTyped] = useState("")
  const [applied, setApplied] = useState("")
  const [showCode, setShowCode] = useState(false)
  const [giftTyped, setGiftTyped] = useState("")
  const [giftApplied, setGiftApplied] = useState("")
  const [showGift, setShowGift] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ key: string; r: QuoteResult } | null>(null)

  // pick up the code handed out by the welcome popup
  useEffect(() => {
    if (!open) return
    try {
      const c = localStorage.getItem("g4-code")
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (c) setApplied((v) => v || c)
    } catch {}
  }, [open])

  // The database prices the bag: sales, code, shipping and total. Re-asked whenever the bag, code or email changes.
  const email = step === "details" ? form.email.trim() : ""
  const key = JSON.stringify({ l: lines.map((l) => [l.productId, l.size, l.color, l.qty]), c: applied, g: giftApplied, e: email, k: country })
  useEffect(() => {
    if (!open || lines.length === 0) return
    let alive = true
    const t = window.setTimeout(async () => {
      const r = await quoteOrder({ email, code: applied || undefined, gift: giftApplied || undefined, country: country || undefined, items: lines.map((l) => ({ productId: l.productId, size: l.size, color: l.color, qty: l.qty })) })
      if (alive) setResult({ key, r })
    }, 250)
    return () => {
      alive = false
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, open])

  // With reminders on: once a plausible email is typed at checkout, remember the bag (after a short pause) so one reminder can be sent
  const typedEmail = step === "details" ? form.email.trim() : ""
  const snapshotKey = JSON.stringify({ e: typedEmail, l: lines.map((l) => [l.productId, l.size, l.color, l.qty]), k: country })
  useEffect(() => {
    if (!cartReminders || !open || lines.length === 0 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(typedEmail)) return
    const t = window.setTimeout(() => {
      void saveCartSnapshot({ email: typedEmail, country: country || undefined, items: lines.map((l) => ({ productId: l.productId, size: l.size, color: l.color, qty: l.qty })) })
    }, 2500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotKey, cartReminders, open])

  const loading = lines.length > 0 && result?.key !== key
  const q = result?.r.ok ? result.r.quote : null
  const bagError = result && !result.r.ok && result.key === key ? result.r.error : ""
  // until the first answer arrives, show what we can work out locally
  const localSubtotal = lines.reduce((s, l) => s + l.qty * unitPrice(shopById.get(l.productId) ?? { price: 0 }), 0)
  const subtotalNow = q?.subtotal ?? localSubtotal
  const total = q?.total ?? localSubtotal
  // shipping: the database's answer once it arrives; until then the same rules worked out here
  const localShip = quoteShipping(shipping, country || null, localSubtotal)
  const ship = q ? { price: q.shipping, freeOver: q.freeOver, estimate: q.shipEstimate, error: q.shipError } : localShip
  const freeShip = ship.price === 0 && !ship.error
  const toFree = ship.freeOver === null ? 0 : Math.max(0, ship.freeOver - subtotalNow)
  const showBanner = !ship.error && (ship.freeOver !== null || ship.price === 0)

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

  const apply = () => {
    const c = typed.trim().toUpperCase()
    if (!c) return
    setApplied(c)
    setTyped("")
    setShowCode(false)
  }
  const removeCode = () => {
    setApplied("")
    try {
      localStorage.removeItem("g4-code")
    } catch {}
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    const r = await placeOrder({
      ...form,
      country,
      code: applied || undefined,
      gift: giftApplied || undefined,
      items: lines.map((l) => ({ productId: l.productId, size: l.size, color: l.color, qty: l.qty })),
    })
    setBusy(false)
    if (!r.ok) return setError(r.error)
    try {
      localStorage.removeItem("g4-code")
    } catch {}
    track("purchase")
    // keep the address for next time (best effort: never blocks the order)
    if (account && saveAddr) void saveAddress({ address: form.address, city: form.city, state: form.state, postcode: form.postcode, country, name: form.name })
    showSuccess({
      orderId: r.orderId,
      total: r.total,
      discount: r.discount,
      saleDiscount: r.saleDiscount,
      shipping: r.shipping,
      subtotal: r.subtotal,
      email: form.email,
      giftAmount: r.giftAmount,
      amountDue: r.amountDue,
      estimate: r.estimate,
      shipTo: [form.name.trim(), form.address.trim(), [form.city.trim(), form.state.trim(), form.postcode.trim()].filter(Boolean).join(", "), countries.find((c) => c.code === country)?.name ?? country].filter(Boolean).join("\n"),
      items: lines.map((l) => {
        const p = shopById.get(l.productId)
        return { productId: l.productId, name: p?.name ?? "Item", color: l.color, colorHex: l.colorHex, size: l.size, qty: l.qty, price: p ? unitPrice(p) : 0 }
      }),
    })
    clear()
    setOpen(false)
    window.setTimeout(() => {
      setStep("bag")
      setForm(blankForm())
      setApplied("")
      setTyped("")
      setGiftApplied("")
      setGiftTyped("")
      setShowGift(false)
    }, 600)
  }

  const input = "w-full border-b bg-transparent py-3 text-[15px] outline-none transition-colors placeholder:text-[var(--mute)] focus:border-[var(--ink)]"
  // a gift card that can't be used blocks checkout until it's removed (a discount code just doesn't apply)
  const canCheckout = !loading && !bagError && !ship.error && !q?.giftError && lines.length > 0
  // what the shopper still pays after any gift card
  const due = q ? q.amountDue : total
  const dueLabel = due === 0 && q && q.giftAmount > 0 ? "paid with gift card" : price(due)
  const maskGift = (c: string) => (c.length > 4 ? `••••${c.slice(-4)}` : c)

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
                {showBanner && (
                  <div className="border-b px-5 py-3">
                    <p className="label">{freeShip ? (ship.freeOver === null ? "Free shipping" : "Free shipping unlocked") : `${price(toFree)} away from free shipping`}</p>
                    <div className="mt-2 h-px w-full bg-[var(--line)]">
                      <motion.div className="h-px bg-[var(--ink)]" animate={{ width: `${freeShip || ship.freeOver === null ? 100 : Math.min(100, (subtotalNow / ship.freeOver) * 100)}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
                    </div>
                  </div>
                )}

                {step === "bag" ? (
                  <div data-lenis-prevent className="flex-1 overflow-y-auto">
                    <ul>
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
                                    <div className="flex justify-between gap-3 text-[13px]">
                                      <span>{p.name}</span>
                                      <span className="label shrink-0 text-right">
                                        {onSale(p) && <s className="mr-1.5 text-[var(--mute)]">{price(p.price * l.qty)}</s>}
                                        {price(unitPrice(p) * l.qty)}
                                      </span>
                                    </div>
                                    <p className="label mt-1.5 text-[var(--mute)]">{l.color} / {l.size}{onSale(p) ? ` / ${p.salePercent}% off` : ""}</p>
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

                    {/* gift card */}
                    <div className="border-t px-5 py-5">
                      {giftApplied ? (
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="label border border-dashed border-[var(--ink)] px-2.5 py-1.5">Gift card {maskGift(giftApplied)}{q && q.giftAmount > 0 ? ` · −${price(q.giftAmount)}` : ""}</span>
                            <button onClick={() => setGiftApplied("")} className="label text-[var(--mute)]"><span className="u">Remove</span></button>
                          </div>
                          {q?.giftError && <p role="alert" className="label mt-2.5 leading-relaxed text-[#b3261e]">{q.giftError}</p>}
                          {q && q.giftAmount > 0 && q.giftBalanceAfter !== null && <p className="label mt-2.5 text-[var(--mute)]">{q.giftBalanceAfter > 0 ? `${price(q.giftBalanceAfter)} will be left on the card` : "This uses the rest of the card"}</p>}
                        </div>
                      ) : showGift ? (
                        <form onSubmit={(e) => { e.preventDefault(); const g = giftTyped.trim().toUpperCase().replace(/\s+/g, ""); if (g) { setGiftApplied(g); setGiftTyped(""); setShowGift(false) } }} className="flex items-end gap-3 border-b border-[var(--ink)]">
                          <input autoFocus value={giftTyped} onChange={(e) => setGiftTyped(e.target.value)} placeholder="Gift card code" aria-label="Gift card code" autoComplete="off" spellCheck={false} className="w-full bg-transparent py-2.5 text-[15px] uppercase outline-none placeholder:normal-case placeholder:text-[var(--mute)]" />
                          <button type="submit" disabled={!giftTyped.trim()} className="label shrink-0 pb-2.5 disabled:opacity-40"><span className="u">Apply</span></button>
                        </form>
                      ) : (
                        <button onClick={() => setShowGift(true)} className="label text-[var(--mute)]"><span className="u">+ Add a gift card</span></button>
                      )}
                    </div>

                    {/* discount code */}
                    <div className="px-5 py-5">
                      {applied ? (
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="label border border-dashed border-[var(--ink)] px-2.5 py-1.5">{applied}{q?.code && q.discount > 0 ? ` · −${price(q.discount)}` : q?.code && q.freeShipping ? " · Free shipping" : ""}</span>
                            <button onClick={removeCode} className="label text-[var(--mute)]"><span className="u">Remove</span></button>
                          </div>
                          {q?.codeError && <p className="label mt-2.5 leading-relaxed text-[#b3261e]">{q.codeError}</p>}
                          {q?.codeNote && !q.codeError && <p className="label mt-2.5 text-[var(--mute)]">{q.codeNote}</p>}
                        </div>
                      ) : showCode ? (
                        <form onSubmit={(e) => { e.preventDefault(); apply() }} className="flex items-end gap-3 border-b border-[var(--ink)]">
                          <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Discount code" aria-label="Discount code" className="w-full bg-transparent py-2.5 text-[15px] uppercase outline-none placeholder:normal-case placeholder:text-[var(--mute)]" />
                          <button type="submit" disabled={!typed.trim()} className="label shrink-0 pb-2.5 disabled:opacity-40"><span className="u">Apply</span></button>
                        </form>
                      ) : (
                        <button onClick={() => setShowCode(true)} className="label text-[var(--mute)]"><span className="u">+ Add a discount code</span></button>
                      )}
                    </div>
                  </div>
                ) : (
                  <form id="checkout" onSubmit={submit} data-lenis-prevent className="flex-1 space-y-1 overflow-y-auto p-5">
                    <p className="label mb-3 text-[var(--mute)]">{account ? `Signed in as ${account.email}` : "Your details"}</p>
                    <input className={input} required placeholder="Full name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    <input className={input} required type="email" placeholder="Email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    <p className="label !mt-7 mb-1 text-[var(--mute)]">Delivery address</p>
                    <input className={input} required placeholder="Address" autoComplete="address-line1" maxLength={200} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    <div className="grid grid-cols-2 gap-4">
                      <input className={input} required placeholder="City" autoComplete="address-level2" maxLength={80} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                      <input className={input} placeholder="Postcode (if any)" autoComplete="postal-code" maxLength={20} value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input className={input} placeholder="State / region" autoComplete="address-level1" maxLength={80} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                      <select className={cn(input, "cursor-pointer")} required aria-label="Country" autoComplete="country" value={country} onChange={(e) => pickCountry(e.target.value)}>
                        {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                    {cartReminders && <p className="label !mt-4 leading-relaxed text-[var(--mute)]">If you leave without ordering, we may send you one reminder email about your bag. You can stop it with one click.</p>}
                    {account && (
                      <label className="label !mt-6 flex cursor-pointer items-center gap-3">
                        <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} className="size-4 accent-[var(--ink)]" />
                        Save this address to my account
                      </label>
                    )}
                    {applied && (
                      <p className={cn("label !mt-6 leading-relaxed", q?.codeError ? "text-[#b3261e]" : "")}>
                        {q?.codeError ? `${applied}: ${q.codeError}` : q?.code ? `${applied} applied` : `${applied}…`}
                      </p>
                    )}
                    {(error || bagError || ship.error) && <p className="label !mt-5 leading-relaxed text-[#b3261e]">{error || bagError || ship.error}</p>}
                  </form>
                )}

                <div className="border-t p-5">
                  <dl className={cn("label space-y-2 transition-opacity", loading && "opacity-50")} aria-busy={loading}>
                    <div className="flex justify-between"><dt>Subtotal</dt><dd>{price(q?.listSubtotal ?? localSubtotal)}</dd></div>
                    {q && q.saleDiscount > 0 && <div className="flex justify-between"><dt>Sale</dt><dd>−{price(q.saleDiscount)}</dd></div>}
                    {q && q.discount > 0 && <div className="flex justify-between"><dt>Discount{q.code ? ` (${q.code})` : ""}</dt><dd>−{price(q.discount)}</dd></div>}
                    {step === "bag" && countries.length > 0 && (
                      <div className="flex items-center justify-between gap-4">
                        <dt><label htmlFor="ship-to">Ship to</label></dt>
                        <dd className="min-w-0">
                          <select id="ship-to" value={country} onChange={(e) => pickCountry(e.target.value)} data-cursor="" className="label max-w-full cursor-pointer truncate border-b border-transparent bg-transparent py-0.5 text-right outline-none transition-colors hover:border-[var(--ink)] focus:border-[var(--ink)]">
                            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                          </select>
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between"><dt>Shipping</dt><dd>{ship.error ? "–" : q ? (q.shipping ? price(q.shipping) : "Free") : "–"}</dd></div>
                    {q && !ship.error && q.shipEstimate && <div className="flex justify-between"><dt>Delivery</dt><dd>{q.shipEstimate}</dd></div>}
                    <div className="flex justify-between pt-1 text-[12px]"><dt>Total</dt><dd>{price(total)}</dd></div>
                    {q && q.giftAmount > 0 && <div className="flex justify-between"><dt>Gift card</dt><dd>−{price(q.giftAmount)}</dd></div>}
                    {q && q.giftAmount > 0 && <div className="flex justify-between text-[12px]"><dt>To pay</dt><dd>{price(q.amountDue)}</dd></div>}
                  </dl>
                  {step === "bag" ? (
                    <button onClick={() => { track("checkout_start"); setStep("details") }} disabled={!canCheckout} data-cursor="NEXT" className="label group relative mt-5 w-full overflow-hidden bg-[var(--ink)] py-4 text-[var(--paper)] disabled:opacity-60">
                      <span className="absolute inset-0 origin-bottom scale-y-0 bg-[var(--paper)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100" />
                      <span className="relative mix-blend-difference">{bagError ? "Update your bag" : `Checkout — ${dueLabel}`}</span>
                    </button>
                  ) : (
                    <button form="checkout" type="submit" disabled={busy || !canCheckout || Boolean(q?.codeError) || Boolean(q?.giftError)} data-cursor="PAY" className="label group relative mt-5 w-full overflow-hidden bg-[var(--ink)] py-4 text-[var(--paper)] disabled:opacity-60">
                      <span className="absolute inset-0 origin-bottom scale-y-0 bg-[var(--paper)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100" />
                      <span className="relative mix-blend-difference">{busy ? "Placing order…" : `Place order — ${dueLabel}`}</span>
                    </button>
                  )}
                  {(bagError || ship.error) && step === "bag" && <p className="label mt-3 leading-relaxed text-[#b3261e]">{bagError || ship.error}</p>}
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
