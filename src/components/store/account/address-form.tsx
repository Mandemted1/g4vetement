"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { saveAddress } from "@/app/(store)/account/actions"
import type { Address } from "@/lib/account-types"
import { shippableCountries } from "@/lib/shipping"
import { cn } from "@/lib/utils"
import { useCatalog } from "../catalog"

const input = "w-full border-b bg-transparent py-3 text-[15px] outline-none transition-colors placeholder:text-[var(--mute)] focus:border-[var(--ink)]"

/** The name and delivery address that checkout prefills. */
export function AddressForm({ name: initialName, address }: { name: string; address: Address | null }) {
  const router = useRouter()
  const { shipping } = useCatalog()
  const countries = useMemo(() => shippableCountries(shipping), [shipping])
  const [name, setName] = useState(initialName)
  const [a, setA] = useState<Address>(address ?? { address: "", city: "", state: "", postcode: "", country: countries[0]?.code ?? "" })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const set = (k: keyof Address, v: string) => setA((x) => ({ ...x, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    start(async () => {
      const r = await saveAddress({ ...a, name })
      if (!r.ok) return setMsg({ ok: false, text: r.error })
      setMsg({ ok: true, text: "Saved. We'll fill this in at checkout." })
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-1">
      <input className={input} required placeholder="Full name" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      <input className={input} required placeholder="Address" autoComplete="address-line1" maxLength={200} value={a.address} onChange={(e) => set("address", e.target.value)} />
      <div className="grid grid-cols-2 gap-4">
        <input className={input} required placeholder="City" autoComplete="address-level2" maxLength={80} value={a.city} onChange={(e) => set("city", e.target.value)} />
        <input className={input} placeholder="Postcode (if any)" autoComplete="postal-code" maxLength={20} value={a.postcode} onChange={(e) => set("postcode", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <input className={input} placeholder="State / region" autoComplete="address-level1" maxLength={80} value={a.state} onChange={(e) => set("state", e.target.value)} />
        <select className={cn(input, "cursor-pointer")} required aria-label="Country" autoComplete="country" value={a.country} onChange={(e) => set("country", e.target.value)}>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={cn("label !mt-4 leading-relaxed", msg.ok ? "" : "text-[#b3261e]")}>{msg.text}</p>}
      <button type="submit" disabled={pending} className="label !mt-6 border border-[var(--ink)] px-6 py-3 transition-colors duration-500 hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-60">
        {pending ? "Saving…" : "Save address"}
      </button>
    </form>
  )
}
