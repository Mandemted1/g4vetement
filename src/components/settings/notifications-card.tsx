"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { saveAlertSettings } from "@/app/admin/actions"
import type { AlertSettings } from "@/lib/alerts"

function Toggle({ checked, onChange, title, children }: { checked: boolean; onChange: (v: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors hover:bg-muted/40">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">{children}</span>
      </span>
    </label>
  )
}

export function NotificationsCard({ initial, storeEmail }: { initial: AlertSettings; storeEmail: string }) {
  const [s, setS] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, start] = useTransition()
  const dirty = JSON.stringify(s) !== JSON.stringify(saved)
  const to = s.email.trim() || storeEmail.trim()

  const save = () =>
    start(async () => {
      setMsg(null)
      const r = await saveAlertSettings(s)
      if (r.ok) {
        setS(r.saved)
        setSaved(r.saved)
        setMsg({ ok: true, text: "Saved." })
      } else setMsg({ ok: false, text: r.error })
    })

  return (
    <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Emails the store sends to you, and the one reminder it can send to shoppers who leave a bag behind.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Toggle checked={s.newOrder} onChange={(v) => setS({ ...s, newOrder: v })} title="Email me when an order is placed">
          A summary with the customer, items, total and delivery address.
        </Toggle>
        <Toggle checked={s.lowStock} onChange={(v) => setS({ ...s, lowStock: v })} title="Email me about low stock">
          When a product drops to its warning level, sells out, or a size sells out. You&apos;re told once per event, not on every order after it.
        </Toggle>
        <Toggle checked={s.abandonedCart} onChange={(v) => setS({ ...s, abandonedCart: v })} title="Remind shoppers who leave something in their bag">
          If someone types their email at checkout and then doesn&apos;t order, they get <b className="font-medium text-foreground">one</b> email about 2 to 24 hours later with their bag and a one-click link back. Checkout tells them this beforehand, every email has a &ldquo;stop reminders&rdquo; link, and nobody is reminded more than once every 14 days. The reminder goes out with the daily scheduled job. Check that this fits the privacy rules where your shoppers live (some places require opt-in) and edit your Privacy policy if needed.
        </Toggle>

        <label className="flex max-w-md flex-col gap-1.5 text-sm font-medium">
          Send my alerts to
          <Input type="email" value={s.email} placeholder={storeEmail || "you@yourdomain.com"} onChange={(e) => setS({ ...s, email: e.target.value })} />
          <span className="text-xs font-normal text-muted-foreground">
            {to ? <>Alerts will go to <b className="font-medium text-foreground">{to}</b>.</> : <>No address yet: set one here or in Store details, or no alerts can be sent.</>}
            {" "}Until you verify a sending domain at Resend, emails can only be delivered to the email address your Resend account was created with.
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={saving || !dirty}>{saving ? "Saving…" : "Save notifications"}</Button>
          {dirty && !saving && <Button variant="ghost" onClick={() => { setS(saved); setMsg(null) }}>Discard</Button>}
          {msg && <span className={msg.ok ? "text-sm text-positive" : "text-sm text-negative"}>{msg.text}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
