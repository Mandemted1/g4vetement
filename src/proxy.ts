import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Keeps the Supabase session fresh (admin and customer) and gates /admin behind an admin login.
 * When Supabase isn't configured (demo mode) it lets everything through.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const { pathname } = request.nextUrl
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/")
  if (!url || !anon) {
    if (isAdminPath && process.env.VERCEL_ENV === "production" && pathname !== "/admin/login") return NextResponse.redirect(new URL("/admin/login", request.url))
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data } = await supabase.auth.getUser()
  // customers' sessions are refreshed here too (the storefront reads them on the server); only /admin is gated
  if (!isAdminPath) return response
  const onLogin = pathname === "/admin/login"

  if (!data.user) return onLogin ? response : NextResponse.redirect(new URL("/admin/login", request.url))
  // signed in: but only people on the admin list may enter. A customer who wanders onto /admin sees the login page again.
  const { data: admin } = await supabase.rpc("is_admin")
  if (admin !== true) return onLogin ? response : NextResponse.redirect(new URL("/admin/login?denied=1", request.url))
  if (onLogin) return NextResponse.redirect(new URL("/admin", request.url))
  return response
}

// every page except static files and API routes
export const config = { matcher: ["/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)"] }
