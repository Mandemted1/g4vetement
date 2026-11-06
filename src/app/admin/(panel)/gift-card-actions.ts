"use server"

import { randomInt } from "node:crypto"
import { revalidatePath } from "next/cache"
import { adminClient, noAccess } from "@/lib/admin-auth"
import { CODE_ALPHABET, formatCode, normalizeCode } from "@/lib/gift-card-types"
import { isLive } from "@/lib/supabase/env"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const DEMO = { ok: false as const, error: "Demo mode: connect Supabase to manage gift cards." }
const friendly = (e: { message: string; code?: string }) => {
  if (e.code === "23505" || /duplicate|unique/i.test(e.message)) return "A gift card with that code already exists."
  if (/does not exist|schema cache/i.test(e.message)) return "Gift cards aren't installed yet. Run `npm run migrate` first."
  return e.message.replace(/^.*?ERROR:\s*/, "")
}
const refresh = () => revalidatePath("/admin/gift-cards")

/** A fresh random code. Uses the system's secure random numbers, never Math.random(). */
const randomCode = () => formatCode(Array.from({ length: 12 }, () => randomInt(CODE_ALPHABET.length)))

export interface NewGiftCard {
  amount: number
  note: string
  recipient: string
  /** yyyy-mm-dd, or empty for no expiry */
  expires: string
  /** leave empty to generate one */
  code: string
}

export async function createGiftCard(input: NewGiftCard): Promise<Result<{ code: string }>> {
  if (!isLive) return DEMO
  const db = await adminClient("giftcards.manage")
  if (!db) return { ok: false, error: await noAccess("giftcards.manage") }
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > 10_000) return { ok: false, error: "The amount must be a whole number of dollars, from $1 to $10,000." }
  const recipient = input.recipient.trim()
  if (recipient && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) return { ok: false, error: "That recipient email doesn't look right (or leave it empty)." }
  let expires: string | null = null
  if (input.expires.trim()) {
    const d = new Date(`${input.expires.trim()}T23:59:59Z`)
    if (Number.isNaN(d.getTime())) return { ok: false, error: "That expiry date isn't valid." }
    expires = d.toISOString()
  }
  const custom = normalizeCode(input.code)
  if (custom && !/^[A-Z0-9-]{8,32}$/.test(custom)) return { ok: false, error: "A custom code is 8 to 32 letters, numbers or dashes." }

  // generated codes are essentially never taken; retry a couple of times anyway
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = custom || randomCode()
    const { error } = await db.rpc("issue_gift_card", { p_code: code, p_amount: input.amount, p_note: input.note.trim().slice(0, 200), p_recipient: recipient, p_expires: expires })
    if (!error) {
      refresh()
      return { ok: true, code }
    }
    if (custom || !(error.code === "23505" || /duplicate|unique/i.test(error.message))) return { ok: false, error: friendly(error) }
  }
  return { ok: false, error: "Couldn't generate a unique code. Try again." }
}

/** Adds (positive) or takes off (negative) money, with a note for the ledger. */
export async function adjustGiftCard(id: string, delta: number, note: string): Promise<Result<{ balance: number }>> {
  if (!isLive) return DEMO
  const db = await adminClient("giftcards.manage")
  if (!db) return { ok: false, error: await noAccess("giftcards.manage") }
  if (!Number.isInteger(delta) || delta === 0) return { ok: false, error: "Enter a whole number of dollars to add or take off." }
  const { data, error } = await db.rpc("adjust_gift_card", { p_card: id, p_delta: delta, p_note: note.trim().slice(0, 200) })
  if (error) return { ok: false, error: friendly(error) }
  refresh()
  return { ok: true, balance: Number(data) }
}

export async function setGiftCardActive(id: string, active: boolean): Promise<Result> {
  if (!isLive) return DEMO
  const db = await adminClient("giftcards.manage")
  if (!db) return { ok: false, error: await noAccess("giftcards.manage") }
  const { error } = await db.from("gift_cards").update({ active }).eq("id", id)
  if (error) return { ok: false, error: friendly(error) }
  refresh()
  return { ok: true }
}
