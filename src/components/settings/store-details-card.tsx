"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { saveStoreSettings } from "@/app/admin/actions"
import type { StoreSettings } from "@/lib/settings-types"

const area = "min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
const lbl = "flex flex-col gap-1.5 text-sm font-medium"
const hint = "text-xs font-normal text-muted-foreground"

export function StoreDetailsCard({ initial }: { initial: StoreSettings }) {
  const [s, setS] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, start] = useTransition()
  const dirty = JSON.stringify(s) !== JSON.stringify(saved)
  const set = <K extends keyof StoreSettings>(k: K, v: string) => setS((x) => ({ ...x, [k]: v }))

  const save = () =>
    start(async () => {
      setMsg(null)
      const r = await saveStoreSettings(s)
      if (r.ok) {
        setS(r.saved)
        setSaved(r.saved)
        setMsg({ ok: true, text: "Saved. The store footer and emails are updated." })
      } else setMsg({ ok: false, text: r.error })
    })

  return (
    <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
      <CardHeader>
        <CardTitle>Store details</CardTitle>
        <CardDescription>Shown in your store footer and at the bottom of every email.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={lbl}>
            Store name
            <Input value={s.name} maxLength={40} onChange={(e) => set("name", e.target.value)} />
            <span className={hint}>Used in emails and policy pages. The G4 logo on the site stays as designed.</span>
          </label>
          <label className={lbl}>
            Contact email
            <Input type="email" value={s.email} placeholder="hello@yourdomain.com" onChange={(e) => set("email", e.target.value)} />
            <span className={hint}>Shoppers can write to this from the footer.</span>
          </label>
          <label className={lbl}>
            <span>Phone <span className="font-normal text-muted-foreground">(optional)</span></span>
            <Input value={s.phone} maxLength={30} onChange={(e) => set("phone", e.target.value)} />
          </label>
          <div className="hidden sm:block" />
          <label className={lbl}>
            Instagram
            <Input value={s.instagram} placeholder="@yourhandle" onChange={(e) => set("instagram", e.target.value)} />
          </label>
          <label className={lbl}>
            TikTok
            <Input value={s.tiktok} placeholder="@yourhandle" onChange={(e) => set("tiktok", e.target.value)} />
          </label>
        </div>
        <label className={lbl}>
          Business address
          <textarea className={area} value={s.address} maxLength={300} placeholder={"Your business name\n123 Street, City, ST 00000"} onChange={(e) => set("address", e.target.value)} />
          <span className={hint}>Marketing emails must include a mailing address by law in most countries. It appears in email footers and on the store footer.</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={saving || !dirty}>{saving ? "Saving…" : "Save details"}</Button>
          {dirty && !saving && <Button variant="ghost" onClick={() => { setS(saved); setMsg(null) }}>Discard</Button>}
          {msg && <span className={msg.ok ? "text-sm text-positive" : "text-sm text-negative"}>{msg.text}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
