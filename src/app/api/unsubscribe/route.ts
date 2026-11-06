import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

const UUID = /^[0-9a-f-]{36}$/i

/** One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header. */
export async function POST(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? ""
  if (!isLive || !UUID.test(t)) return new Response("Invalid link", { status: 400 })
  await serviceClient().from("subscribers").update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() }).eq("token", t)
  return new Response("Unsubscribed")
}

/** A plain GET only forwards to the confirmation page (so link scanners can't unsubscribe people by accident). */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? ""
  return Response.redirect(new URL(`/unsubscribe/${encodeURIComponent(t)}`, req.url), 302)
}
