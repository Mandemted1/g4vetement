"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { DicesIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { createCode, deleteCode, updateCode } from "@/app/admin/(panel)/discount-actions"
import { useAdmin } from "@/components/admin-data"
import { describeCode, type CodeKind, type CodeStats, type DiscountCode } from "@/lib/discount-types"
import type { CodeInput } from "@/lib/discount-validate"
import { dateLabel, money } from "@/lib/format"
import { cn } from "@/lib/utils"

const field = "flex flex-col gap-1.5 text-sm"
const hint = "text-xs font-normal text-muted-foreground"
const area = "min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

/** <input type=datetime-local> works in the viewer's local time; the database stores UTC. */
const toLocal = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fromLocal = (s: string) => (s ? new Date(s).toISOString() : null)

const KINDS: { value: CodeKind; label: string; hint: string }[] = [
  { value: "percent", label: "Percent off", hint: "e.g. 20% off" },
  { value: "fixed", label: "Amount off", hint: "e.g. $10 off" },
  { value: "free_shipping", label: "Free shipping", hint: "Removes the shipping fee" },
]

const randomCode = () => "SAVE-" + Array.from({ length: 5 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("")

export function CodeEditor({ code, stats, open, onClose }: { code: DiscountCode | null; stats?: CodeStats; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">{open && <Form key={code?.id ?? "new"} code={code} stats={stats} onClose={onClose} />}</SheetContent>
    </Sheet>
  )
}

function Form({ code, stats, onClose }: { code: DiscountCode | null; stats?: CodeStats; onClose: () => void }) {
  const router = useRouter()
  const { categories } = useAdmin()
  const [name, setName] = useState(code?.code ?? "")
  const [kind, setKind] = useState<CodeKind>(code?.kind ?? "percent")
  const [value, setValue] = useState(String(code?.value ?? 10))
  const [minSpend, setMinSpend] = useState(String(code?.minSpend ?? 0))
  const [scope, setScope] = useState<"all" | "categories">(code?.categories?.length ? "categories" : "all")
  const [cats, setCats] = useState<string[]>(code?.categories ?? [])
  const [startsAt, setStartsAt] = useState(toLocal(code?.startsAt ?? null))
  const [endsAt, setEndsAt] = useState(toLocal(code?.endsAt ?? null))
  const [limit, setLimit] = useState(code?.usageLimit ? String(code.usageLimit) : "")
  const [once, setOnce] = useState(code?.oncePerCustomer ?? false)
  const [first, setFirst] = useState(code?.firstOrderOnly ?? false)
  const [active, setActive] = useState(code?.active ?? true)
  const [note, setNote] = useState(code?.note ?? "")
  const [err, setErr] = useState("")
  const [saving, start] = useTransition()
  const [deleting, startDelete] = useTransition()

  const input = (): CodeInput => ({
    code: name,
    kind,
    value: kind === "free_shipping" ? 0 : Number(value),
    minSpend: Number(minSpend || 0),
    categories: scope === "categories" ? cats : null,
    startsAt: fromLocal(startsAt),
    endsAt: fromLocal(endsAt),
    usageLimit: limit.trim() ? Number(limit) : null,
    oncePerCustomer: once,
    firstOrderOnly: first,
    active,
    note,
  })
  const summary = describeCode({ ...input(), value: Number(value) || 0 })

  const save = () =>
    start(async () => {
      setErr("")
      const r = code ? await updateCode(code.id, input()) : await createCode(input())
      if (!r.ok) return setErr(r.error)
      router.refresh()
      onClose()
    })
  const remove = () => {
    if (!code || !window.confirm(`Delete ${code.code}?`)) return
    startDelete(async () => {
      const r = await deleteCode(code.id)
      if (!r.ok) return setErr(r.error)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-8">
      <SheetHeader className="px-0">
        <SheetTitle>{code ? code.code : "New discount code"}</SheetTitle>
        <SheetDescription>{code ? "Changes apply to the next checkout." : "Shoppers type this at checkout."}</SheetDescription>
      </SheetHeader>

      <label className={field}>
        Code
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value.toUpperCase().replace(/\s/g, ""))} maxLength={24} placeholder="SUMMER20" className="font-mono uppercase" />
          {!code && <Button type="button" variant="outline" onClick={() => setName(randomCode())}><DicesIcon /> Generate</Button>}
        </div>
        <span className={hint}>Letters, numbers, dashes. Shoppers can type it in any case.</span>
      </label>

      <div className={field}>
        <span>What it does</span>
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button key={k.value} type="button" onClick={() => setKind(k.value)} className={cn("rounded-lg border p-2.5 text-left transition-colors hover:bg-muted", kind === k.value && "border-foreground bg-muted")}>
              <span className="block text-sm font-medium">{k.label}</span>
              <span className="block text-[11px] text-muted-foreground">{k.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {kind !== "free_shipping" && (
        <label className={field}>
          {kind === "percent" ? "Percent off" : "Dollars off"}
          <div className="relative w-40">
            <Input type="number" min={1} max={kind === "percent" ? 100 : undefined} value={value} onChange={(e) => setValue(e.target.value)} className="pr-8" />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{kind === "percent" ? "%" : "$"}</span>
          </div>
          <span className={hint}>Rounded to the nearest dollar. A fixed amount never takes more than the bag is worth.</span>
        </label>
      )}

      <label className={field}>
        Minimum spend
        <div className="relative w-40">
          <Input type="number" min={0} value={minSpend} onChange={(e) => setMinSpend(e.target.value)} className="pl-6" />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        </div>
        <span className={hint}>Measured on the bag after any sale. 0 means no minimum.</span>
      </label>

      <div className={field}>
        <span>Applies to</span>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={scope === "all"} onChange={() => setScope("all")} /> Everything</label>
          <label className="flex items-center gap-2"><input type="radio" checked={scope === "categories"} onChange={() => setScope("categories")} /> Specific categories</label>
        </div>
        {scope === "categories" && (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => {
              const on = cats.includes(c.name)
              return (
                <button key={c.id} type="button" onClick={() => setCats(on ? cats.filter((x) => x !== c.name) : [...cats, c.name])} className={cn("rounded-lg border px-2.5 py-1 text-sm transition-colors hover:bg-muted", on && "border-foreground bg-muted font-medium")}>
                  {c.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={field}>Starts <span className={hint}>(optional)</span><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
        <label className={field}>Ends <span className={hint}>(optional)</span><Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
      </div>

      <div className={field}>
        <span>Limits</span>
        <label className="flex items-center gap-3 text-sm">
          <Input type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="∞" className="w-24" />
          total uses across all customers <span className={hint}>(empty = unlimited)</span>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} className="size-4" /> One use per customer</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={first} onChange={(e) => setFirst(e.target.checked)} className="size-4" /> First orders only <span className={hint}>(customer has never ordered)</span></label>
      </div>

      <label className={field}>
        Note <span className={hint}>(only you see this)</span>
        <textarea className={area} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Influencer collab, November" />
      </label>

      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4" /> Code is switched on</label>

      <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">Summary: </span>{name || "CODE"}: {summary}</p>

      {code && stats && (
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-sm font-medium">How it&apos;s doing</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Orders</div><div className="text-lg font-semibold tabular">{stats.uses}</div></div>
            <div><div className="text-xs text-muted-foreground">Sales with it</div><div className="text-lg font-semibold tabular">{money(stats.revenue)}</div></div>
            <div><div className="text-xs text-muted-foreground">Given off</div><div className="text-lg font-semibold tabular">{money(stats.discounted)}</div></div>
          </div>
          {stats.recent.length > 0 && (
            <ul className="mt-3 divide-y text-xs text-muted-foreground">
              {stats.recent.map((o) => <li key={o.id} className="flex justify-between py-1.5"><span>#{o.id} · {dateLabel(o.date)}</span><span className="tabular">{money(o.total)}</span></li>)}
            </ul>
          )}
        </div>
      )}

      {err && <p className="rounded-md bg-negative/10 px-3 py-2 text-sm text-negative">{err}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving || deleting} className="flex-1">{saving ? "Saving…" : code ? "Save changes" : "Create code"}</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        {code && <Button variant="ghost" size="icon" aria-label="Delete code" onClick={remove} disabled={deleting}><Trash2Icon /></Button>}
      </div>
    </div>
  )
}
