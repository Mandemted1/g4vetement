"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, PlusIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { PALETTE, isDark, nearestColorName, parseColor, type NamedColor } from "@/lib/colors"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { createProduct, updateProduct, type ProductInput } from "@/app/admin/actions"
import { createCategory } from "@/app/admin/(panel)/category-actions"
import { SmartImage } from "@/components/smart-image"
import { uploadImage } from "@/lib/upload"
import type { GarmentType, Product } from "@/lib/data"

const TYPES: { value: GarmentType; label: string }[] = [
  { value: "tee", label: "T-shirt" }, { value: "longsleeve", label: "Long sleeve" }, { value: "hoodie", label: "Hoodie" }, { value: "zip", label: "Zip hoodie" },
  { value: "sweat", label: "Sweatshirt" }, { value: "jogger", label: "Joggers" }, { value: "cargo", label: "Cargo pants" }, { value: "straight", label: "Jeans / straight pants" },
  { value: "wide", label: "Wide trousers" }, { value: "shorts", label: "Shorts" }, { value: "coach", label: "Coach jacket" }, { value: "bomber", label: "Bomber" },
  { value: "puffer", label: "Puffer" }, { value: "beanie", label: "Beanie" }, { value: "cap", label: "Cap" }, { value: "tote", label: "Tote" }, { value: "socks", label: "Socks" },
]

const blank: ProductInput = {
  name: "", category: "Tees", type: "tee", price: 40, stock: 20, reorderLevel: 10, description: "", fabric: "", fit: "",
  active: true, colors: [{ name: "Black", hex: "#141414" }], sizes: ["S", "M", "L", "XL"], images: [],
}
const fromProduct = (p: Product): ProductInput => ({
  name: p.name, category: p.category, type: p.type, price: p.price, stock: p.stock, reorderLevel: p.reorderLevel, description: p.description,
  fabric: p.fabric, fit: p.fit, active: p.active, colors: p.colors, sizes: p.sizes, images: p.images,
})

const field = "flex flex-col gap-1.5 text-sm"
const area = "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

type Colour = { name: string; hex: string }

