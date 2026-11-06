"use client"

import { createContext, useContext, useMemo } from "react"
import { roleCan, type Cap, type Role } from "@/lib/permissions"

interface Ctx {
  role: Role
  email: string
  can: (cap: Cap) => boolean
}
const C = createContext<Ctx | null>(null)

/** Who is using the admin and what their role allows, so screens can hide what they can't do. The database enforces it regardless. */
export function StaffProvider({ role, email, children }: { role: Role; email: string; children: React.ReactNode }) {
  const value = useMemo<Ctx>(() => ({ role, email, can: (cap) => roleCan(role, cap) }), [role, email])
  return <C.Provider value={value}>{children}</C.Provider>
}

export function useStaff() {
  const c = useContext(C)
  if (!c) throw new Error("useStaff outside StaffProvider")
  return c
}
