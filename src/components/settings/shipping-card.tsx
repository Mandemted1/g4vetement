"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangleIcon, PlusIcon, SearchIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { deleteZone, saveZone, setZoneActive } from "@/app/admin/(panel)/shipping-actions"
import { COUNTRIES, countryName } from "@/lib/countries"
import { WORLD, cleanZone, describeZone, type ShippingZone } from "@/lib/shipping"
import { cn } from "@/lib/utils"

const lbl = "flex flex-col gap-1.5 text-sm font-medium"
const hint = "text-xs font-normal text-muted-foreground"

export function ShippingCard({ zones, missing, demo }: { zones: ShippingZone[]; missing: boolean; demo: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState<ShippingZone | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const anyActive = zones.some((z) => z.active)

  const toggle = (z: ShippingZone, active: boolean) =>
    start(async () => {
      setError("")
      const r = await setZoneActive(z.id, active)
      if (!r.ok) return setError(r.error)
      router.refresh()
    })

  return (
    <Card className="rise" style={{ "--i": 2 } as React.CSSProperties}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Shipping</CardTitle>
            <CardDescription>Where you ship and what it costs. Shoppers pick their country at checkout and see the price before they pay.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreating(true)} disabled={demo || missing}><PlusIcon /> Add zone</Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {demo && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Demo mode: connect Supabase to set up shipping.</p>}
        {missing && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Shipping isn&apos;t installed yet. Run <code>npm run migrate</code> first.</p>}
        {error && <p className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p>}
        {!demo && !missing && !anyActive && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" />
            <p><b className="font-medium">Nobody can check out.</b> There&apos;s no active shipping zone, so every country is refused. Switch a zone on or add one.</p>
          </div>
        )}

        {zones.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {zones.map((z) => (
              <li key={z.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <button type="button" onClick={() => setEditing(z)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${z.name}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{z.name}</span>
                    {!z.active && <Badge variant="secondary" className="border-0 bg-muted text-muted-foreground">Off</Badge>}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{describeZone(z)}</span>
                </button>
                <input type="checkbox" aria-label={`${z.name} on or off`} checked={z.active} disabled={pending} onChange={(e) => toggle(z, e.target.checked)} className="size-4" />
              </li>
            ))}
          </ul>
        )}
        {zones.length === 0 && !demo && !missing && <p className="py-6 text-center text-sm text-muted-foreground">No shipping zones yet. Add one to start taking orders.</p>}

        <p className={cn(hint, "leading-relaxed")}>
          A country can only be in one zone. A zone set to <b className="font-medium text-foreground">Everywhere else</b> serves every country you haven&apos;t listed; without one, you only ship to the countries you add.
          Prices are in whole US dollars.
        </p>
      </CardContent>

      <Sheet open={creating || !!editing} onOpenChange={(v) => !v && (setCreating(false), setEditing(null))}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {(creating || editing) && <ZoneForm key={editing?.id ?? "new"} zone={editing} others={zones.filter((z) => z.id !== editing?.id)} onClose={() => { setCreating(false); setEditing(null) }} />}
        </SheetContent>
      </Sheet>
    </Card>
  )
}

