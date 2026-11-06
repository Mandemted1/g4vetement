import "server-only"
import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

export type { LoginSettings } from "./settings-types"
import { DEFAULT_LOGIN, type LoginSettings } from "./settings-types"

/** Reads the admin login look. Safe to call for signed-out visitors: it only ever returns this one setting. */
export async function getLoginSettings(): Promise<LoginSettings> {
  if (!isLive) return DEFAULT_LOGIN
  try {
    const { data } = await serviceClient().from("site_settings").select("value").eq("key", "login").maybeSingle()
    return { ...DEFAULT_LOGIN, ...((data?.value as Partial<LoginSettings>) ?? {}) }
  } catch {
    return DEFAULT_LOGIN
  }
}
