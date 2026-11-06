"use server"

import { currentStaff } from "@/lib/admin-auth"
import { sessionClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

/** Anyone on the team can change their own password. */
export async function changeMyPassword(input: { password: string; confirm: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isLive) return { ok: false, error: "Demo mode: there are no accounts to change." }
  if (!(await currentStaff())) return { ok: false, error: "Please sign in again." }
  if (input.password.length < 10) return { ok: false, error: "Use at least 10 characters." }
  if (input.password.length > 72) return { ok: false, error: "That password is too long (72 characters max)." }
  if (input.password !== input.confirm) return { ok: false, error: "The two passwords don't match." }
  if (/^(.)\1+$/.test(input.password) || /^(password|12345)/i.test(input.password)) return { ok: false, error: "Choose something harder to guess." }
  const { error } = await (await sessionClient()).auth.updateUser({ password: input.password })
  if (error) return { ok: false, error: error.message.replace(/^.*?ERROR:\s*/, "") }
  return { ok: true }
}
