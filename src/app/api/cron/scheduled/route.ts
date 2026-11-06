import { processAbandonedCarts } from "@/lib/email/abandoned"
import { deliverCampaign } from "@/lib/email/service"
import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

export const maxDuration = 60

/**
 * Sends campaigns whose scheduled time has passed, sends abandoned-cart reminders that are due, and trims old visitor rows.
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
  // one reminder to each bag left behind (when switched on in Settings)
  const carts = await processAbandonedCarts()
  return Response.json({ campaigns: results, prunedVisits: pruned ?? 0, cartReminders: carts })
}
