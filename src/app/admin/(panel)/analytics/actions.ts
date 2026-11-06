"use server"

import { sessionClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

export interface Overview {
  visitors: number
  pageviews: number
  sessions: number
  daily: { d: string; views: number; visitors: number }[]
  pages: { path: string; views: number; visitors: number }[]
  sources: { name: string; visitors: number }[]
  countries: { name: string; visitors: number }[]
  devices: { name: string; visitors: number }[]
  browsers: { name: string; visitors: number }[]
  funnel: { visitors: number; product_view: number; add_to_cart: number; checkout_start: number; purchase: number }
  products: { product_id: string; views: number; adds: number }[]
}
export interface Live {
  visitors: number
  carts: number
  pages: { path: string; visitors: number }[]
  countries: { name: string; visitors: number }[]
}

export async function getOverview(days: number): Promise<{ ok: true; data: Overview } | { ok: false; error: string }> {
  if (!isLive) return { ok: false, error: "Demo mode: connect Supabase to collect visitor data." }
  const db = await sessionClient()
  if (!(await db.auth.getUser()).data.user) return { ok: false, error: "Please sign in again." }
  const { data, error } = await db.rpc("analytics_overview", { p_days: Math.min(365, Math.max(1, Math.round(days))) })
  if (error) return { ok: false, error: /does not exist|schema cache/i.test(error.message) ? "Analytics isn't installed yet. Run `npm run migrate` (or the 003 SQL file)." : error.message }
  return { ok: true, data: data as Overview }
}

export async function getLive(): Promise<Live | null> {
  if (!isLive) return null
  const db = await sessionClient()
  if (!(await db.auth.getUser()).data.user) return null
  const { data, error } = await db.rpc("analytics_live")
  return error ? null : (data as Live)
}
