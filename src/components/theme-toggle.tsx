"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle("dark")
    try {
      localStorage.setItem("g4-theme", dark ? "dark" : "light")
    } catch {}
  }
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="relative">
      <SunIcon className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <MoonIcon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
