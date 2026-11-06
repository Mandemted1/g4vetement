"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { track } from "@/lib/track"

/** Records a pageview on every route change. */
export function Tracker() {
  const path = usePathname()
  useEffect(() => {
    track("pageview")
  }, [path])
  return null
}
