"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, SendIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveCampaign, sendCampaignNow, sendTest } from "@/app/admin/(panel)/email-actions"
import { EmailEditor } from "@/components/emails/email-editor"
import type { CampaignItem } from "@/lib/email/admin-data"
import type { ProductLite } from "@/lib/email/render"
import { int, pct } from "@/lib/format"

const AUDIENCES = [
  { value: "subscribers", label: "All subscribers", hint: "Everyone who joined the list." },
  { value: "buyers", label: "Subscribers who've ordered", hint: "On the list and bought at least once." },
  { value: "non_buyers", label: "Subscribers who haven't ordered", hint: "On the list, no purchase yet. Good for a first-order nudge." },
  { value: "vip", label: "Top customers ($300+ spent)", hint: "Subscribers who've spent $300 or more." },
]

const toLocal = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function CampaignEditor({ item, products, storeUrl, counts }: { item: CampaignItem; products: ProductLite[]; storeUrl: string; counts: Record<string, number> }) {
  const router = useRouter()
  const locked = item.status === "sent" || item.status === "sending"
  const [name, setName] = useState(item.name)
  const [doc, setDoc] = useState(item.doc)
  const [subject, setSubject] = useState(item.subject)
  const [preheader, setPreheader] = useState(item.preheader)
  const [audience, setAudience] = useState(item.audience)
  const [when, setWhen] = useState<"now" | "later">(item.scheduledAt ? "later" : "now")
  const [at, setAt] = useState(toLocal(item.scheduledAt))
  const [to, setTo] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, startSave] = useTransition()
  const [sending, startSend] = useTransition()
  const [testing, startTest] = useTransition()

  const input = () => ({ id: item.id === "new" ? undefined : item.id, name, subject, preheader, doc, audience, scheduledAt: when === "later" && at ? new Date(at).toISOString() : null })
  const aud = AUDIENCES.find((a) => a.value === audience)!
  const n = counts[audience] ?? 0

  const save = () =>
    startSave(async () => {
      setMsg(null)
      const r = await saveCampaign(input())
      if (!r.ok) return setMsg({ ok: false, text: r.error })
      setMsg({ ok: true, text: when === "later" && at ? "Scheduled." : "Draft saved." })
      if (item.id === "new") router.replace(`/admin/campaigns/${r.id}`)
      else router.refresh()
    })

  const send = () => {
    if (!window.confirm(`Send "${subject}" to ${int(n)} ${n === 1 ? "person" : "people"} now? This can't be undone.`)) return
    startSend(async () => {
      setMsg(null)
      const saved = await saveCampaign({ ...input(), scheduledAt: null })
      if (!saved.ok) return setMsg({ ok: false, text: saved.error })
      const r = await sendCampaignNow(saved.id)
      if (!r.ok) {
        setMsg({ ok: false, text: r.error })
        if (item.id === "new") router.replace(`/admin/campaigns/${saved.id}`)
        else router.refresh()
        return
      }
      router.replace(`/admin/campaigns/${saved.id}`)
      router.refresh()
    })
  }

  const test = () =>
    startTest(async () => {
      setMsg(null)
      const r = await sendTest(to, doc, subject, preheader, "marketing")
      setMsg(r.ok ? { ok: true, text: `Test sent to ${to}.` } : { ok: false, text: r.error })
    })

  const s = item.stats
  return (
    <div className="flex flex-col gap-5">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/campaigns" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-3" /> Campaigns</Link>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={locked} aria-label="Campaign name" className="h-auto border-0 bg-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0" />
        </div>
        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={save} disabled={saving || sending}>{saving ? "Saving…" : when === "later" ? "Save & schedule" : "Save draft"}</Button>
            <Button onClick={send} disabled={sending || saving || n === 0}><SendIcon /> {sending ? "Sending…" : `Send to ${int(n)}`}</Button>
          </div>
        )}
      </div>

      {locked && (
        <div className="rise grid grid-cols-2 gap-3 rounded-xl border p-4 sm:grid-cols-5" style={{ "--i": 1 } as React.CSSProperties}>
          <Stat label="Sent" value={int(item.recipients)} />
          <Stat label="Delivered" value={s.sent ? pct((s.delivered / s.sent) * 100, 0).replace("+", "") : "–"} sub={int(s.delivered)} />
          <Stat label="Opened" value={s.sent ? pct((s.opened / s.sent) * 100, 0).replace("+", "") : "–"} sub={int(s.opened)} />
          <Stat label="Clicked" value={s.sent ? pct((s.clicked / s.sent) * 100, 0).replace("+", "") : "–"} sub={int(s.clicked)} />
          <Stat label="Bounced" value={int(s.bounced)} />
          {item.sentAt && <p className="col-span-full text-xs text-muted-foreground">Sent {new Date(item.sentAt).toLocaleString()}. Opens and clicks fill in as people interact, once the Resend webhook is connected.</p>}
        </div>
      )}
      {item.error && <p className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">{item.error}</p>}

      {!locked && (
        <div className="rise grid gap-4 rounded-xl border p-4 md:grid-cols-2" style={{ "--i": 1 } as React.CSSProperties}>
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            Send to
            <select value={audience} onChange={(e) => setAudience(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground">
              {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label} ({int(counts[a.value] ?? 0)})</option>)}
            </select>
            <span>{aud.hint}</span>
          </label>
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            When
            <div className="flex gap-4 text-sm text-foreground">
              <label className="flex items-center gap-2"><input type="radio" checked={when === "now"} onChange={() => setWhen("now")} /> Send now</label>
              <label className="flex items-center gap-2"><input type="radio" checked={when === "later"} onChange={() => setWhen("later")} /> Schedule</label>
            </div>
            {when === "later" && <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="w-fit" />}
            {when === "later" && <span>Scheduled campaigns go out when the daily send job runs after this time.</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2 md:col-span-2">
            <Input value={to} onChange={(e) => setTo(e.target.value)} type="email" placeholder="Send a test to…" className="w-64" />
            <Button variant="outline" onClick={test} disabled={testing || !to}>{testing ? "Sending…" : "Send test"}</Button>
          </div>
        </div>
      )}
      {msg && <p className={msg.ok ? "text-sm text-positive" : "text-sm text-negative"}>{msg.text}</p>}

      <div className={locked ? "pointer-events-none opacity-70" : ""}>
        <EmailEditor doc={doc} onDoc={setDoc} subject={subject} onSubject={setSubject} preheader={preheader} onPreheader={setPreheader} products={products} kind="marketing" storeUrl={storeUrl} hide={["order"]} />
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular">{value}</div>
      {sub && <div className="text-xs text-muted-foreground tabular">{sub}</div>}
    </div>
  )
}
