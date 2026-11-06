import { deliverCampaign } from "@/lib/email/service"
import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

export const maxDuration = 60

/**
 * Sends campaigns whose scheduled time has passed, and trims old visitor rows.
 * Called by Vercel Cron (daily on the free plan) or any scheduler with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 })
  if (!isLive) return Response.json({ skipped: "demo mode" })

  const db = serviceClient()
  const { data: due } = await db.from("campaigns").select("id").eq("status", "scheduled").lte("scheduled_at", new Date().toISOString())
  const results: Record<string, unknown>[] = []
  for (const c of due ?? []) results.push({ id: c.id, ...(await deliverCampaign(c.id)) })
  const { data: pruned } = await db.rpc("prune_visits", { p_days: 90 })
  return Response.json({ campaigns: results, prunedVisits: pruned ?? 0 })
}
