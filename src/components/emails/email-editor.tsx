"use client"

import { useMemo, useRef, useState } from "react"
import Image from "next/image"
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, ArrowDownIcon, ArrowUpIcon, CopyIcon, GripVerticalIcon, MonitorIcon, PlusIcon, SmartphoneIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { uploadProductPhoto } from "@/app/admin/actions"
import { renderEmail, type ProductLite } from "@/lib/email/render"
import { BLOCK_LABELS, VARIABLES, newBlock, uid, type Align, type Block, type BlockType, type EmailDoc } from "@/lib/email/types"
import { cn } from "@/lib/utils"

const TYPES: BlockType[] = ["heading", "text", "image", "button", "products", "discount", "divider", "spacer", "order"]
const area = "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
const lbl = "flex flex-col gap-1.5 text-xs text-muted-foreground"

interface Props {
  doc: EmailDoc
  onDoc: (d: EmailDoc) => void
  subject: string
  onSubject: (s: string) => void
  preheader: string
  onPreheader: (s: string) => void
  products: ProductLite[]
  kind: "marketing" | "transactional"
  storeUrl: string
  /** blocks that make no sense for this email type are hidden from the "add" menu */
  hide?: BlockType[]
}

export function EmailEditor({ doc, onDoc, subject, onSubject, preheader, onPreheader, products, kind, storeUrl, hide = [] }: Props) {
  const [open, setOpen] = useState<string | null>(doc.blocks[0]?.id ?? null)
  const [mobile, setMobile] = useState(false)
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const [focused, setFocused] = useState<{ el: HTMLTextAreaElement | HTMLInputElement; set: (v: string) => void } | null>(null)

  const setBlocks = (blocks: Block[]) => onDoc({ ...doc, blocks })
  const patch = (id: string, p: Partial<Block>) => setBlocks(doc.blocks.map((b) => (b.id === id ? ({ ...b, ...p } as Block) : b)))
  const move = (from: number, to: number) => {
    if (to < 0 || to >= doc.blocks.length || from === to) return
    const next = [...doc.blocks]
    next.splice(to, 0, next.splice(from, 1)[0])
    setBlocks(next)
  }
  const add = (type: BlockType) => {
    const b = newBlock(type)
    setBlocks([...doc.blocks, b])
    setOpen(b.id)
  }
  const dup = (i: number) => {
    const copy = { ...doc.blocks[i], id: uid() } as Block
    const next = [...doc.blocks]
    next.splice(i + 1, 0, copy)
    setBlocks(next)
    setOpen(copy.id)
  }
  const insertVar = (key: string) => {
    const f = focused
    if (!f) return
    const tag = `{{${key}}}`
    const { el } = f
    const s = el.selectionStart ?? el.value.length
    const e = el.selectionEnd ?? s
    f.set(el.value.slice(0, s) + tag + el.value.slice(e))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + tag.length, s + tag.length)
    })
  }
  const track = (set: (v: string) => void) => ({
    onFocus: (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => setFocused({ el: e.currentTarget, set }),
  })

  const preview = useMemo(() => {
    const items = products.slice(0, 2).map((p, i) => ({ name: p.name, color: "Black", size: "M", qty: i + 1, price: p.price, image: p.image }))
    const subtotal = items.reduce((s, l) => s + l.price * l.qty, 0)
    const shipping = subtotal >= 100 ? 0 : 9
    const sample = Object.fromEntries(VARIABLES.map((v) => [v.key, v.key === "store_url" ? storeUrl : v.sample]))
    return renderEmail(
      doc,
      { vars: sample, storeUrl, address: "Your business address", kind, unsubscribeUrl: "#", products, order: { items, subtotal, discount: 0, shipping, total: subtotal + shipping } },
      { subject, preheader },
    ).html
  }, [doc, subject, preheader, products, kind, storeUrl])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_1fr]">
      {/* ---------------- controls ---------------- */}
      <div className="flex flex-col gap-5">
        <div className="grid gap-3">
          <label className={lbl}>Subject line<Input value={subject} onChange={(e) => onSubject(e.target.value)} {...track(onSubject)} /></label>
          <label className={lbl}>Preview text <span className="text-muted-foreground/70">(shown next to the subject in the inbox)</span><Input value={preheader} onChange={(e) => onPreheader(e.target.value)} {...track(onPreheader)} /></label>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Insert:</span>
            {VARIABLES.map((v) => (
              <button key={v.key} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertVar(v.key)} className="rounded-md border px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:bg-muted">
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 rounded-lg border p-3">
          {(
            [
              ["bg", "Background"],
              ["card", "Card"],
              ["ink", "Text"],
              ["mute", "Muted"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
              <input type="color" value={doc.theme[k]} onChange={(e) => onDoc({ ...doc, theme: { ...doc.theme, [k]: e.target.value } })} className="size-8 cursor-pointer rounded border bg-transparent p-0.5" />
              {label}
            </label>
          ))}
        </div>

        <ul className="flex flex-col gap-2">
          {doc.blocks.map((b, i) => {
            const isOpen = open === b.id
            return (
              <li
                key={b.id}
                draggable
                onDragStart={() => setDrag(i)}
                onDragEnd={() => {
                  setDrag(null)
                  setOver(null)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOver(i)
                }}
                onDrop={() => {
                  if (drag !== null) move(drag, i)
                  setDrag(null)
                  setOver(null)
                }}
                className={cn("rounded-lg border bg-card transition-all", over === i && drag !== null && drag !== i && "border-foreground", drag === i && "opacity-40")}
              >
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <GripVerticalIcon className="size-4 shrink-0 cursor-grab text-muted-foreground" />
                  <button type="button" onClick={() => setOpen(isOpen ? null : b.id)} className="flex-1 truncate py-1 text-left text-sm font-medium">
                    {BLOCK_LABELS[b.type]}
                    <span className="ml-2 font-normal text-muted-foreground">{summary(b)}</span>
                  </button>
                  <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUpIcon /></IconBtn>
                  <IconBtn label="Move down" disabled={i === doc.blocks.length - 1} onClick={() => move(i, i + 1)}><ArrowDownIcon /></IconBtn>
                  <IconBtn label="Duplicate" onClick={() => dup(i)}><CopyIcon /></IconBtn>
                  <IconBtn label="Delete" onClick={() => setBlocks(doc.blocks.filter((x) => x.id !== b.id))}><Trash2Icon /></IconBtn>
                </div>
                {isOpen && (
                  <div className="flex flex-col gap-3 border-t p-3">
                    <Fields b={b} patch={(p) => patch(b.id, p)} products={products} track={track} />
                  </div>
                )}
              </li>
            )
          })}
          {doc.blocks.length === 0 && <li className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No blocks yet. Add one below.</li>}
        </ul>

        <div>
          <p className="mb-2 text-xs text-muted-foreground">Add a block</p>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.filter((t) => !hide.includes(t)).map((t) => (
              <Button key={t} type="button" variant="outline" size="sm" onClick={() => add(t)}><PlusIcon /> {BLOCK_LABELS[t]}</Button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- preview ---------------- */}
      <div className="flex flex-col gap-2 lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Live preview (sample data)</span>
          <div className="flex rounded-lg border p-0.5">
            <button type="button" onClick={() => setMobile(false)} aria-label="Desktop" className={cn("rounded-md p-1.5", !mobile && "bg-muted")}><MonitorIcon className="size-4" /></button>
            <button type="button" onClick={() => setMobile(true)} aria-label="Phone" className={cn("rounded-md p-1.5", mobile && "bg-muted")}><SmartphoneIcon className="size-4" /></button>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border bg-muted/40">
          <iframe title="Email preview" srcDoc={preview} sandbox="" className={cn("mx-auto block h-[min(78vh,820px)] border-0 bg-white transition-[width] duration-500", mobile ? "w-[390px] max-w-full" : "w-full")} />
        </div>
      </div>
    </div>
  )
}

function summary(b: Block) {
  if (b.type === "heading" || b.type === "text") return b.text.slice(0, 28)
  if (b.type === "button") return b.label
  if (b.type === "discount") return b.code
  if (b.type === "products") return b.ids.length ? `${b.ids.length} selected` : "none selected"
  return ""
}

function IconBtn({ label, children, ...p }: { label: string; children: React.ReactNode } & React.ComponentProps<"button">) {
  return (
    <button type="button" aria-label={label} title={label} {...p} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-3.5">
      {children}
    </button>
  )
}

function AlignPick({ value, onChange }: { value: Align; onChange: (a: Align) => void }) {
  const opts: [Align, React.ReactNode][] = [["left", <AlignLeftIcon key="l" />], ["center", <AlignCenterIcon key="c" />], ["right", <AlignRightIcon key="r" />]]
  return (
    <div className="flex w-fit rounded-lg border p-0.5">
      {opts.map(([a, icon]) => (
        <button key={a} type="button" aria-label={`Align ${a}`} onClick={() => onChange(a)} className={cn("rounded-md p-1.5 [&_svg]:size-4", value === a && "bg-muted")}>{icon}</button>
      ))}
    </div>
  )
}

type Track = (set: (v: string) => void) => { onFocus: (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => void }

function Fields({ b, patch, products, track }: { b: Block; patch: (p: Partial<Block>) => void; products: ProductLite[]; track: Track }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const file = useRef<HTMLInputElement>(null)

  switch (b.type) {
    case "heading":
      return (
        <>
          <label className={lbl}>Text<textarea className={area} value={b.text} onChange={(e) => patch({ text: e.target.value })} {...track((v) => patch({ text: v }))} /></label>
          <div className="flex items-center gap-4">
            <AlignPick value={b.align} onChange={(align) => patch({ align })} />
            <div className="flex rounded-lg border p-0.5 text-xs">
              {(["s", "m", "l"] as const).map((s) => (
                <button key={s} type="button" onClick={() => patch({ size: s })} className={cn("rounded-md px-2.5 py-1.5 uppercase", b.size === s && "bg-muted")}>{s}</button>
              ))}
            </div>
          </div>
        </>
      )
    case "text":
      return (
        <>
          <label className={lbl}>Text<textarea className={cn(area, "min-h-28")} value={b.text} onChange={(e) => patch({ text: e.target.value })} {...track((v) => patch({ text: v }))} /></label>
          <AlignPick value={b.align} onChange={(align) => patch({ align })} />
        </>
      )
    case "image":
      return (
        <>
          {b.url && <div className="relative aspect-[16/9] overflow-hidden rounded-md border bg-muted"><Image src={b.url.startsWith("/") ? b.url : b.url} alt="" fill sizes="400px" className="object-cover" unoptimized /></div>}
          <div className="flex gap-2">
            <Input value={b.url} placeholder="Image URL" onChange={(e) => patch({ url: e.target.value })} />
            <Button type="button" variant="outline" disabled={busy} onClick={() => file.current?.click()}><UploadIcon /> {busy ? "…" : "Upload"}</Button>
            <input
              ref={file}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                setBusy(true)
                setErr("")
                const fd = new FormData()
                fd.set("file", f)
                fd.set("productId", "email")
                const r = await uploadProductPhoto(fd)
                if (r.ok) patch({ url: r.url })
                else setErr(r.error)
                setBusy(false)
                e.target.value = ""
              }}
            />
          </div>
          {err && <p className="text-xs text-negative">{err}</p>}
          <label className={lbl}>Alt text<Input value={b.alt} onChange={(e) => patch({ alt: e.target.value })} /></label>
          <label className={lbl}>Link when clicked (optional)<Input value={b.link} placeholder="{{store_url}}/shop" onChange={(e) => patch({ link: e.target.value })} /></label>
        </>
      )
    case "button":
      return (
        <>
          <label className={lbl}>Label<Input value={b.label} onChange={(e) => patch({ label: e.target.value })} {...track((v) => patch({ label: v }))} /></label>
          <label className={lbl}>Link<Input value={b.url} onChange={(e) => patch({ url: e.target.value })} {...track((v) => patch({ url: v }))} /></label>
          <div className="flex items-center gap-4">
            <AlignPick value={b.align} onChange={(align) => patch({ align })} />
            <div className="flex rounded-lg border p-0.5 text-xs">
              {(["solid", "outline"] as const).map((s) => (
                <button key={s} type="button" onClick={() => patch({ style: s })} className={cn("rounded-md px-2.5 py-1.5 capitalize", b.style === s && "bg-muted")}>{s}</button>
              ))}
            </div>
          </div>
        </>
      )
    case "spacer":
      return (
        <label className={lbl}>Height: {b.height}px<input type="range" min={8} max={96} step={4} value={b.height} onChange={(e) => patch({ height: Number(e.target.value) })} /></label>
      )
    case "discount":
      return (
        <>
          <label className={lbl}>Code<Input value={b.code} onChange={(e) => patch({ code: e.target.value })} {...track((v) => patch({ code: v }))} /></label>
          <label className={lbl}>Note<Input value={b.note} onChange={(e) => patch({ note: e.target.value })} {...track((v) => patch({ note: v }))} /></label>
          <p className="text-xs text-muted-foreground">The code must exist for it to work at checkout. Right now that&apos;s WELCOME10.</p>
        </>
      )
    case "products":
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Pick up to 6 products ({b.ids.length} selected)</p>
          <div className="grid max-h-60 grid-cols-1 gap-1 overflow-y-auto pr-1">
            {products.map((p) => {
              const on = b.ids.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => patch({ ids: on ? b.ids.filter((x) => x !== p.id) : b.ids.length < 6 ? [...b.ids, p.id] : b.ids })}
                  className={cn("flex items-center gap-2.5 rounded-md border px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted", on && "border-foreground bg-muted")}
                >
                  <span className="relative size-8 shrink-0 overflow-hidden rounded border" style={{ background: p.image ? undefined : p.color }}>
                    {p.image && <Image src={p.image} alt="" fill sizes="32px" className="object-cover" unoptimized />}
                  </span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">${p.price}</span>
                </button>
              )
            })}
          </div>
        </div>
      )
    case "divider":
      return <p className="text-xs text-muted-foreground">A thin line between sections.</p>
    case "order":
      return <p className="text-xs text-muted-foreground">Shows the customer&apos;s items, discount, shipping and total. The preview uses sample products.</p>
  }
}
