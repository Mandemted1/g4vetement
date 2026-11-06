"use server"

import { optOutByToken } from "@/lib/email/abandoned"

export async function stopReminders(token: string): Promise<{ ok: boolean }> {
  const r = await optOutByToken(token)
  return { ok: r.ok }
}
