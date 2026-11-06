"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CARRIERS, cleanTracking } from "@/lib/tracking"
import type { TrackingInput } from "@/app/admin/actions"

const lbl = "flex flex-col gap-1.5 text-sm"

/**
 * Carrier + tracking number (+ a link for "Other" carriers). Used both to mark an order shipped
 * and to correct the tracking of an order that already shipped.
 */
export function TrackingForm({
  initial,
  busy,
  error,
  primary,
  secondary,
  onSubmit,
  onCancel,
}: {
  initial?: { carrier: string; number: string; url: string } | null
  busy: boolean
  error: string
  /** main button: saves with the tracking entered */
  primary: { label: string; resend?: boolean }
  /** optional second button (e.g. "Ship without tracking" or "Save without emailing") */
  secondary?: { label: string; resend?: boolean; skipTracking?: boolean }
  onSubmit: (t: TrackingInput | null, opts: { resend: boolean }) => void
  onCancel: () => void
}) {
  const [carrier, setCarrier] = useState(initial?.carrier || "UPS")
  const [number, setNumber] = useState(initial?.number ?? "")
  const [url, setUrl] = useState(initial?.carrier === "Other" ? initial.url : "")
  const [localErr, setLocalErr] = useState("")

  const go = (b: { resend?: boolean; skipTracking?: boolean }) => {
    setLocalErr("")
    if (b.skipTracking) return onSubmit(null, { resend: b.resend ?? true })
    const c = cleanTracking({ carrier, number, url })
    if (!c.ok) return setLocalErr(c.error)
    onSubmit({ carrier, number, url }, { resend: b.resend ?? true })
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        go(primary)
      }}
    >
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <label className={lbl}>
          Carrier
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
            {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className={lbl}>
          Tracking number
          <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="1Z999AA10123456784" autoComplete="off" spellCheck={false} maxLength={60} className="font-mono" />
        </label>
      </div>
      {carrier === "Other" && (
        <label className={lbl}>
          Tracking link <span className="text-xs text-muted-foreground">(optional; the page where they can follow the parcel)</span>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" inputMode="url" autoComplete="off" />
        </label>
      )}
      {(localErr || error) && <p className="text-xs text-negative">{localErr || error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : primary.label}</Button>
        {secondary && <Button type="button" variant="outline" disabled={busy} onClick={() => go(secondary)}>{secondary.label}</Button>}
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}
