import "server-only"
import { sessionClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"
import { DEFAULT_CAMPAIGN, DEFAULT_TEMPLATES, TEMPLATE_META, type TemplateKey } from "./defaults"
import { emailConfigured, fromAddress, storeAddress, storeUrl } from "./send"
import type { EmailDoc } from "./types"

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface TemplateItem {
  key: TemplateKey
  name: string
  description: string
  subject: string
  preheader: string
  doc: EmailDoc
  enabled: boolean
  updatedAt: string | null
  customised: boolean
}
export interface CampaignItem {
  id: string
  name: string
  subject: string
  preheader: string
  doc: EmailDoc
  audience: string
  status: "draft" | "scheduled" | "sending" | "sent" | "failed"
  scheduledAt: string | null
  sentAt: string | null
  recipients: number
  error: string | null
  stats: { sent: number; delivered: number; opened: number; clicked: number; bounced: number; failed: number }
}
export interface MessageItem {
  id: number
  kind: string
  to: string
  status: string
  opened: boolean
  clicked: boolean
  error: string | null
  at: string
}

export function emailConfig() {
  return { configured: emailConfigured(), from: fromAddress(), testMode: fromAddress().includes("resend.dev"), hasAddress: Boolean(storeAddress()), hasWebhook: Boolean(process.env.RESEND_WEBHOOK_SECRET), siteUrl: storeUrl() }
}

const emptyStats = () => ({ sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, failed: 0 })

export async function getTemplates(): Promise<{ items: TemplateItem[]; tablesMissing: boolean }> {
  const base = TEMPLATE_META.map((m) => ({ ...m, ...DEFAULT_TEMPLATES[m.key], enabled: true, updatedAt: null as string | null, customised: false }))
  if (!isLive) return { items: base, tablesMissing: false }
  const { data, error } = await (await sessionClient()).from("email_templates").select("*")
  if (error) return { items: base, tablesMissing: true }
  const rows = new Map((data ?? []).map((r: any) => [r.key, r]))
  return {
    items: base.map((b) => {
      const r = rows.get(b.key)
      return r ? { ...b, subject: r.subject, preheader: r.preheader, doc: r.doc, enabled: r.enabled, updatedAt: r.updated_at, customised: true } : b
    }),
    tablesMissing: false,
  }
}

export async function getMessages(limit = 25): Promise<MessageItem[]> {
  if (!isLive) return []
  const { data } = await (await sessionClient()).from("email_messages").select("*").order("created_at", { ascending: false }).limit(limit)
  return (data ?? []).map((m: any) => ({ id: m.id, kind: m.kind, to: m.to_email, status: m.status, opened: Boolean(m.opened_at), clicked: Boolean(m.clicked_at), error: m.error, at: m.created_at }))
}

async function statsFor(ids: string[]) {
  const out = new Map<string, CampaignItem["stats"]>(ids.map((i) => [i, emptyStats()]))
  if (!ids.length) return out
  const { data } = await (await sessionClient()).from("email_messages").select("campaign_id, status, opened_at, clicked_at").in("campaign_id", ids).limit(20000)
  for (const m of (data ?? []) as any[]) {
    const s = out.get(m.campaign_id)
    if (!s) continue
    if (m.status === "failed") s.failed++
    else s.sent++
    if (m.status === "delivered") s.delivered++
    if (m.status === "bounced") s.bounced++
    if (m.opened_at) s.opened++
    if (m.clicked_at) s.clicked++
  }
  return out
}

const toCampaign = (c: any, stats: CampaignItem["stats"]): CampaignItem => ({
  id: c.id, name: c.name, subject: c.subject, preheader: c.preheader, doc: c.doc, audience: c.audience, status: c.status,
  scheduledAt: c.scheduled_at, sentAt: c.sent_at, recipients: c.recipients, error: c.error, stats,
})

export async function getCampaigns(): Promise<{ items: CampaignItem[]; tablesMissing: boolean }> {
  if (!isLive) return { items: [], tablesMissing: false }
  const { data, error } = await (await sessionClient()).from("campaigns").select("*").order("created_at", { ascending: false })
  if (error) return { items: [], tablesMissing: true }
  const stats = await statsFor((data ?? []).map((c: any) => c.id))
  return { items: (data ?? []).map((c: any) => toCampaign(c, stats.get(c.id) ?? emptyStats())), tablesMissing: false }
}

export async function getCampaign(id: string): Promise<CampaignItem | null> {
  if (!isLive) return null
  const { data } = await (await sessionClient()).from("campaigns").select("*").eq("id", id).maybeSingle()
  if (!data) return null
  return toCampaign(data, (await statsFor([id])).get(id) ?? emptyStats())
}

export const blankCampaign = (): CampaignItem => ({
  id: "new", name: DEFAULT_CAMPAIGN.name, subject: DEFAULT_CAMPAIGN.subject, preheader: DEFAULT_CAMPAIGN.preheader, doc: DEFAULT_CAMPAIGN.doc,
  audience: "subscribers", status: "draft", scheduledAt: null, sentAt: null, recipients: 0, error: null, stats: emptyStats(),
})
