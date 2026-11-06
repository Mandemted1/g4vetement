"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { SearchIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { createSale, deleteSale, updateSale } from "@/app/admin/(panel)/discount-actions"
import { useAdmin } from "@/components/admin-data"
import { describeSale, type Sale, type SaleScope } from "@/lib/discount-types"
import type { SaleInput } from "@/lib/discount-validate"
import { cn } from "@/lib/utils"

const field = "flex flex-col gap-1.5 text-sm"
const hint = "text-xs font-normal text-muted-foreground"
const toLocal = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fromLocal = (s: string) => (s ? new Date(s).toISOString() : null)

export function SaleEditor({ sale, open, onClose }: { sale: Sale | null; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">{open && <Form key={sale?.id ?? "new"} sale={sale} onClose={onClose} />}</SheetContent>
    </Sheet>
  )
}

function Form({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const router = useRouter()
  const { categories, products } = useAdmin()
  const [name, setName] = useState(sale?.name ?? "")
  const [percent, setPercent] = useState(String(sale?.percent ?? 20))
  const [scope, setScope] = useState<SaleScope>(sale?.scope ?? "all")
  const [cats, setCats] = useState<string[]>(sale?.categories ?? [])
  const [ids, setIds] = useState<string[]>(sale?.productIds ?? [])
  const [q, setQ] = useState("")
  const [startsAt, setStartsAt] = useState(toLocal(sale?.startsAt ?? null))
  const [endsAt, setEndsAt] = useState(toLocal(sale?.endsAt ?? null))
  const [active, setActive] = useState(sale?.active ?? true)
  const [err, setErr] = useState("")
  const [saving, start] = useTransition()
  const [deleting, startDelete] = useTransition()

  const shown = useMemo(() => products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())), [products, q])
  const input = (): SaleInput => ({
    name,
    percent: Number(percent),
    scope,
    categories: scope === "categories" ? cats : null,
    productIds: scope === "products" ? ids : null,
    startsAt: fromLocal(startsAt),
    endsAt: fromLocal(endsAt),
    active,
  })

  const save = () =>
    start(async () => {
      setErr("")
      const r = sale ? await updateSale(sale.id, input()) : await createSale(input())
      if (!r.ok) return setErr(r.error)
      router.refresh()
      onClose()
    })
  const remove = () => {
    if (!sale || !window.confirm(`Delete the sale "${sale.name}"? Orders already placed keep the price they paid.`)) return
    startDelete(async () => {
      const r = await deleteSale(sale.id)
      if (!r.ok) return setErr(r.error)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-8">
      <SheetHeader className="px-0">
        <SheetTitle>{sale ? sale.name : "New sale"}</SheetTitle>
        <SheetDescription>Prices drop automatically in the store while the sale runs, with the old price struck through.</SheetDescription>
      </SheetHeader>

      <label className={field}>Name<Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Black Friday" /></label>

      <label className={field}>
        Percent off
        <div className="relative w-40">
          <Input type="number" min={1} max={90} value={percent} onChange={(e) => setPercent(e.target.value)} className="pr-8" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
        </div>
        <span className={hint}>Up to 90%. If several sales cover a product, the biggest discount wins. Discount codes then apply on top of the sale price.</span>
      </label>

      <div className={field}>
        <span>Applies to</span>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [["all", "Whole store"], ["categories", "Categories"], ["products", "Specific products"]] as const
          ).map(([v, label]) => (
            <label key={v} className="flex items-center gap-2"><input type="radio" checked={scope === v} onChange={() => setScope(v)} /> {label}</label>
          ))}
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
        {scope === "products" && (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="pl-8" />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-lg border">
              {shown.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2.5 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50">
                  <input type="checkbox" className="size-4" checked={ids.includes(p.id)} onChange={(e) => setIds(e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id))} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">${p.price}</span>
                </label>
              ))}
            </div>
            <span className={hint}>{ids.length} selected</span>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={field}>Starts <span className={hint}>(optional)</span><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
        <label className={field}>Ends <span className={hint}>(optional)</span><Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
      </div>

      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4" /> Sale is switched on</label>

      <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">Summary: </span>{name || "Sale"}: {describeSale({ percent: Number(percent) || 0, scope, categories: cats, productIds: ids, startsAt: fromLocal(startsAt), endsAt: fromLocal(endsAt) })}</p>

      {err && <p className="rounded-md bg-negative/10 px-3 py-2 text-sm text-negative">{err}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving || deleting} className="flex-1">{saving ? "Saving…" : sale ? "Save changes" : "Create sale"}</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        {sale && <Button variant="ghost" size="icon" aria-label="Delete sale" onClick={remove} disabled={deleting}><Trash2Icon /></Button>}
      </div>
    </div>
  )
}
