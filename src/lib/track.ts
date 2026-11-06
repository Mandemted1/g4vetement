"use client"

/** Cookie-free, anonymous visit tracking. IDs live in this browser only and are never tied to a person. */
export type TrackEvent = "pageview" | "product_view" | "add_to_cart" | "checkout_start" | "purchase"

const rid = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4)

function ids() {
  let vid = ""
  let sid = ""
  let entry = false
  try {
    vid = localStorage.getItem("g4-vid") ?? ""
    if (!vid) localStorage.setItem("g4-vid", (vid = rid()))
    sid = sessionStorage.getItem("g4-sid") ?? ""
    if (!sid) {
      sessionStorage.setItem("g4-sid", (sid = rid()))
      entry = true
    }
  } catch {
    vid = vid || rid()
    sid = sid || rid()
  }
  return { vid, sid, entry }
}

export function track(event: TrackEvent, extra: { product_id?: string } = {}) {
  if (typeof window === "undefined") return
  try {
    if (navigator.doNotTrack === "1") return
    const { vid, sid, entry } = ids()
    const params = new URLSearchParams(location.search)
    const body = JSON.stringify({
      event,
      vid,
      sid,
      path: location.pathname,
      referrer: event === "pageview" && entry ? document.referrer : "",
      utm: event === "pageview" && entry ? params.get("utm_source") ?? "" : "",
      entry: event === "pageview" && entry,
      product_id: extra.product_id,
    })
    if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
      fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {})
    }
  } catch {
    /* tracking must never break the store */
  }
}
