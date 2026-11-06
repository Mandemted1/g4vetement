/**
 * Gives an existing account team access.   npm run make-admin -- someone@example.com [owner|manager|fulfilment|viewer]
 * (The role defaults to owner. You can also add people from the admin: Team.)
 * The person must already have signed up (Supabase > Authentication > Users > Add user, or the admin login).
 * Customers who sign up on the store are never admins unless you run this for them.
 */
import { createClient } from "@supabase/supabase-js"

const email = process.argv[2]?.trim().toLowerCase()
const role = (process.argv[3] ?? "owner").toLowerCase()
if (!email || !["owner", "manager", "fulfilment", "viewer"].includes(role)) {
  console.error("Usage: npm run make-admin -- someone@example.com [owner|manager|fulfilment|viewer]")
  process.exit(1)
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
let user
for (let page = 1; !user; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw error
  user = data.users.find((u) => u.email?.toLowerCase() === email)
  if (data.users.length < 200) break
}
if (!user) {
  console.error(`No account with the email ${email}. Create it first (Supabase > Authentication > Users > Add user).`)
  process.exit(1)
}
const { error } = await db.from("admins").upsert({ user_id: user.id, role })
if (error) throw error
console.log(`✓ ${email} now has ${role} access.`)
