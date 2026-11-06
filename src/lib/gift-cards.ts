import "server-only"
import { adminClient } from "@/lib/admin-auth"
import { isLive } from "@/lib/supabase/env"
import type { GiftCard, GiftEntry } from "./gift-card-types"

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface GiftCardsData {
  cards: GiftCard[]
  /** the ledger of every card, newest first, keyed by card id */
  ledger: Record<string, GiftEntry[]>
  missing: boolean
  demo: boolean
}

/** Everything the Gift cards page shows. Admins only (the tables are closed to everyone else). */
export async function getGiftCards(): Promise<GiftCardsData> {
  if (!isLive) return { cards: [], ledger: {}, missing: false, demo: true }
  const db = await adminClient()
  if (!db) return { cards: [], ledger: {}, missing: false, demo: false }
  const [cards, ledger] = await Promise.all([
    db.from("gift_cards").select("*").order("created_at", { ascending: false }).limit(1000),
    db.from("gift_card_ledger").select("card_id, delta, kind, order_id, note, created_at").order("created_at", { ascending: false }).limit(5000),
  ])
  if (cards.error || ledger.error) return { cards: [], ledger: {}, missing: true, demo: false }
  const by: Record<string, GiftEntry[]> = {}
  for (const e of ledger.data as any[]) (by[e.card_id] ??= []).push({ delta: e.delta, kind: e.kind, orderId: e.order_id, note: e.note, createdAt: e.created_at })
  return {
    missing: false,
    demo: false,
    ledger: by,
    cards: (cards.data as any[]).map((c) => ({
      id: c.id, code: c.code, initial: c.initial_amount, balance: c.balance, note: c.note, recipient: c.recipient_email, active: c.active, expiresAt: c.expires_at, createdAt: c.created_at,
    })),
  }
}
