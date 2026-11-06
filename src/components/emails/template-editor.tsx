"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, RotateCcwIcon, SendIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveTemplate, sendTest } from "@/app/admin/(panel)/email-actions"
import { EmailEditor } from "@/components/emails/email-editor"
import type { TemplateItem } from "@/lib/email/admin-data"
import { DEFAULT_TEMPLATES } from "@/lib/email/defaults"
import type { ProductLite } from "@/lib/email/render"

export function TemplateEditor({ item, products, storeUrl }: { item: TemplateItem; products: ProductLite[]; storeUrl: string }) {
  const router = useRouter()
  const [doc, setDoc] = useState(item.doc)
  const [subject, setSubject] = useState(item.subject)
  const [preheader, setPreheader] = useState(item.preheader)
  const [enabled, setEnabled] = useState(item.enabled)
  const [to, setTo] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, startSave] = useTransition()
  const [testing, startTest] = useTransition()

  const save = () =>
    startSave(async () => {
      setMsg(null)
      const r = await saveTemplate(item.key, { subject, preheader, doc, enabled, name: item.name, description: item.description })
      setMsg(r.ok ? { ok: true, text: "Saved. New emails use this version." } : { ok: false, text: r.error })
      if (r.ok) router.refresh()
    })
  const test = () =>
    startTest(async () => {
      setMsg(null)
      const r = await sendTest(to, doc, subject, preheader, "transactional")
      setMsg(r.ok ? { ok: true, text: `Test sent to ${to}.` } : { ok: false, text: r.error })
    })
  const reset = () => {
    if (!window.confirm("Reset this email to the original design? Your changes will be lost.")) return
    const d = DEFAULT_TEMPLATES[item.key]
    setDoc(d.doc)
    setSubject(d.subject)
    setPreheader(d.preheader)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/emails" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-3" /> Emails</Link>
          <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="mr-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4" /> Send this email
          </label>
          <Button variant="outline" onClick={reset}><RotateCcwIcon /> Reset</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      <div className="rise flex flex-wrap items-center gap-2" style={{ "--i": 1 } as React.CSSProperties}>
        <Input value={to} onChange={(e) => setTo(e.target.value)} type="email" placeholder="Send a test to…" className="w-64" />
        <Button variant="outline" onClick={test} disabled={testing || !to}><SendIcon /> {testing ? "Sending…" : "Send test"}</Button>
        {msg && <span className={msg.ok ? "text-sm text-positive" : "text-sm text-negative"}>{msg.text}</span>}
      </div>

      <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
        <EmailEditor doc={doc} onDoc={setDoc} subject={subject} onSubject={setSubject} preheader={preheader} onPreheader={setPreheader} products={products} kind="transactional" storeUrl={storeUrl} />
      </div>
    </div>
  )
}
