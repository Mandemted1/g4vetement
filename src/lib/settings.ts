import "server-only"
import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"
import { DEFAULT_LOGIN, DEFAULT_POLICIES, DEFAULT_STORE, type LoginSettings, type Policies, type StoreSettings } from "./settings-types"

export type { LoginSettings, Policies, StoreSettings } from "./settings-types"

/**
 * One row per setting in site_settings. Read on the server with the service key: callers are public pages
 * (login look, store footer, policy pages) that only ever receive the one setting they ask for.
 */
async function read<T extends object>(key: string, defaults: T): Promise<T> {
  if (!isLive) return defaults
  try {
    const { data } = await serviceClient().from("site_settings").select("value").eq("key", key).maybeSingle()
    return { ...defaults, ...((data?.value as Partial<T>) ?? {}) }
  } catch {
    return defaults
  }
}

export const getLoginSettings = () => read<LoginSettings>("login", DEFAULT_LOGIN)
export const getStoreSettings = () => read<StoreSettings>("store", DEFAULT_STORE)
export const getPolicies = () => read<Policies>("policies", DEFAULT_POLICIES)

/** The business address on one line (for email footers). Falls back to the STORE_ADDRESS environment variable. */
export async function getAddressLine(): Promise<string> {
  const s = await getStoreSettings()
  const fromSettings = s.address.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(", ")
  return fromSettings || process.env.STORE_ADDRESS || ""
}