/** A name that no other colour on the product already uses ("Navy", then "Navy 2"…). */
function uniqueName(base: string, others: Colour[]) {
  const taken = new Set(others.map((c) => c.name.trim().toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  let n = 2
  while (taken.has(`${base} ${n}`.toLowerCase())) n++
  return `${base} ${n}`
}

function ColorsField({ colors, onChange }: { colors: Colour[]; onChange: (c: Colour[]) => void }) {
  // text being typed in each row's code box (kept separate so half-typed codes don't get overwritten)
  const [drafts, setDrafts] = useState<Record<number, string>>({})

  const clearDraft = (i: number) => setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => Number(k) !== i)))

  /** Change a row's colour. The name follows along unless the admin has typed their own. */
  const recolor = (i: number, hex: string, name?: string) =>
    onChange(
      colors.map((c, j) => {
        if (j !== i) return c
        const autoNamed = !c.name.trim() || c.name === nearestColorName(c.hex)
        const next = name ?? (autoNamed ? uniqueName(nearestColorName(hex), colors.filter((_, k) => k !== i)) : c.name)
        return { name: next, hex }
      }),
    )

  const addSwatch = (p: NamedColor) => {
    const have = colors.findIndex((c) => c.hex.toLowerCase() === p.hex)
    if (have >= 0) return onChange(colors.filter((_, j) => j !== have).length ? colors.filter((_, j) => j !== have) : colors) // tap again to remove
    // reuse a still-empty row instead of stacking a blank one
    const blank = colors.findIndex((c) => !c.name.trim())
    if (blank >= 0) return onChange(colors.map((c, j) => (j === blank ? { ...p } : c)))
    onChange([...colors, { name: uniqueName(p.name, colors), hex: p.hex }])
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <span>Colours</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Common colours">
        {PALETTE.map((p) => {
          const on = colors.some((c) => c.hex.toLowerCase() === p.hex)
          return (
            <button
              key={p.hex}
              type="button"
              title={p.name}
              aria-label={`${p.name}${on ? " (added)" : ""}`}
              aria-pressed={on}
              onClick={() => addSwatch(p)}
              style={{ background: p.hex }}
              className={cn("grid size-7 place-items-center rounded-full border transition-transform hover:scale-110", on && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
            >
              {on && <CheckIcon className={cn("size-3.5", isDark(p.hex) ? "text-white" : "text-black")} />}
            </button>
          )
        })}
      </div>

      {colors.map((c, i) => {
        const draft = drafts[i]
        const bad = draft !== undefined && draft.trim() !== "" && !parseColor(draft)
        return (
          <div key={i} className="flex items-center gap-2">
            <input
              type="color"
              value={c.hex}
              onChange={(e) => { clearDraft(i); recolor(i, e.target.value) }}
              className="size-8 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
              aria-label="Pick colour"
            />
            <Input
              value={draft ?? c.hex}
              spellCheck={false}
              aria-label="Colour code"
              aria-invalid={bad}
              placeholder="#1f2a44"
              onChange={(e) => {
                const v = e.target.value
                setDrafts((d) => ({ ...d, [i]: v }))
                const hex = parseColor(v)
                if (hex) recolor(i, hex)
              }}
              onBlur={() => clearDraft(i)}
              className="w-28 shrink-0 font-mono"
            />
            <Input value={c.name} placeholder="Name" aria-label="Colour name" onChange={(e) => onChange(colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove colour" disabled={colors.length === 1} onClick={() => onChange(colors.filter((_, j) => j !== i))}><Trash2Icon /></Button>
          </div>
        )
      })}
      {colors.some((_, i) => drafts[i] !== undefined && drafts[i].trim() !== "" && !parseColor(drafts[i])) && (
        <p className="text-xs text-negative">That isn&apos;t a colour code. Try #1f2a44, #abc, rgb(31, 42, 68) or a name like Navy.</p>
      )}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange([...colors, { name: "", hex: "#888888" }])}><PlusIcon /> Add colour</Button>
    </div>
  )
}

/** `product` = edit, `null` = create new. Mount with a key so state resets between products. */
export function ProductEditor({ product, categories, open, onClose }: { product: Product | null; categories: string[]; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">{open && <Form key={product?.id ?? "new"} product={product} categories={categories} onClose={onClose} />}</SheetContent>
    </Sheet>
  )
}

function Form({ product, categories, onClose }: { product: Product | null; categories: string[]; onClose: () => void }) {
  const router = useRouter()
  const [f, setF] = useState<ProductInput>(product ? fromProduct(product) : blank)
  const [sizes, setSizes] = useState((product ? product.sizes : blank.sizes).join(", "))
  const [err, setErr] = useState("")
  const [saving, startSave] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [addCat, setAddCat] = useState(false)
  const [newCat, setNewCat] = useState("")
  const file = useRef<HTMLInputElement>(null)
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setF((x) => ({ ...x, [k]: v }))

  const upload = async (list: FileList | null) => {
    if (!list?.length) return
    setUploading(true)
    setErr("")
    for (const fl of Array.from(list)) {
      const r = await uploadImage(fl, product?.id ?? "new")
      if (!r.ok) {
        setErr(r.error)
        break
      }
      setF((x) => ({ ...x, images: [...x.images, r.url] }))
    }
    setUploading(false)
    if (file.current) file.current.value = ""
  }

  const save = () => {
    setErr("")
    const chosen = addCat ? newCat.trim() : f.category
    const named = f.colors.filter((c) => c.name.trim()).map((c) => c.name.trim().toLowerCase())
    if (new Set(named).size !== named.length) return setErr("Two colours have the same name. Give each one its own name.")
    const payload: ProductInput = { ...f, category: chosen, sizes: sizes.split(",").map((s) => s.trim()).filter(Boolean), colors: f.colors.filter((c) => c.name.trim()) }
    startSave(async () => {
      if (addCat) {
        if (!chosen) return setErr("Type a name for the new category.")
        const c = await createCategory(chosen)
        if (!c.ok && !/already exists/i.test(c.error)) return setErr(c.error)
      }
      const r = product ? await updateProduct(product.id, payload) : await createProduct(payload)
      if (!r.ok) return setErr(r.error)
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-8">
      <SheetHeader className="px-0">
        <SheetTitle>{product ? product.name : "New product"}</SheetTitle>
        <SheetDescription>{product ? `${product.sku} · changes go live on the store immediately.` : "Fill in the details, then add photos."}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-2">
        <span className="text-sm">Photos <span className="text-muted-foreground">(first is the main image)</span></span>
        <div className="grid grid-cols-4 gap-2">
          {f.images.map((src, i) => (
            <div key={src} className="group relative aspect-[4/5] overflow-hidden rounded-md border bg-muted">
              <SmartImage src={src} alt="" fill sizes="100px" className="object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-background/90 px-1 text-[10px]">Main</span>}
              <button type="button" aria-label="Remove photo" onClick={() => set("images", f.images.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded bg-background/90 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Trash2Icon className="size-3" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => file.current?.click()} disabled={uploading} className="flex aspect-[4/5] flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground transition-colors hover:bg-muted">
            <UploadIcon className="size-4" />
            {uploading ? "Uploading…" : "Add"}
          </button>
        </div>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => upload(e.target.files)} />
      </div>

      <label className={field}>Name<Input value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>Category
          {addCat ? (
            <div className="flex gap-2">
              <Input autoFocus value={newCat} maxLength={40} placeholder="New category name" onChange={(e) => setNewCat(e.target.value)} />
              <Button type="button" variant="ghost" onClick={() => { setAddCat(false); setNewCat("") }}>Cancel</Button>
            </div>
          ) : (
            <select value={f.category} onChange={(e) => (e.target.value === "__new" ? setAddCat(true) : set("category", e.target.value))} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
              {[...new Set([...categories, f.category].filter(Boolean))].map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__new">+ New category…</option>
            </select>
          )}
        </label>
        <label className={field}>Shape (for placeholder)
          <select value={f.type} onChange={(e) => set("type", e.target.value as GarmentType)} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className={field}>Price ($)<Input type="number" min={0} value={f.price} onChange={(e) => set("price", Math.round(Number(e.target.value)))} /></label>
        <label className={field}>Stock<Input type="number" min={0} value={f.stock} onChange={(e) => set("stock", Math.round(Number(e.target.value)))} /></label>
        <label className={field}>Low-stock at<Input type="number" min={0} value={f.reorderLevel} onChange={(e) => set("reorderLevel", Math.round(Number(e.target.value)))} /></label>
      </div>

      <label className={field}>Description<textarea className={area} value={f.description} onChange={(e) => set("description", e.target.value)} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>Fabric<Input value={f.fabric} onChange={(e) => set("fabric", e.target.value)} /></label>
        <label className={field}>Fit<Input value={f.fit} onChange={(e) => set("fit", e.target.value)} /></label>
      </div>

      <ColorsField colors={f.colors} onChange={(c) => set("colors", c)} />
      <p className="-mt-3 text-xs text-muted-foreground">Tap a swatch to add it, or type a code like <span className="font-mono">#1f2a44</span>. The name fills in on its own.</p>

      <label className={field}>Sizes <span className="text-muted-foreground">(comma separated)</span><Input value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="S, M, L, XL" /></label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="size-4" />
        Visible on the store
      </label>

      {err && <p className="rounded-md bg-negative/10 px-3 py-2 text-sm text-negative">{err}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving || uploading} className="flex-1">{saving ? "Saving…" : product ? "Save changes" : "Create product"}</Button>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  )
}
