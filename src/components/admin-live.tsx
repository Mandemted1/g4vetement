"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { BellRingIcon, InfoIcon } from "lucide-react"
import { useAdmin } from "@/components/admin-data"
import { browserClient } from "@/lib/supabase/browser"
import { money } from "@/lib/format"

/** Shown while Supabase isn't connected: everything is read-only sample data. */
export function DemoBanner() {
  const { mode } = useAdmin()
  if (mode !== "demo") return null
  return (
    <div className="mx-4 mt-1 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs md:mx-6">
      <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
      <p>
        <b className="font-medium">Demo data.</b> Orders from the store and edits here aren&apos;t saved until Supabase is connected (see <code>.env.example</code>).
      </p>
    </div>
  )
}

/** Listens for new orders and refreshes the admin the moment one arrives. */
export function LiveOrders() {
  const { mode } = useAdmin()
  const router = useRouter()
  const [toast, setToast] = useState<{ id: string; total: number } | null>(null)

  useEffect(() => {
    if (mode !== "live") return
    const db = browserClient()
    const ch = db
      .channel("new-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (p) => {
        const r = p.new as { id: string; total: number }
        setToast({ id: r.id, total: r.total })
        router.refresh()
        window.setTimeout(() => setToast(null), 6000)
      })
      .subscribe()
    return () => {
      db.removeChannel(ch)
    }
  }, [mode, router])

  return (
    <AnimatePresence>
      {toast && (
        <motion.button
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          onClick={() => router.push("/admin/orders")}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm shadow-lg"
        >
          <BellRingIcon className="size-4 text-positive" />
          <span>
            <b className="font-medium">New order {toast.id}</b>
            <br />
            <span className="text-muted-foreground">{money(toast.total)} · tap to view</span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
