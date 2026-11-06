"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { ImageIcon, UploadIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { saveLoginSettings } from "@/app/admin/actions"
import { LoginScreen } from "@/components/login-screen"
import { uploadImage } from "@/lib/upload"
import type { LoginSettings } from "@/lib/settings-types"
import { cn } from "@/lib/utils"

const W = 1280
const H = 800

export function LoginSettingsCard({ initial }: { initial: LoginSettings }) {
  const [s, setS] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, startSave] = useTransition()
  const file = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  const dirty = JSON.stringify(s) !== JSON.stringify(saved)
  const set = <K extends keyof LoginSettings>(k: K, v: LoginSettings[K]) => setS((x) => ({ ...x, [k]: v }))

  // keep the miniature preview fitted to its box
  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(el.clientWidth / W)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const upload = async (f: File | undefined) => {
    if (!f) return
    setUploading(true)
    setMsg(null)
    const r = await uploadImage(f, "login")
    if (r.ok) set("image", r.url)
    else setMsg({ ok: false, text: r.error })
    setUploading(false)
    if (file.current) file.current.value = ""
  }

  const save = () =>
    startSave(async () => {
      setMsg(null)
      const r = await saveLoginSettings(s)
      if (r.ok) {
        setSaved(s)
        setMsg({ ok: true, text: "Saved. The login screen has been updated." })
      } else setMsg({ ok: false, text: r.error })
    })

  return (
      <Card className="rise" style={{ "--i": 3 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle>Login screen</CardTitle>
          <CardDescription>The page you see before signing in to the admin.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Background image</span>
              <div className="flex items-center gap-3">
                <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {s.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image.replace("/image/upload/", "/image/upload/c_fill,w_160,h_160,q_auto,f_auto/")} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={uploading} onClick={() => file.current?.click()}>
                    <UploadIcon /> {uploading ? "Uploading…" : s.image ? "Replace" : "Upload"}
                  </Button>
                  {s.image && (
                    <Button type="button" variant="ghost" onClick={() => set("image", "")}>
                      <XIcon /> Remove
                    </Button>
                  )}
                </div>
                <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => upload(e.target.files?.[0])} />
              </div>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                Or paste an image link
                <Input value={s.image} placeholder="https://…" onChange={(e) => set("image", e.target.value)} />
              </label>
              <p className="text-xs text-muted-foreground">Tip: a large, dark photo works best. Sharper images look better with the Split layout.</p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Layout</span>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["full", "Full background", "Image fills the screen with a frosted card on top."],
                    ["split", "Split", "Image on one side, form on the other. Keeps the photo crisp."],
                  ] as const
                ).map(([v, label, hint]) => (
                  <button key={v} type="button" onClick={() => set("layout", v)} className={cn("rounded-lg border p-3 text-left transition-colors hover:bg-muted", s.layout === v && "border-foreground bg-muted")}>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium">
              <span className="flex justify-between">Darkness <span className="font-normal text-muted-foreground tabular">{Math.round(s.overlay * 100)}%</span></span>
              <input type="range" min={0} max={90} step={5} value={Math.round(s.overlay * 100)} onChange={(e) => set("overlay", Number(e.target.value) / 100)} />
              <span className="text-xs font-normal text-muted-foreground">How much the image is dimmed so the text stays readable.</span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Welcome line
              <Input value={s.tagline} maxLength={140} onChange={(e) => set("tagline", e.target.value)} />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={saving || !dirty}>{saving ? "Saving…" : "Save changes"}</Button>
              {dirty && !saving && (
                <Button variant="ghost" onClick={() => { setS(saved); setMsg(null) }}>Discard</Button>
              )}
              {msg && <span className={msg.ok ? "text-sm text-positive" : "text-sm text-negative"}>{msg.text}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Preview</span>
            <div ref={box} className="relative w-full overflow-hidden rounded-xl border bg-muted" style={{ aspectRatio: `${W} / ${H}` }}>
              <div className="pointer-events-none absolute left-0 top-0 select-none" style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }} inert>
                <LoginScreen settings={s} contained />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">This is how it will look on a desktop screen. On phones the form sits at the bottom so the image stays visible.</p>
          </div>
        </CardContent>
      </Card>
  )
}
