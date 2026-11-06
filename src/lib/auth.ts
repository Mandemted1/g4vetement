import "server-only"
import { redirect } from "next/navigation"
import { sessionClient } from "./supabase/clients"
import { isLive } from "./supabase/env"

/** Second line of defence behind proxy.ts: pages themselves refuse to render without a signed-in admin. */
export async function requireAdmin() {
  if (!isLive) {
    // A deployed store must never show the open demo admin: send people to the "not connected" notice instead.
    if (process.env.VERCEL_ENV === "production") redirect("/admin/login")
    return null
  }
  const { data } = await (await sessionClient()).auth.getUser()
  if (!data.user) redirect("/admin/login")
  return data.user
}