function ZoneForm({ zone, others, onClose }: { zone: ShippingZone | null; others: ShippingZone[]; onClose: () => void }) {
  const router = useRouter()
  const worldTaken = others.some((z) => z.countries.includes(WORLD))
  const [name, setName] = useState(zone?.name ?? "")
  const [where, setWhere] = useState<"countries" | "world">(zone?.countries.includes(WORLD) ? "world" : "countries")
  const [picked, setPicked] = useState<string[]>(zone?.countries.filter((c) => c !== WORLD) ?? [])
  const [rate, setRate] = useState(String(zone?.rate ?? 10))
  const [freeOver, setFreeOver] = useState(zone?.freeOver != null ? String(zone.freeOver) : "")
  const [estimate, setEstimate] = useState(zone?.estimate ?? "")
  const [active, setActive] = useState(zone?.active ?? true)
  const [q, setQ] = useState("")
  const [err, setErr] = useState("")
  const [saving, start] = useTransition()

  // which zone already has each country
  const taken = useMemo(() => {
    const m = new Map<string, string>()
    for (const z of others) for (const c of z.countries) m.set(c, z.name)
    return m
  }, [others])
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return COUNTRIES.filter((c) => !t || c.name.toLowerCase().includes(t) || c.code.toLowerCase() === t)
  }, [q])

  const input = {
    name,
    countries: where === "world" ? [WORLD] : picked,
    rate: rate.trim() === "" ? NaN : Number(rate),
    freeOver: freeOver.trim() === "" ? null : Number(freeOver),
    estimate,
    active,
  }
  const check = cleanZone(input, others)
  const summary = check.ok ? describeZone({ ...check.value }) : ""

  const toggle = (code: string) => setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]))

  const save = () =>
    start(async () => {
      setErr("")
      const r = await saveZone(zone?.id ?? null, input)
      if (!r.ok) return setErr(r.error)
      router.refresh()
      onClose()
    })
  const remove = () => {
    if (!zone || !window.confirm(`Delete the zone “${zone.name}”? Countries in it will stop being served unless another zone covers them.`)) return
    start(async () => {
      const r = await deleteZone(zone.id)
      if (!r.ok) return setErr(r.error)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-8">
      <SheetHeader className="px-0">
        <SheetTitle>{zone ? zone.name : "New shipping zone"}</SheetTitle>
        <SheetDescription>Countries that share a price and delivery time.</SheetDescription>
      </SheetHeader>

      <label className={lbl}>
        Name
        <Input value={name} maxLength={40} placeholder="e.g. Ghana, Europe, Rest of world" onChange={(e) => setName(e.target.value)} />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Ships to</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="where" checked={where === "countries"} onChange={() => setWhere("countries")} className="size-4" />
          Specific countries
        </label>
        <label className={cn("flex items-center gap-2 text-sm", worldTaken && "opacity-50")}>
          <input type="radio" name="where" checked={where === "world"} disabled={worldTaken} onChange={() => setWhere("world")} className="size-4" />
          Everywhere else <span className={hint}>(every country not in another zone)</span>
        </label>
        {worldTaken && where !== "world" && <p className={hint}>You already have an “everywhere else” zone, so only one can exist.</p>}

        {where === "countries" && (
          <>
            {picked.length > 0 && (
              <div className="flex flex-wrap gap-1.5" aria-label="Chosen countries">
                {picked.map((c) => (
                  <button key={c} type="button" onClick={() => toggle(c)} aria-label={`Remove ${countryName(c)}`} className="rounded-full border bg-muted px-2.5 py-1 text-xs transition-colors hover:bg-muted/60">
                    {countryName(c)} <span aria-hidden className="ml-0.5 text-muted-foreground">×</span>
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries" aria-label="Search countries" className="pl-8" />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-lg border" role="group" aria-label="Countries">
              {shown.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No country matches “{q}”.</p>}
              {shown.map((c) => {
                const other = taken.get(c.code)
                return (
                  <label key={c.code} className={cn("flex items-center gap-2.5 border-b px-3 py-2 text-sm last:border-b-0", other ? "opacity-50" : "cursor-pointer hover:bg-muted/50")}>
                    <input type="checkbox" checked={picked.includes(c.code)} disabled={!!other} onChange={() => toggle(c.code)} className="size-4" />
                    <span className="flex-1">{c.name}</span>
                    {other && <span className="text-xs text-muted-foreground">in {other}</span>}
                  </label>
                )
              })}
            </div>
          </>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>
          Price ($)
          <Input type="number" inputMode="numeric" min={0} value={rate} onChange={(e) => setRate(e.target.value)} />
          <span className={hint}>0 = free shipping</span>
        </label>
        <label className={lbl}>
          Free over ($)
          <Input type="number" inputMode="numeric" min={1} value={freeOver} placeholder="Never" onChange={(e) => setFreeOver(e.target.value)} />
          <span className={hint}>Free once the bag reaches this, after sales</span>
        </label>
      </div>

      <label className={lbl}>
        Delivery time <span className="font-normal text-muted-foreground">(shown to shoppers)</span>
        <Input value={estimate} maxLength={60} placeholder="e.g. 3–5 business days" onChange={(e) => setEstimate(e.target.value)} />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4" />
        Active (shoppers can use this zone)
      </label>

      <p className={cn("rounded-lg px-3 py-2 text-sm", check.ok ? "bg-muted text-muted-foreground" : "bg-muted/50 text-muted-foreground")} aria-live="polite">
        {check.ok ? summary : "Fill in the details above."}
      </p>
      {err && <p className="rounded-md bg-negative/10 px-3 py-2 text-sm text-negative">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={saving} className="flex-1">{saving ? "Saving…" : zone ? "Save changes" : "Add zone"}</Button>
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        {zone && <Button variant="ghost" className="text-negative hover:text-negative" onClick={remove} disabled={saving}>Delete</Button>}
      </div>
    </div>
  )
}
