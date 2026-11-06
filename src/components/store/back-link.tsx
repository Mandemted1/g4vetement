"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

/**
 * "← Back". Returns to wherever the visitor came from (keeps scroll + filters on the shop page);
 * if they landed here directly (shared link, new tab) it goes to `fallback` instead of leaving the site.
 */
export function BackLink({ fallback = "/shop", label = "Back", className = "" }: { fallback?: string; label?: string; className?: string }) {
  const router = useRouter()
  return (
    <Link
      href={fallback}
      data-cursor="BACK"
      onClick={(e) => {
        let internal = false
        try {
          internal = !!document.referrer && new URL(document.referrer).origin === location.origin
        } catch {}
        if (internal && history.length > 1) {
          e.preventDefault()
          router.back()
        }
      }}
      className={`label group inline-flex min-h-11 items-center gap-2 pr-4 ${className}`}
    >
      <span aria-hidden className="inline-block transition-transform duration-300 group-hover:-translate-x-1">←</span>
      <span className="u">{label}</span>
    </Link>
  )
}
