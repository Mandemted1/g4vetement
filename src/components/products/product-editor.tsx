"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { createProduct, updateProduct, type ProductInput } from "@/app/admin/actions"
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
    const payload: ProductInput = { ...f, sizes: sizes.split(",").map((s) => s.trim()).filter(Boolean), colors: f.colors.filter((c) => c.name.trim()) }
    startSave(async () => {
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
          <Input list="cats" value={f.category} onChange={(e) => set("category", e.target.value)} />
          <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
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

      <div className={field}>
        <span>Colours</span>
        {f.colors.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="color" value={c.hex} onChange={(e) => set("colors", f.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} className="size-8 shrink-0 cursor-pointer rounded border bg-transparent p-0.5" aria-label="Colour" />
            <Input value={c.name} placeholder="Name" onChange={(e) => set("colors", f.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove colour" disabled={f.colors.length === 1} onClick={() => set("colors", f.colors.filter((_, j) => j !== i))}><Trash2Icon /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => set("colors", [...f.colors, { name: "", hex: "#888888" }])}><PlusIcon /> Add colour</Button>
      </div>

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
