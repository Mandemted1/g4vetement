/**
 * Backfills ~90 days of demo visitor traffic that matches your order history.   Run: npm run seed-analytics
 * Re-running replaces the previous demo traffic (rows flagged sim=true). Real visits are never touched.
 */
import { createClient } from "@supabase/supabase-js"
import store from "../src/data/store.json"
import { simVisitsForDay } from "./sim-visits.mjs"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing env vars in .env.local")
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const probe = await db.from("visits").select("id", { head: true, count: "exact" })
if (probe.error) {
  console.error("✗ The visits table doesn't exist yet. Run `npm run migrate` first (or paste supabase/003_email_analytics.sql into the SQL editor).")
  process.exit(1)
}

const DAY = 86_400_000
const perDay = new Map<number, number>()
for (const o of store.orders) {
  const d = new Date(o.date)
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  perDay.set(t, (perDay.get(t) ?? 0) + 1)
}
const last = Math.max(...perDay.keys())
const ids = store.products.map((p) => p.id)
const weights = store.products.map((p) => (p as { weight?: number }).weight ?? 5)

await db.from("visits").delete().eq("sim", true)
let total = 0
let batch: ReturnType<typeof simVisitsForDay> = []
const flush = async () => {
  for (let i = 0; i < batch.length; i += 1000) {
    const { error } = await db.from("visits").insert(batch.slice(i, i + 1000))
    if (error) {
      console.error("✗", error.message)
      process.exit(1)
    }
  }
  total += batch.length
  batch = []
}
for (let d = last - 89 * DAY; d <= last; d += DAY) {
  batch.push(...simVisitsForDay(d, perDay.get(d) ?? 0, ids, weights, mulberry32(d / DAY)))
  if (batch.length > 8000) await flush()
}
await flush()
console.log(`✓ ${total} demo visits added across 90 days`)
