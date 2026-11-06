"use client"

import { motion } from "motion/react"
import { LoginForm } from "@/components/login-form"
import { SmartImage } from "@/components/smart-image"
import type { LoginSettings } from "@/lib/settings-types"
import { cn } from "@/lib/utils"

/**
 * The admin sign-in screen. `contained` renders it inside a box (used for the live preview in Settings)
 * instead of covering the whole window.
 */
export function LoginScreen({ settings, contained = false }: { settings: LoginSettings; contained?: boolean }) {
  const { image, overlay, layout, tagline } = settings
  const frame = contained ? "absolute inset-0" : "fixed inset-0"
  const sizes = contained ? "480px" : "100vw"
  const shade = { background: `linear-gradient(to bottom, rgba(0,0,0,${overlay * 0.7}), rgba(0,0,0,${Math.min(0.95, overlay + 0.25)}))` }

  const photo = (cls = "", sz = sizes) =>
    image ? (
      <motion.div className={cn("absolute inset-0", cls)} initial={{ scale: 1.12, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}>
        <SmartImage src={image} alt="" fill priority ar={false} sizes={sz} className="object-cover object-[50%_38%] md:object-[50%_62%]" />
      </motion.div>
    ) : null

  const full = (cls = "") => (
    <div className={cn(frame, "overflow-hidden bg-[#0b0b0b]", cls)}>
      {photo()}
      <div className="absolute inset-0" style={shade} />
      <span className="absolute left-6 top-6 text-3xl font-semibold leading-none tracking-[-0.07em] text-white md:left-10 md:top-9">G4</span>
      <div className="relative flex h-full items-end justify-center p-4 pb-8 md:items-center md:pb-4">
        <motion.div
          className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/35 p-7 shadow-2xl backdrop-blur-xl"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <LoginForm tone="dark" tagline={tagline} />
        </motion.div>
      </div>
    </div>
  )

  if (layout === "split") {
    return (
      <>
        {full("md:hidden")}
        <div className={cn(frame, "hidden overflow-hidden md:grid md:grid-cols-[1.15fr_1fr]")}>
          <div className="relative overflow-hidden bg-[#0b0b0b]">
            {photo("", contained ? sizes : "(min-width: 768px) 55vw, 100vw")}
            <div className="absolute inset-0" style={shade} />
            <span className="absolute bottom-8 left-10 text-[clamp(5rem,14vw,11rem)] font-semibold leading-[0.74] tracking-[-0.07em] text-white">G4</span>
          </div>
          <div className="flex items-center justify-center bg-background p-8">
            <motion.div className="w-full max-w-sm" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}>
              <LoginForm tagline={tagline} />
            </motion.div>
          </div>
        </div>
      </>
    )
  }
  return full()
}
