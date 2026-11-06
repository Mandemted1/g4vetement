import { NextResponse } from "next/server"
import { sessionClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

/** Only the pages an email link may open (never a full URL). */
const NEXT = new Set(["/account", "/account/reset"])

/** Where the "confirm your email" and "reset your password" links land: swaps the one-time code for a session, then opens the right page. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const n = url.searchParams.get("next") ?? ""
  const next = NEXT.has(n) ? n : "/account"
  if (isLive && code) {
    const { error } = await (await sessionClient()).auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(new URL(next === "/account/reset" ? "/account/login?reset=failed" : "/account/login?confirm=failed", url.origin))
  }
  return NextResponse.redirect(new URL(next, url.origin))
}
