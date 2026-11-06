"use server"

import { revalidatePath } from "next/cache"
import { adminClient, currentStaff, noAccess } from "@/lib/admin-auth"
import { isRole, type Role } from "@/lib/permissions"
import { findUserByEmail, randomPassword } from "@/lib/team"
import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const DEMO = { ok: false as const, error: "Demo mode: connect Supabase to manage the team." }
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const refresh = () => revalidatePath("/admin/team")
const friendly = (m: string) => (/at least one owner/i.test(m) ? "There must always be at least one owner." : m.replace(/^.*?ERROR:\s*/, ""))

/** Only an owner may change the team. Returns the owner, or the message to show. */
async function owner(): Promise<{ id: string } | { error: string }> {
  if (!isLive) return { error: DEMO.error }
  if (!(await adminClient("staff.manage"))) return { error: await noAccess("staff.manage") }
  const me = await currentStaff()
  return me ? { id: me.id } : { error: "Please sign in again." }
}

/**
 * Adds someone to the team. A new email gets a new account with a temporary password (shown once, for you to pass on);
 * an email that already has an account (for example a customer account) is given the role and keeps its own password.
 */
export async function addTeamMember(input: { email: string; role: string }): Promise<Result<{ created: boolean; password?: string; email: string }>> {
  const me = await owner()
  if ("error" in me) return { ok: false, error: me.error }
  const email = input.email.trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 200) return { ok: false, error: "Enter a valid email address." }
  if (!isRole(input.role)) return { ok: false, error: "Choose a role." }

  const svc = serviceClient()
  const existing = await findUserByEmail(email)
  if (existing) {
    const { data: already } = await svc.from("admins").select("user_id").eq("user_id", existing.id).maybeSingle()
    if (already) return { ok: false, error: "That person is already on the team." }
    const { error } = await svc.from("admins").insert({ user_id: existing.id, role: input.role })
    if (error) return { ok: false, error: friendly(error.message) }
    refresh()
    return { ok: true, created: false, email }
  }
  const password = randomPassword()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) return { ok: false, error: friendly(error?.message ?? "Couldn't create the account.") }
  const { error: e2 } = await svc.from("admins").insert({ user_id: data.user.id, role: input.role })
  if (e2) {
    await svc.auth.admin.deleteUser(data.user.id) // don't leave a half-made account behind
    return { ok: false, error: friendly(e2.message) }
  }
  refresh()
  return { ok: true, created: true, password, email }
}

export async function setTeamRole(userId: string, role: Role): Promise<Result> {
  const me = await owner()
  if ("error" in me) return { ok: false, error: me.error }
  if (!isRole(role)) return { ok: false, error: "Choose a role." }
  if (userId === me.id) return { ok: false, error: "You can't change your own role. Ask another owner." }
  const { error } = await serviceClient().from("admins").update({ role }).eq("user_id", userId)
  if (error) return { ok: false, error: friendly(error.message) }
  refresh()
  return { ok: true }
}

/** Takes away team access. Their account stays (so they can still shop), but they can no longer open the admin. */
export async function removeTeamMember(userId: string): Promise<Result> {
  const me = await owner()
  if ("error" in me) return { ok: false, error: me.error }
  if (userId === me.id) return { ok: false, error: "You can't remove yourself. Ask another owner." }
  const { error } = await serviceClient().from("admins").delete().eq("user_id", userId)
  if (error) return { ok: false, error: friendly(error.message) }
  refresh()
  return { ok: true }
}

/** Sets a new temporary password for a team member (shown once). For your own password, use My account. */
export async function resetTeamPassword(userId: string): Promise<Result<{ password: string }>> {
  const me = await owner()
  if ("error" in me) return { ok: false, error: me.error }
  if (userId === me.id) return { ok: false, error: "Change your own password under My account." }
  const svc = serviceClient()
  const { data: member } = await svc.from("admins").select("user_id").eq("user_id", userId).maybeSingle()
  if (!member) return { ok: false, error: "That person isn't on the team." }
  const password = randomPassword()
  const { error } = await svc.auth.admin.updateUserById(userId, { password })
  if (error) return { ok: false, error: friendly(error.message) }
  return { ok: true, password }
}
