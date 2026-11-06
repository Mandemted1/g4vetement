/**
 * Makes an existing account an admin.   npm run make-admin -- someone@example.com
 * The person must already have signed up (Supabase > Authentication > Users > Add user, or the admin login).
 * Customers who sign up on the store are never admins unless you run this for them.
 */
import { createClient } from "@supabase/supabase-js"

const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
  console.error("Usage: npm run make-admin -- someone@example.com")
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
const { error } = await db.from("admins").upsert({ user_id: user.id })
if (error) throw error
console.log(`✓ ${email} is now an admin.`)
