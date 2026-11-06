/**
 * Quick health check of the Supabase setup.   Run: npm run db:check
 * Prints which tables/functions exist and how many rows they hold. Never prints keys.
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Missing env vars in .env.local")
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

for (const t of ["products", "customers", "orders", "order_items", "subscribers"]) {
  const { count, error } = await db.from(t).select("*", { count: "exact", head: true })
  console.log(error ? `✗ ${t}: ${error.message}` : `✓ ${t}: ${count} rows`)
}

const probe = await db.rpc("place_order", { p_name: "", p_email: "", p_city: null, p_state: null, p_items: [], p_code: null })
console.log(
  probe.error?.message?.includes("Your bag is empty")
    ? "✓ place_order() v2 (with discount code) is installed"
    : `✗ place_order() v2: ${probe.error?.message ?? "unexpected response"}`,
)

const { data: buckets } = await db.storage.listBuckets()
console.log(buckets?.some((b) => b.name === "products") ? "✓ storage bucket 'products' exists" : "✗ storage bucket 'products' missing")

const { data: users } = await db.auth.admin.listUsers()
console.log(`✓ auth users: ${users?.users.length ?? 0}`)
