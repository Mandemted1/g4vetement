import "server-only"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { SUPABASE_ANON, SUPABASE_URL } from "./env"

/** Next.js can cache fetch() responses between requests. Store data (stock, prices, categories) must always be current. */
const fresh: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" })

/** Public, cookie-less client for the storefront (reads active products, places orders via place_order()). */
export function anonClient() {
  return createClient(SUPABASE_URL!, SUPABASE_ANON!, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fresh } })
}

/** Session-aware client for the admin (RLS applies as the signed-in user). */
export async function sessionClient() {
  const jar = await cookies()
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON!, {
    global: { fetch: fresh },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options))
        } catch {
          // called from a Server Component: the proxy refreshes the session instead
        }
      },
    },
  })
}

/**
 * Service-role client: bypasses RLS. Server-only, and only ever used after the caller has been
 * authorised (admin session, signed webhook, cron secret) or for narrowly scoped public actions.
 */
export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  return createClient(SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fresh } })
}
