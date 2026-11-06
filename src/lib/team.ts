import "server-only"
import { randomInt } from "node:crypto"
import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"
import { isRole, type Role } from "./permissions"

export interface TeamMember {
  id: string
  email: string
  role: Role
  addedAt: string
  lastSignIn: string | null
}

/** Letters and digits with no look-alikes (no I, O, l, 0, 1), so a password read out or copied by hand isn't misread. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"

/** A strong temporary password from the system's secure random numbers (14 characters, about 80 bits). */
export const randomPassword = () => Array.from({ length: 14 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")

/** Every account, found by email (the auth API has no direct lookup, so this pages through them). */
export async function findUserByEmail(email: string) {
  const svc = serviceClient()
  for (let page = 1; ; page++) {
    const { data } = await svc.auth.admin.listUsers({ page, perPage: 200 })
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
  }
}

/** The team with their emails. Service role: only call after checking the caller may manage staff. */
export async function getTeam(): Promise<TeamMember[]> {
  if (!isLive) return []
  const svc = serviceClient()
  const { data: rows } = await svc.from("admins").select("user_id, role, created_at").order("created_at")
  if (!rows?.length) return []
  const users = new Map<string, { email: string; last: string | null }>()
  for (let page = 1; ; page++) {
    const { data } = await svc.auth.admin.listUsers({ page, perPage: 200 })
    for (const u of data.users) users.set(u.id, { email: u.email ?? "", last: u.last_sign_in_at ?? null })
    if (data.users.length < 200) break
  }
  return rows.flatMap((r) => (isRole(r.role) ? [{ id: r.user_id as string, email: users.get(r.user_id)?.email ?? "(unknown)", role: r.role, addedAt: r.created_at as string, lastSignIn: users.get(r.user_id)?.last ?? null }] : []))
}
