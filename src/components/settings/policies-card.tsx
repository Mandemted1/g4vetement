"use client"

import { useState, useTransition } from "react"
import { ExternalLinkIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { savePolicies } from "@/app/admin/actions"
import { PolicyText } from "@/components/store/policy-text"
import { DEFAULT_POLICIES, POLICY_META, type PolicySlug, type Policies } from "@/lib/settings-types"
import { cn } from "@/lib/utils"

export function PoliciesCard({ initial }: { initial: Policies }) {
  const [p, setP] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [tab, setTab] = useState<PolicySlug>("shipping")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, start] = useTransition()
  const dirty = POLICY_META.some(({ slug }) => p[slug] !== saved[slug])
  const changed = (slug: PolicySlug) => p[slug] !== saved[slug]

  const save = () =>
    start(async () => {
      setMsg(null)
      const r = await savePolicies(p)
      if (r.ok) {
        setSaved(p)
        setMsg({ ok: true, text: "Saved. The pages are live on your store." })
      } else setMsg({ ok: false, text: r.error })
    })

  const current = POLICY_META.find((m) => m.slug === tab)!

  return (
    <Card className="rise" style={{ "--i": 2 } as React.CSSProperties}>
      <CardHeader>
        <CardTitle>Policies and help pages</CardTitle>
        <CardDescription>Pages linked from your store footer: size guide, shipping, returns, FAQ, privacy and terms. Start from the text below and make it yours. These are not legal advice, so have a lawyer review them.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {POLICY_META.map((m) => (
            <button
              key={m.slug}
              role="tab"
              aria-selected={tab === m.slug}
              onClick={() => setTab(m.slug)}
              className={cn("rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-muted", tab === m.slug && "border-foreground bg-muted font-medium")}
            >
              {m.title}
              {changed(m.slug) && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-warning align-middle" title="Unsaved changes" />}
            </button>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{current.blurb}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setP({ ...p, [tab]: DEFAULT_POLICIES[tab] })}><RotateCcwIcon /> Reset to starter text</Button>
            </div>
            <textarea
              value={p[tab]}
              onChange={(e) => setP({ ...p, [tab]: e.target.value })}
              spellCheck
              aria-label={`${current.title} page text`}
              className="min-h-[360px] w-full rounded-lg border border-input bg-transparent px-3 py-2.5 font-mono text-[13px] leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <p className="text-xs text-muted-foreground">
              Formatting: start a line with <code className="rounded bg-muted px-1">## </code> for a heading and <code className="rounded bg-muted px-1">- </code> for a bullet. Leave a blank line between paragraphs. For a table, write each row between bars, like <code className="rounded bg-muted px-1">| Size | Chest |</code>, with the column titles on the first row.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">Preview</span>
            <div className="max-h-[420px] overflow-y-auto rounded-xl border bg-[#f3f2ef] p-6 text-[14px] leading-relaxed text-[#0d0d0d]">
              <h1 className="mb-6 text-3xl font-medium leading-none tracking-[-0.05em]">{current.title}</h1>
              {p[tab].trim() ? <PolicyText text={p[tab]} /> : <p className="text-[#8a8780]">This page is empty, so it won&apos;t show in the footer.</p>}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={saving || !dirty}>{saving ? "Saving…" : "Save policies"}</Button>
          {dirty && !saving && <Button variant="ghost" onClick={() => { setP(saved); setMsg(null) }}>Discard all changes</Button>}
          <a href={`/policies/${tab}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            View live page <ExternalLinkIcon className="size-3" />
          </a>
          {msg && <span className={msg.ok ? "text-sm text-positive" : "text-sm text-negative"}>{msg.text}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
