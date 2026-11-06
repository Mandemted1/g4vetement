import "server-only"
import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"
import { WELCOME_CODE, WELCOME_MIN, WELCOME_OFF } from "@/lib/store"
import type { WelcomeOffer } from "./offer-types"

export { offerHeadline, offerFinePrint } from "./offer-types"
export type { WelcomeOffer } from "./offer-types"

/**
 * The code the welcome popup and welcome email hand out. It's a normal discount code (WELCOME10),
 * so the admin can edit or switch it off; with it off, the popup simply doesn't appear.
 */
export async function getWelcomeOffer(): Promise<WelcomeOffer | null> {
  if (!isLive) return { code: WELCOME_CODE, kind: "fixed", value: WELCOME_OFF, minSpend: WELCOME_MIN, firstOrderOnly: true }
  try {
    const { data } = await serviceClient().from("discount_codes").select("*").eq("code", WELCOME_CODE).maybeSingle()
    if (!data || !data.active) return null
    const now = Date.now()
    if (data.starts_at && new Date(data.starts_at).getTime() > now) return null
    if (data.ends_at && new Date(data.ends_at).getTime() <= now) return null
    return { code: data.code, kind: data.kind, value: data.value, minSpend: data.min_spend, firstOrderOnly: data.first_order_only }
  } catch {
    return null
  }
}
