"use server"

import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

const UUID = /^[0-9a-f-]{36}$/i

export async function setSubscription(token: string, subscribed: boolean): Promise<{ ok: boolean }> {
  if (!isLive || !UUID.test(token)) return { ok: false }
  const { error } = await serviceClient()
    .from("subscribers")
    .update(subscribed ? { status: "subscribed", unsubscribed_at: null } : { status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("token", token)
  return { ok: !error }
}
