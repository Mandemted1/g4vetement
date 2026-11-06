import "server-only"
import { redirect } from "next/navigation"
import { sessionClient } from "./supabase/clients"
import { isLive } from "./supabase/env"

/** Second line of defence behind proxy.ts: pages themselves refuse to render without a signed-in admin. */
export async function requireAdmin() {
  if (!isLive) return null
  const { data } = await (await sessionClient()).auth.getUser()
  if (!data.user) redirect("/admin/login")
  return data.user
}
