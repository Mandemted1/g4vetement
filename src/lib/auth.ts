import "server-only"
import { redirect } from "next/navigation"
import { currentStaff, type Staff } from "./admin-auth"
import { roleCan, type Cap } from "./permissions"
import { sessionClient } from "./supabase/clients"
import { isLive } from "./supabase/env"

/** Second line of defence behind proxy.ts: pages themselves refuse to render without a signed-in admin. */
export async function requireAdmin() {
  if (!isLive) {
    // A deployed store must never show the open demo admin: send people to the "not connected" notice instead.
    if (process.env.VERCEL_ENV === "production") redirect("/admin/login")
    return null
  }
  const db = await sessionClient()
  const { data } = await db.auth.getUser()
  if (!data.user) redirect("/admin/login")
  // customers have accounts too: only people on the admin list get in
  const { data: yes } = await db.rpc("is_admin")
  if (yes !== true) redirect("/admin/login?denied=1")
  return data.user
}

/**
 * Pages call this: signed in and on the team, or sent to the login. Returns the person and their role
 * (null in demo mode, where there are no accounts).
 */
export async function requireStaff(): Promise<Staff | null> {
  if (!isLive) {
    if (process.env.VERCEL_ENV === "production") redirect("/admin/login")
    return null
  }
  const { data } = await (await sessionClient()).auth.getUser()
  if (!data.user) redirect("/admin/login")
  const staff = await currentStaff()
  if (!staff) redirect("/admin/login?denied=1")
  return staff
}

/** For pages only some roles may open: anyone else lands on the dashboard with a notice. */
export async function requireCap(cap: Cap): Promise<Staff | null> {
  const staff = await requireStaff()
  if (staff && !roleCan(staff.role, cap)) redirect("/admin?restricted=1")
  return staff
}
