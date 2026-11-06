import "server-only"
import { sessionClient } from "./supabase/clients"
import { isLive } from "./supabase/env"

/**
 * The signed-in ADMIN's database client, or null. Being signed in is not enough: customers have accounts too,
 * so the database is asked (is_admin()) whether this user is on the admin list.
 */
export async function adminClient() {
  if (!isLive) return null
  const db = await sessionClient()
  const { data } = await db.auth.getUser()
  if (!data.user) return null
  const { data: yes } = await db.rpc("is_admin")
  return yes === true ? db : null
}
