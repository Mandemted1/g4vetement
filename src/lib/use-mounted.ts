"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * False while rendering on the server (and on the very first browser render), true afterwards.
 * Use it for anything that depends on the viewer's time zone, so server and browser agree during hydration.
 */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
