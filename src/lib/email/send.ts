import "server-only"

const API = "https://api.resend.com"

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY)
export const storeUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100").replace(/\/$/, "")
export const storeAddress = () => process.env.STORE_ADDRESS ?? ""
/** Resend's shared test sender only delivers to the account owner until a domain is verified. */
export const fromAddress = () => process.env.EMAIL_FROM || "G4 <onboarding@resend.dev>"

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}
export type SendResult = { ok: true; id: string } | { ok: false; error: string }

/** Turns Resend's API errors into something a store owner can act on. */
function friendly(status: number, message: string): string {
  const m = message.toLowerCase()
  if (m.includes("only send testing emails to your own email")) return "Resend is still in test mode: it can only send to your own email until you verify a sending domain (resend.com/domains) and set EMAIL_FROM."
  if (m.includes("domain") && m.includes("not verified")) return "Your sending domain isn't verified yet. Verify it at resend.com/domains."
  if (status === 401 || status === 403) return `Resend rejected the request: ${message}`
  if (status === 429) return "Resend rate limit reached. Try again in a minute (free plans are limited to 100 emails a day)."
  return message || `Resend error ${status}`
}

async function call(path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, json }
}

export async function sendEmail(e: OutgoingEmail, replyTo = process.env.EMAIL_REPLY_TO): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, error: "RESEND_API_KEY is not set." }
  try {
    const { status, json } = await call("/emails", { from: fromAddress(), to: [e.to], subject: e.subject, html: e.html, text: e.text, headers: e.headers, ...(replyTo ? { reply_to: replyTo } : {}) })
    if (status >= 200 && status < 300 && typeof json.id === "string") return { ok: true, id: json.id }
    return { ok: false, error: friendly(status, String(json.message ?? "")) }
  } catch (err) {
    return { ok: false, error: `Couldn't reach Resend: ${(err as Error).message}` }
  }
}

/** Up to 100 emails per request. Returns one result per input, in order. */
export async function sendBatch(list: OutgoingEmail[], replyTo = process.env.EMAIL_REPLY_TO): Promise<SendResult[]> {
  if (!emailConfigured()) return list.map(() => ({ ok: false as const, error: "RESEND_API_KEY is not set." }))
  const out: SendResult[] = []
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100)
    try {
      const { status, json } = await call(
        "/emails/batch",
        chunk.map((e) => ({ from: fromAddress(), to: [e.to], subject: e.subject, html: e.html, text: e.text, headers: e.headers, ...(replyTo ? { reply_to: replyTo } : {}) })),
      )
      const data = json.data as { id: string }[] | undefined
      if (status >= 200 && status < 300 && Array.isArray(data)) chunk.forEach((_, n) => out.push(data[n]?.id ? { ok: true, id: data[n].id } : { ok: false, error: "No id returned" }))
      else chunk.forEach(() => out.push({ ok: false, error: friendly(status, String(json.message ?? "")) }))
    } catch (err) {
      chunk.forEach(() => out.push({ ok: false, error: `Couldn't reach Resend: ${(err as Error).message}` }))
    }
  }
  return out
}
