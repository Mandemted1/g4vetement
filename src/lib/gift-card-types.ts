/** Gift cards as the admin sees them, plus the rules for codes and status (pure, shared by server and browser). */

export interface GiftCard {
  id: string
  code: string
  initial: number
  balance: number
  note: string
  recipient: string
  active: boolean
  expiresAt: string | null
  createdAt: string
}

export interface GiftEntry {
  delta: number
  kind: "issue" | "redeem" | "refund" | "adjust"
  orderId: string | null
  note: string
  createdAt: string
}

export type GiftStatus = "active" | "disabled" | "expired" | "used_up"

export function giftStatus(c: Pick<GiftCard, "active" | "balance" | "expiresAt">, now = Date.now()): GiftStatus {
  if (!c.active) return "disabled"
  if (c.expiresAt && Date.parse(c.expiresAt) <= now) return "expired"
  if (c.balance <= 0) return "used_up"
  return "active"
}

/** Letters and digits that can't be mistaken for each other (no I, O, 0 or 1), so codes read out over the phone are safe. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** Makes a code like GC-7K4M-92QX-HD3R from random indexes (0 to 31 each). */
export function formatCode(indexes: number[]): string {
  const chars = indexes.map((i) => CODE_ALPHABET[i % CODE_ALPHABET.length])
  return "GC-" + [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join("")).join("-")
}

/** What a typed code is stored as: capitals, no spaces. */
export const normalizeCode = (s: string) => s.replace(/\s+/g, "").toUpperCase()

export const KIND_LABEL: Record<GiftEntry["kind"], string> = { issue: "Issued", redeem: "Used at checkout", refund: "Put back (order cancelled or refunded)", adjust: "Adjusted by admin" }
