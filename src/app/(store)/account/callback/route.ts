import { NextResponse } from "next/server"
import { sessionClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

/** Where the "confirm your email" link lands: swaps the one-time code for a session, then opens the account. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  if (isLive && code) {
    const { error } = await (await sessionClient()).auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(new URL("/account/login?confirm=failed", url.origin))
  }
  return NextResponse.redirect(new URL("/account", url.origin))
}
