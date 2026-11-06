import "server-only"
import { anonClient, sessionClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"
import { DEFAULT_ZONE, type ShippingZone } from "./shipping"

/* eslint-disable @typescript-eslint/no-explicit-any */
export const toZone = (r: any): ShippingZone => ({
  id: r.id, name: r.name, countries: r.countries ?? [], rate: r.rate, freeOver: r.free_over ?? null, estimate: r.estimate ?? "", active: r.active ?? true, sort: r.sort ?? 0,
})

/** The zones shoppers see (active only). Before the shipping migration is applied, or without a database, the original flat rate applies. */
export async function getShippingZones(): Promise<ShippingZone[]> {
  if (!isLive) return [DEFAULT_ZONE]
  try {
    const { data, error } = await anonClient().rpc("public_shipping")
    if (error || !data) return [DEFAULT_ZONE]
    return (data as any[]).map((r) => toZone({ ...r, active: true }))
  } catch {
    return [DEFAULT_ZONE]
  }
}

/** Every zone, including switched-off ones, for the admin. `missing` = the shipping migration hasn't been run. */
export async function getAdminZones(): Promise<{ zones: ShippingZone[]; missing: boolean; demo: boolean }> {
  if (!isLive) return { zones: [], missing: false, demo: true }
  const { data, error } = await (await sessionClient()).from("shipping_zones").select("*").order("sort").order("created_at")
  if (error) return { zones: [], missing: true, demo: false }
  return { zones: (data ?? []).map(toZone), missing: false, demo: false }
}
