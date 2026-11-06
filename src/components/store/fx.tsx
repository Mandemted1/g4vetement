"use client"

import { useEffect, useRef, useState } from "react"
import Lenis from "lenis"
import { AnimatePresence, animate, motion, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from "motion/react"
import { cn } from "@/lib/utils"

const EASE = [0.22, 1, 0.36, 1] as const

/** Fade + rise on scroll into view. */
export function Reveal({ children, delay = 0, y = 28, className }: { children: React.ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.95, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** Headline where each word rises out of a mask. */
export function Rise({ text, className, delay = 0, as: Tag = "h2" }: { text: string; className?: string; delay?: number; as?: "h1" | "h2" | "p" }) {
  const words = text.split(" ")
  return (
    <Tag className={className} aria-label={text}>
      {words.map((w, i) => (
        // The trigger lives on the (unclipped) mask; the word inherits it through variants.
        <motion.span key={i} className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom" aria-hidden initial="hidden" whileInView="show" viewport={{ once: true }}>
          <motion.span
            className="inline-block"
            variants={{ hidden: { y: "110%" }, show: { y: 0, transition: { duration: 1, delay: delay + i * 0.06, ease: EASE } } }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </motion.span>
      ))}
    </Tag>
  )
}

/** Paragraph whose words darken as you scroll through it. */
export function ScrollText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] })
  const words = text.split(" ")
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
          {w}
        </Word>
      ))}
    </p>
  )
}
function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const o = useTransform(progress, range, [0.14, 1])
  return (
    <motion.span style={{ opacity: o }} className="mr-[0.25em] inline-block">
      {children}
    </motion.span>
  )
}

/** Button that leans toward the pointer. */
export function Magnetic({ children, strength = 0.25, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useSpring(useMotionValue(0), { stiffness: 300, damping: 20, mass: 0.4 })
  const y = useSpring(useMotionValue(0), { stiffness: 300, damping: 20, mass: 0.4 })
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x, y }}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect()
        x.set((e.clientX - (r.left + r.width / 2)) * strength)
        y.set((e.clientY - (r.top + r.height / 2)) * strength)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}

/** Inertial page scroll. Anything with data-lenis-prevent keeps native scrolling. */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) })
    let id = 0
    const raf = (t: number) => {
      lenis.raf(t)
      id = requestAnimationFrame(raf)
    }
    id = requestAnimationFrame(raf)
    return () => {
      cancelAnimationFrame(id)
      lenis.destroy()
    }
  }, [])
  return null
}

/** Custom cursor: a dot that becomes a labelled disc over anything with data-cursor="LABEL". */
export function Cursor() {
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const sx = useSpring(x, { stiffness: 520, damping: 42, mass: 0.35 })
  const sy = useSpring(y, { stiffness: 520, damping: 42, mass: 0.35 })
  const [label, setLabel] = useState("")
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOn(true)
    const root = document.querySelector(".store")
    root?.classList.add("has-cursor")
    const move = (e: PointerEvent) => {
      x.set(e.clientX)
      y.set(e.clientY)
    }
    const over = (e: PointerEvent) => {
      const t = (e.target as HTMLElement | null)?.closest?.("[data-cursor]")
      setLabel(t?.getAttribute("data-cursor") ?? "")
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerover", over)
    return () => {
      root?.classList.remove("has-cursor")
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerover", over)
    }
  }, [x, y])

  if (!on) return null
  return (
    <motion.div style={{ x: sx, y: sy }} className="pointer-events-none fixed left-0 top-0 z-[300]">
      <motion.div
        className="-translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-[#0d0d0d] ring-1 ring-[#f3f2ef]"
        animate={{ width: label ? 78 : 9, height: label ? 78 : 9 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
      >
        <AnimatePresence>
          {label && (
            <motion.span key={label} className="label text-[#f3f2ef]" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

type IntroWindow = Window & { __g4Intro?: boolean }
const markIntro = () => {
  ;(window as IntroWindow).__g4Intro = true
  window.dispatchEvent(new Event("g4:intro"))
}
/** True once the preloader has finished (or was skipped). Lets entrance animations wait for the curtain. */
export function useIntroReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if ((window as IntroWindow).__g4Intro) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(true)
      return
    }
    const on = () => setReady(true)
    window.addEventListener("g4:intro", on)
    return () => window.removeEventListener("g4:intro", on)
  }, [])
  return ready
}

/** Intro curtain with a counter. Plays once per session. */
export function Preloader() {
  const [n, setN] = useState(0)
  const [done, setDone] = useState(false)
  useEffect(() => {
    let seen = false
    try {
      seen = sessionStorage.getItem("g4-intro") === "1"
      sessionStorage.setItem("g4-intro", "1")
    } catch {}
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDone(true)
      markIntro()
      return
    }
    const c = animate(0, 100, {
      duration: 1.7,
      ease: [0.7, 0, 0.2, 1],
      onUpdate: (v) => setN(Math.round(v)),
      onComplete: () => {
        setDone(true)
        window.setTimeout(markIntro, 350)
      },
    })
    return () => c.stop()
  }, [])
  return (
    <AnimatePresence>
      {!done && (
        <motion.div className="fixed inset-0 z-[400] flex flex-col justify-between bg-[#0d0d0d] p-5 text-[#f3f2ef] md:p-8" exit={{ y: "-100%" }} transition={{ duration: 0.95, ease: [0.76, 0, 0.24, 1] }}>
          <span className="label">G4 — Clothing</span>
          <div className="flex items-end justify-between">
            <span className="text-[26vw] font-medium leading-[0.74] tracking-[-0.06em] tabular-nums md:text-[16vw]">{String(n).padStart(3, "0")}</span>
            <span className="label pb-2">Loading</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Marquee strip. Content is duplicated so the loop is seamless. */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const row = (
    <>
      {items.map((t, i) => (
        <span key={i} className="flex items-center gap-10 pr-10">
          <span>{t}</span>
          <span aria-hidden className="size-1 rounded-full bg-current" />
        </span>
      ))}
    </>
  )
  return (
    <div className={cn("overflow-hidden whitespace-nowrap", className)}>
      <div className="marquee flex w-max">
        <div className="flex">{row}</div>
        <div className="flex" aria-hidden>{row}</div>
      </div>
    </div>
  )
}
