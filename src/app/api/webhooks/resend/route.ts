import { createHmac, timingSafeEqual } from "node:crypto"
import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

/** Resend (Svix) webhook: keeps delivered / opened / clicked / bounced status up to date. */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!isLive || !secret) return new Response("Webhook not configured", { status: 503 })

  const body = await req.text()
  const id = req.headers.get("svix-id") ?? ""
  const ts = req.headers.get("svix-timestamp") ?? ""
  const sigs = (req.headers.get("svix-signature") ?? "").split(" ")
  if (!id || !ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return new Response("Bad timestamp", { status: 400 })

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64")
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest()
  const valid = sigs.some((s) => {
    const [, b64] = s.split(",")
    if (!b64) return false
    const got = Buffer.from(b64, "base64")
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
  if (!valid) return new Response("Invalid signature", { status: 401 })

  const evt = JSON.parse(body) as { type: string; data?: { email_id?: string; to?: string[] } }
  const rid = evt.data?.email_id
  if (!rid) return new Response("ok")

  const db = serviceClient()
  const now = new Date().toISOString()
  switch (evt.type) {
    case "email.delivered":
      await db.from("email_messages").update({ status: "delivered" }).eq("resend_id", rid).eq("status", "sent")
      break
    case "email.opened":
      await db.from("email_messages").update({ opened_at: now }).eq("resend_id", rid).is("opened_at", null)
      break
    case "email.clicked":
      await db.from("email_messages").update({ clicked_at: now, opened_at: now }).eq("resend_id", rid).is("clicked_at", null)
      break
    case "email.bounced":
    case "email.complained": {
      const status = evt.type === "email.bounced" ? "bounced" : "complained"
      await db.from("email_messages").update({ status }).eq("resend_id", rid)
      // never email a bounced or complaining address again
      for (const to of evt.data?.to ?? []) await db.from("subscribers").update({ status: "unsubscribed", unsubscribed_at: now }).ilike("email", to)
      break
    }
  }
  return new Response("ok")
}
