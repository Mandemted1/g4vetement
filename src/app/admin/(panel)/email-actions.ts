"use server"

import { revalidatePath } from "next/cache"
import { deliverCampaign, sendTestEmail } from "@/lib/email/service"
import type { EmailDoc } from "@/lib/email/types"
import { adminClient, noAccess } from "@/lib/admin-auth"
import { isLive } from "@/lib/supabase/env"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const DEMO = { ok: false as const, error: "Demo mode: connect Supabase to save emails." }

const admin = adminClient
const missing = (e: { message: string }) =>
  e.message.includes("does not exist") || e.message.includes("schema cache") ? "The email tables aren't installed yet. Run `npm run migrate` (or the 003 SQL file) first." : e.message

export async function saveTemplate(key: string, v: { subject: string; preheader: string; doc: EmailDoc; enabled: boolean; name: string; description: string }): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("marketing.manage")
  if (!db) return { ok: false, error: await noAccess("marketing.manage") }
  if (!v.subject.trim()) return { ok: false, error: "Add a subject line." }
  const { error } = await db.from("email_templates").upsert({ key, name: v.name, description: v.description, subject: v.subject, preheader: v.preheader, doc: v.doc, enabled: v.enabled, updated_at: new Date().toISOString() })
  if (error) return { ok: false, error: missing(error) }
  revalidatePath("/admin/emails")
  return { ok: true }
}

export async function sendTest(to: string, doc: EmailDoc, subject: string, preheader: string, kind: "marketing" | "transactional"): Promise<Result> {
  if (!isLive) return DEMO
  if (!(await admin("marketing.manage"))) return { ok: false, error: await noAccess("marketing.manage") }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: "Enter a valid email address." }
  const r = await sendTestEmail(to, doc, subject, preheader, kind)
  return r.ok ? { ok: true } : { ok: false, error: r.error }
}

export interface CampaignInput {
  id?: string
  name: string
  subject: string
  preheader: string
  doc: EmailDoc
  audience: string
  scheduledAt?: string | null
}

export async function saveCampaign(v: CampaignInput): Promise<Result<{ id: string }>> {
  if (!isLive) return DEMO
  const db = await admin("marketing.manage")
  if (!db) return { ok: false, error: await noAccess("marketing.manage") }
  const row = { name: v.name.trim() || "Untitled campaign", subject: v.subject, preheader: v.preheader, doc: v.doc, audience: v.audience, scheduled_at: v.scheduledAt || null, status: v.scheduledAt ? "scheduled" : "draft", updated_at: new Date().toISOString() }
  if (v.id) {
    const { data: cur } = await db.from("campaigns").select("status").eq("id", v.id).single()
    if (cur && (cur.status === "sent" || cur.status === "sending")) return { ok: false, error: "A sent campaign can't be edited. Duplicate it instead." }
    const { error } = await db.from("campaigns").update(row).eq("id", v.id)
    if (error) return { ok: false, error: missing(error) }
    revalidatePath("/admin/campaigns")
    return { ok: true, id: v.id }
  }
  const { data, error } = await db.from("campaigns").insert(row).select("id").single()
  if (error || !data) return { ok: false, error: missing(error ?? { message: "Couldn't save" }) }
  revalidatePath("/admin/campaigns")
  return { ok: true, id: data.id }
}

export async function sendCampaignNow(id: string): Promise<Result<{ sent: number; failed: number }>> {
  if (!isLive) return DEMO
  if (!(await admin("marketing.manage"))) return { ok: false, error: await noAccess("marketing.manage") }
  const r = await deliverCampaign(id)
  revalidatePath("/admin/campaigns")
  return r.ok ? { ok: true, sent: r.sent, failed: r.failed } : { ok: false, error: r.error }
}

export async function deleteCampaign(id: string): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("marketing.manage")
  if (!db) return { ok: false, error: await noAccess("marketing.manage") }
  const { error } = await db.from("campaigns").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/admin/campaigns")
  return { ok: true }
}
