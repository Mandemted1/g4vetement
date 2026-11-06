import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

const EVENTS = new Set(["pageview", "product_view", "add_to_cart", "checkout_start", "purchase"])
const ID = /^[a-z0-9]{8,32}$/i
const BOT = /bot|crawl|spider|slurp|headless|preview|facebookexternalhit|monitor|lighthouse|curl|wget|python|node-fetch/i

// tiny per-instance limiter so one client can't flood the table
const hits = new Map<string, { n: number; reset: number }>()
const limited = (key: string) => {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + 60_000 })
    return false
  }
  return ++h.n > 90
}

const SOURCES: [RegExp, string][] = [
  [/google\./, "Google"], [/bing\./, "Bing"], [/duckduckgo\./, "DuckDuckGo"], [/instagram\.|l\.instagram/, "Instagram"], [/facebook\.|fb\.com|l\.facebook/, "Facebook"],
  [/tiktok\./, "TikTok"], [/(^|\.)t\.co$|twitter\.|(^|\.)x\.com$/, "X"], [/pinterest\./, "Pinterest"], [/youtube\.|youtu\.be/, "YouTube"], [/reddit\./, "Reddit"],
]

function sourceOf(referrer: string, utm: string, ownHost: string): string | null {
  if (utm) return utm.slice(0, 30).replace(/^\w/, (c) => c.toUpperCase())
  if (!referrer) return null
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "")
    if (host === ownHost.replace(/^www\./, "")) return null
    return SOURCES.find(([re]) => re.test(host))?.[1] ?? host.slice(0, 40)
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  if (!isLive) return new Response(null, { status: 204 })
  const ua = req.headers.get("user-agent") ?? ""
  if (!ua || BOT.test(ua)) return new Response(null, { status: 204 })

  const raw = await req.text()
  if (raw.length > 2000) return new Response(null, { status: 413 })
  let b: Record<string, unknown>
  try {
    b = JSON.parse(raw)
  } catch {
    return new Response(null, { status: 400 })
  }
  const event = String(b.event ?? "")
  const vid = String(b.vid ?? "")
  const sid = String(b.sid ?? "")
  const path = String(b.path ?? "").slice(0, 200)
  if (!EVENTS.has(event) || !ID.test(vid) || !ID.test(sid) || !path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api")) return new Response(null, { status: 204 })
  if (limited(vid)) return new Response(null, { status: 429 })

  const device = /ipad|tablet/i.test(ua) ? "Tablet" : /mobi|iphone|android/i.test(ua) ? "Mobile" : "Desktop"
  const browser = /edg\//i.test(ua) ? "Edge" : /opr\/|opera/i.test(ua) ? "Opera" : /firefox|fxios/i.test(ua) ? "Firefox" : /chrome|crios/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : "Other"
  const os = /iphone|ipad|ios/i.test(ua) ? "iOS" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "Other"
  const ownHost = req.headers.get("host") ?? ""
  const country = req.headers.get("x-vercel-ip-country")

  try {
    await serviceClient().from("visits").insert({
      visitor_id: vid,
      session_id: sid,
      event,
      path,
      referrer: String(b.referrer ?? "").slice(0, 300) || null,
      source: sourceOf(String(b.referrer ?? ""), String(b.utm ?? ""), ownHost),
      entry: b.entry === true,
      country: country && /^[A-Z]{2}$/.test(country) ? country : null,
      device,
      browser,
      os,
      product_id: typeof b.product_id === "string" ? b.product_id.slice(0, 20) : null,
    })
  } catch {
    /* analytics is best-effort */
  }
  return new Response(null, { status: 204 })
}
