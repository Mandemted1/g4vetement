"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { after } from "next/server"
import { sendOrderEmail } from "@/lib/email/service"
import { sessionClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"
import type { GarmentType, OrderStatus } from "@/lib/data"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const DEMO = { ok: false as const, error: "Demo mode: connect Supabase (see .env.example) to save changes." }

/** Every admin write goes through this: must be live and signed in. */
async function admin() {
  if (!isLive) return null
  const db = await sessionClient()
  const { data } = await db.auth.getUser()
  return data.user ? db : null
}
const refresh = () => revalidatePath("/", "layout")
const msg = (e: { message: string }) => ({ ok: false as const, error: e.message })

export async function signOut() {
  if (isLive) await (await sessionClient()).auth.signOut()
  redirect("/admin/login")
}

/** pending -> processing -> shipped -> delivered, or cancelled / refunded. Cancelling returns stock to the shelf. */
export async function setOrderStatus(orderId: string, next: OrderStatus): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin()
  if (!db) return { ok: false, error: "Please sign in again." }
  const { data: order, error: e1 } = await db.from("orders").select("status, order_items(product_id, qty)").eq("id", orderId).single()
  if (e1 || !order) return { ok: false, error: e1?.message ?? "Order not found" }
  if (order.status === "cancelled" || order.status === "refunded") return { ok: false, error: `A ${order.status} order can't be changed.` }

  const { error } = await db.from("orders").update({ status: next }).eq("id", orderId)
  if (error) return msg(error)

  if (next === "cancelled") {
    for (const it of order.order_items as { product_id: string; qty: number }[]) {
      const { data: p } = await db.from("products").select("stock").eq("id", it.product_id).single()
      if (p) await db.from("products").update({ stock: p.stock + it.qty }).eq("id", it.product_id)
    }
  }
  refresh()
  if (next === "shipped") after(() => sendOrderEmail(orderId, "order_shipped"))
  return { ok: true }
}

export interface ProductInput {
  name: string
  category: string
  type: GarmentType
  price: number
  stock: number
  reorderLevel: number
  description: string
  fabric: string
  fit: string
  active: boolean
  colors: { name: string; hex: string }[]
  sizes: string[]
  images: string[]
}

function validate(p: ProductInput): string | null {
  if (!p.name.trim()) return "Name is required"
  if (!Number.isInteger(p.price) || p.price < 0) return "Price must be a whole number of dollars"
  if (!Number.isInteger(p.stock) || p.stock < 0) return "Stock must be 0 or more"
  if (!Number.isInteger(p.reorderLevel) || p.reorderLevel < 0) return "Reorder level must be 0 or more"
  if (p.colors.length === 0) return "Add at least one colour"
  if (p.sizes.length === 0) return "Add at least one size"
  return null
}
const row = (p: ProductInput) => ({
  name: p.name.trim(), category: p.category.trim() || "Other", type: p.type, price: p.price, stock: p.stock, reorder_level: p.reorderLevel,
  description: p.description, fabric: p.fabric, fit: p.fit, active: p.active, colors: p.colors, sizes: p.sizes, images: p.images,
})

export async function updateProduct(id: string, input: ProductInput): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin()
  if (!db) return { ok: false, error: "Please sign in again." }
  const bad = validate(input)
  if (bad) return { ok: false, error: bad }
  const { error } = await db.from("products").update(row(input)).eq("id", id)
  if (error) return msg(error)
  refresh()
  return { ok: true }
}

export async function createProduct(input: ProductInput): Promise<Result<{ id: string }>> {
  if (!isLive) return DEMO
  const db = await admin()
  if (!db) return { ok: false, error: "Please sign in again." }
  const bad = validate(input)
  if (bad) return { ok: false, error: bad }
  const { data: all } = await db.from("products").select("id, sort")
  const n = Math.max(0, ...(all ?? []).map((r) => Number(String(r.id).replace(/\D/g, "")) || 0)) + 1
  const id = `p${String(n).padStart(2, "0")}`
  const sort = Math.max(0, ...(all ?? []).map((r) => r.sort ?? 0)) + 1
  const sku = `G4-${input.category.slice(0, 3).toUpperCase()}-${String(n).padStart(3, "0")}`
  const { error } = await db.from("products").insert({ id, sku, sort, ...row(input) })
  if (error) return msg(error)
  refresh()
  return { ok: true, id }
}

/** Uploads one image to the public `products` bucket and returns its URL. */
export async function uploadProductPhoto(form: FormData): Promise<Result<{ url: string }>> {
  if (!isLive) return DEMO
  const db = await admin()
  if (!db) return { ok: false, error: "Please sign in again." }
  const file = form.get("file")
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file chosen" }
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return { ok: false, error: "Use a JPG, PNG, WebP or AVIF image" }
  if (file.size > 6 * 1024 * 1024) return { ok: false, error: "Image is over 6 MB" }
  const ext = file.type.split("/")[1].replace("jpeg", "jpg")
  const path = `${String(form.get("productId") || "new")}/${Date.now()}.${ext}`
  const { error } = await db.storage.from("products").upload(path, file, { contentType: file.type, upsert: false })
  if (error) return msg(error)
  return { ok: true, url: db.storage.from("products").getPublicUrl(path).data.publicUrl }
}
