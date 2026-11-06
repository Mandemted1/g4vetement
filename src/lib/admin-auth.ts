import "server-only"
import { deniedMessage, roleCan, isRole, type Cap, type Role } from "./permissions"
import { sessionClient } from "./supabase/clients"
import { isLive } from "./supabase/env"

export interface Staff {
  id: string
  email: string
  role: Role
}

/** The signed-in team member and their role, or null (not signed in, or a customer account rather than staff). */
export async function currentStaff(): Promise<Staff | null> {
  if (!isLive) return null
  const db = await sessionClient()
  const { data } = await db.auth.getUser()
  if (!data.user) return null
  const { data: role } = await db.rpc("staff_role")
  return isRole(role) ? { id: data.user.id, email: data.user.email ?? "", role } : null
}

/**
 * The signed-in team member's database client, or null. Being signed in is not enough: customers have accounts too, and
 * team members have roles. With `cap`, the person's role must also allow it (the database enforces the same rule again).
 */
export async function adminClient(cap?: Cap) {
  if (!isLive) return null
  const staff = await currentStaff()
  if (!staff || (cap && !roleCan(staff.role, cap))) return null
  return sessionClient()
}

/** What to tell someone whose request was refused: "sign in again" if they aren't on the team, otherwise what their role can't do. */
export async function noAccess(cap?: Cap): Promise<string> {
  const staff = await currentStaff()
  return staff && cap ? deniedMessage(cap) : "Please sign in again."
}
