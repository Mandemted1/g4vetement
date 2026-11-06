import "server-only"
import nodemailer, { type Transporter } from "nodemailer"

/**
 * Two ways to send, chosen by environment variables:
 *   - "smtp"   : Gmail with an App Password (no domain needed; for low volume, ~500 recipients/day)
 *   - "resend" : Resend with a verified domain (recommended for real volume and newsletters)
 * Set EMAIL_PROVIDER to force one. Otherwise Gmail is used when GMAIL_USER + GMAIL_APP_PASSWORD are set
 * and no EMAIL_FROM (verified Resend domain) is configured.
 */
export type Provider = "smtp" | "resend"

const gmailReady = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)

export function provider(): Provider {
  const forced = process.env.EMAIL_PROVIDER
  if (forced === "smtp" || forced === "resend") return forced
  return gmailReady() && !process.env.EMAIL_FROM ? "smtp" : "resend"
}

export const emailConfigured = () => (provider() === "smtp" ? gmailReady() : Boolean(process.env.RESEND_API_KEY))
export const storeUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100").replace(/\/$/, "")
export const storeAddress = () => process.env.STORE_ADDRESS ?? ""

/** Most recipients we'll send in one campaign (Gmail's daily allowance is ~500 and serverless time is limited). */
export const maxPerCampaign = () => (provider() === "smtp" ? 300 : Number.POSITIVE_INFINITY)

/** Resend's shared test sender only delivers to the account owner until a domain is verified. */
export function fromAddress() {
  if (provider() === "smtp") return `${process.env.EMAIL_FROM_NAME || "G4"} <${process.env.GMAIL_USER}>`
  return process.env.EMAIL_FROM || "G4 <onboarding@resend.dev>"
}

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}
export type SendResult = { ok: true; id: string } | { ok: false; error: string }

/* ---------------- Gmail / SMTP ---------------- */

let transport: Transporter | null = null
function smtp() {
  if (transport) return transport
  // EMAIL_TRANSPORT=json builds messages without sending (used by tests)
  transport =
    process.env.EMAIL_TRANSPORT === "json"
      ? nodemailer.createTransport({ jsonTransport: true })
      : nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") } })
  return transport
}

function smtpFriendly(err: unknown): string {
  const e = err as { responseCode?: number; code?: string; message?: string }
  const m = (e.message ?? "").toLowerCase()
  if (e.responseCode === 535 || m.includes("invalid login") || m.includes("username and password not accepted"))
    return "Gmail rejected the login. Check GMAIL_USER, and that GMAIL_APP_PASSWORD is a 16-character App Password (2-Step Verification must be on)."
  if (e.responseCode === 550 && m.includes("5.4.5")) return "Gmail's daily sending limit was reached (about 500 recipients a day). Try again tomorrow, or switch to Resend with a verified domain."
  if (e.code === "ECONNECTION" || e.code === "ETIMEDOUT" || e.code === "ESOCKET") return "Couldn't reach Gmail's mail server. Try again in a moment."
  return e.message || "Gmail couldn't send this email."
}

async function smtpSend(e: OutgoingEmail): Promise<SendResult> {
  try {
    const info = await smtp().sendMail({
      from: fromAddress(),
      to: e.to,
      subject: e.subject,
      html: e.html,
      text: e.text,
      headers: e.headers,
      ...(process.env.EMAIL_REPLY_TO ? { replyTo: process.env.EMAIL_REPLY_TO } : {}),
    })
    return { ok: true, id: String(info.messageId ?? "smtp") }
  } catch (err) {
    return { ok: false, error: smtpFriendly(err) }
  }
}

/* ---------------- Resend ---------------- */

const API = "https://api.resend.com"

function resendFriendly(status: number, message: string): string {
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

const resendBody = (e: OutgoingEmail, replyTo?: string) => ({ from: fromAddress(), to: [e.to], subject: e.subject, html: e.html, text: e.text, headers: e.headers, ...(replyTo ? { reply_to: replyTo } : {}) })

async function resendSend(e: OutgoingEmail, replyTo?: string): Promise<SendResult> {
  try {
    const { status, json } = await call("/emails", resendBody(e, replyTo))
    if (status >= 200 && status < 300 && typeof json.id === "string") return { ok: true, id: json.id }
    return { ok: false, error: resendFriendly(status, String(json.message ?? "")) }
  } catch (err) {
    return { ok: false, error: `Couldn't reach Resend: ${(err as Error).message}` }
  }
}

/** Up to 100 emails per request. */
async function resendBatch(list: OutgoingEmail[], replyTo?: string): Promise<SendResult[]> {
  const out: SendResult[] = []
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100)
    try {
      const { status, json } = await call("/emails/batch", chunk.map((e) => resendBody(e, replyTo)))
      const data = json.data as { id: string }[] | undefined
      if (status >= 200 && status < 300 && Array.isArray(data)) chunk.forEach((_, n) => out.push(data[n]?.id ? { ok: true, id: data[n].id } : { ok: false, error: "No id returned" }))
      else chunk.forEach(() => out.push({ ok: false, error: resendFriendly(status, String(json.message ?? "")) }))
    } catch (err) {
      chunk.forEach(() => out.push({ ok: false, error: `Couldn't reach Resend: ${(err as Error).message}` }))
    }
  }
  return out
}

/* ---------------- public API ---------------- */

const NOT_CONFIGURED = () => (provider() === "smtp" ? "GMAIL_USER and GMAIL_APP_PASSWORD are not set." : "RESEND_API_KEY is not set.")

export async function sendEmail(e: OutgoingEmail, replyTo = process.env.EMAIL_REPLY_TO): Promise<SendResult> {
  if (!emailConfigured()) return { ok: false, error: NOT_CONFIGURED() }
  return provider() === "smtp" ? smtpSend(e) : resendSend(e, replyTo)
}

/** One result per input, in order. Gmail sends a few at a time; Resend uses its batch endpoint. */
export async function sendBatch(list: OutgoingEmail[], replyTo = process.env.EMAIL_REPLY_TO): Promise<SendResult[]> {
  if (!emailConfigured()) return list.map(() => ({ ok: false as const, error: NOT_CONFIGURED() }))
  if (provider() === "resend") return resendBatch(list, replyTo)
  const out: SendResult[] = new Array(list.length)
  const lanes = 6
  let next = 0
  await Promise.all(
    Array.from({ length: lanes }, async () => {
      while (next < list.length) {
        const i = next++
        out[i] = await smtpSend(list[i])
      }
    }),
  )
  return out
}
