"use client"

import { createContext, useContext, useMemo } from "react"
import type { AdminData, Customer, Product } from "@/lib/data"

interface Ctx extends AdminData {
  customerById: Map<string, Customer>
  productById: Map<string, Product>
}
const C = createContext<Ctx | null>(null)

export function AdminDataProvider({ data, children }: { data: AdminData; children: React.ReactNode }) {
  const value = useMemo<Ctx>(
    () => ({ ...data, customerById: new Map(data.customers.map((c) => [c.id, c])), productById: new Map(data.products.map((p) => [p.id, p])) }),
    [data],
  )
  return <C.Provider value={value}>{children}</C.Provider>
}

export function useAdmin() {
  const c = useContext(C)
  if (!c) throw new Error("useAdmin outside AdminDataProvider")
  return c
}
