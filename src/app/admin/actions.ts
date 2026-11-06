"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { after } from "next/server"
import { sendOrderEmail } from "@/lib/email/service"
import { cloudinaryConfigured, uploadTicket } from "@/lib/cloudinary"
import { adminClient, currentStaff, noAccess } from "@/lib/admin-auth"
import { roleCan } from "@/lib/permissions"
import { nextProductIds, productRow, validateProduct, type ProductInput } from "@/lib/product-input"
import { sessionClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"
import type { OrderStatus } from "@/lib/data"
import type { LoginSettings, Policies, StoreSettings } from "@/lib/settings-types"
import { cleanPolicies, cleanStore } from "@/lib/settings-validate"
import { cleanTracking, type Tracking } from "@/lib/tracking"
import { cleanAlerts, type AlertSettings } from "@/lib/alerts"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const DEMO = { ok: false as const, error: "Demo mode: connect Supabase (see .env.example) to save changes." }

/** Every admin write goes through this: must be live and signed in. */
const admin = adminClient
const refresh = () => revalidatePath("/", "layout")
const msg = (e: { message: string }) => ({ ok: false as const, error: e.message })

export async function signOut() {
  if (isLive) await (await sessionClient()).auth.signOut()
  redirect("/admin/login")
}

/** pending -> processing -> shipped -> delivered, or cancelled / refunded. Cancelling returns stock to the shelf. */
export async function setOrderStatus(orderId: string, next: OrderStatus): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("orders.manage")
  if (!db) return { ok: false, error: await noAccess("orders.manage") }
  const { data: order, error: e1 } = await db.from("orders").select("status, order_items(product_id, size, qty)").eq("id", orderId).single()
  if (e1 || !order) return { ok: false, error: e1?.message ?? "Order not found" }
  if (order.status === "cancelled" || order.status === "refunded") return { ok: false, error: `A ${order.status} order can't be changed.` }

  const { error } = await db.from("orders").update({ status: next, ...(next === "shipped" ? { shipped_at: new Date().toISOString() } : {}) }).eq("id", orderId)
  if (error) return msg(error)

  if (next === "cancelled") {
    // each item goes back into the size it was bought in (atomic in the database)
    for (const it of order.order_items as { product_id: string; size: string; qty: number }[]) {
      await db.rpc("adjust_stock", { p_product: it.product_id, p_size: it.size, p_delta: it.qty })
    }
  }
  // the part paid with a gift card goes back on the card (once)
  if (next === "cancelled" || next === "refunded") await db.rpc("restore_gift_card", { p_order: orderId })
  refresh()
  if (next === "shipped") after(() => sendOrderEmail(orderId, "order_shipped"))
  return { ok: true }
}

/**
 * Marks an open order as shipped, saving its tracking number if there is one, and emails the customer.
 * `tracking` = null ships it without a tracking number.
 */
export async function shipOrder(orderId: string, tracking: TrackingInput | null): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("orders.manage")
  if (!db) return { ok: false, error: await noAccess("orders.manage") }
  let t: Tracking | null = null
  if (tracking) {
    const c = cleanTracking(tracking)
    if (!c.ok) return c
    t = c.value
  }
  const { data: order } = await db.from("orders").select("status").eq("id", orderId).single()
  if (!order) return { ok: false, error: "Order not found" }
  if (order.status !== "pending" && order.status !== "processing") return { ok: false, error: `A ${order.status} order can't be shipped.` }
  const { error } = await db
    .from("orders")
    .update({ status: "shipped", shipped_at: new Date().toISOString(), tracking_carrier: t?.carrier ?? null, tracking_number: t?.number ?? null, tracking_url: t?.url || null })
    .eq("id", orderId)
  if (error) return msg(error)
  refresh()
  after(() => sendOrderEmail(orderId, "order_shipped"))
  return { ok: true }
}

/** Adds or corrects the tracking number on a shipped order. `resend` emails the customer the updated details. */
export async function saveTracking(orderId: string, tracking: TrackingInput, resend: boolean): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("orders.manage")
  if (!db) return { ok: false, error: await noAccess("orders.manage") }
  const c = cleanTracking(tracking)
  if (!c.ok) return c
  const { data: order } = await db.from("orders").select("status").eq("id", orderId).single()
  if (!order) return { ok: false, error: "Order not found" }
  if (order.status !== "shipped" && order.status !== "delivered") return { ok: false, error: "Tracking can be added once the order has shipped." }
  const { error } = await db.from("orders").update({ tracking_carrier: c.value.carrier, tracking_number: c.value.number, tracking_url: c.value.url || null }).eq("id", orderId)
  if (error) return msg(error)
  refresh()
  if (resend) after(() => sendOrderEmail(orderId, "order_shipped"))
  return { ok: true }
}

export type TrackingInput = { carrier: string; number: string; url?: string }

export type { ProductInput } from "@/lib/product-input"

export async function updateProduct(id: string, input: ProductInput): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("products.manage")
  if (!db) return { ok: false, error: await noAccess("products.manage") }
  const bad = validateProduct(input)
  if (bad) return { ok: false, error: bad }
  const { error } = await db.from("products").update(productRow(input)).eq("id", id)
  if (error) return msg(error)
  refresh()
  return { ok: true }
}

export async function createProduct(input: ProductInput): Promise<Result<{ id: string }>> {
  if (!isLive) return DEMO
  const db = await admin("products.manage")
  if (!db) return { ok: false, error: await noAccess("products.manage") }
  const bad = validateProduct(input)
  if (bad) return { ok: false, error: bad }
  const { data: all } = await db.from("products").select("id, sort")
  const [{ id, sku, sort }] = nextProductIds((all ?? []).map((r) => r.id), (all ?? []).map((r) => r.sort ?? 0), [input.category])
  const { error } = await db.from("products").insert({ id, sku, sort, ...productRow(input) })
  if (error) return msg(error)
  refresh()
  return { ok: true, id }
}

/** Uploads one image to the public `products` bucket and returns its URL. */
export async function uploadProductPhoto(form: FormData): Promise<Result<{ url: string }>> {
  if (!isLive) return DEMO
  const db = await admin("products.manage")
  if (!db) return { ok: false, error: await noAccess("products.manage") }
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

/**
 * Lets the signed-in admin upload an image straight from the browser to Cloudinary (no server size limit).
 * `provider: "supabase"` tells the caller Cloudinary isn't configured, so it should use the fallback upload.
 */
export async function getUploadTicket(folder: string): Promise<
  | { ok: true; provider: "cloudinary"; cloudName: string; apiKey: string; signature: string; timestamp: number; folder: string }
  | { ok: true; provider: "supabase" }
  | { ok: false; error: string }
> {
  if (!isLive) return DEMO
  // photos are for products; the login screen image is a setting
  const staff = await currentStaff()
  if (!staff || !(roleCan(staff.role, "products.manage") || roleCan(staff.role, "settings.manage"))) return { ok: false, error: await noAccess("products.manage") }
  if (!cloudinaryConfigured()) return { ok: true, provider: "supabase" }
  return { ok: true, provider: "cloudinary", ...uploadTicket(folder) }
}

/** Saves how the admin login screen looks. Takes effect immediately for the next visitor to /admin/login. */
export async function saveLoginSettings(v: LoginSettings): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("settings.manage")
  if (!db) return { ok: false, error: await noAccess("settings.manage") }
  const image = v.image.trim()
  if (image && !/^https:\/\/\S+$/.test(image)) return { ok: false, error: "The image link must start with https://" }
  if (image.length > 600) return { ok: false, error: "That image link is too long." }
  if (!(v.overlay >= 0 && v.overlay <= 0.9)) return { ok: false, error: "Darkness must be between 0% and 90%." }
  if (v.layout !== "full" && v.layout !== "split") return { ok: false, error: "Pick a layout." }
  const tagline = v.tagline.trim().slice(0, 140)
  const { error } = await db.from("site_settings").upsert({ key: "login", value: { image, overlay: Math.round(v.overlay * 100) / 100, layout: v.layout, tagline }, updated_at: new Date().toISOString() })
  if (error) return msg(error)
  revalidatePath("/admin/login")
  revalidatePath("/admin/settings")
  return { ok: true }
}

export async function saveStoreSettings(v: StoreSettings): Promise<Result<{ saved: StoreSettings }>> {
  if (!isLive) return DEMO
  const db = await admin("settings.manage")
  if (!db) return { ok: false, error: await noAccess("settings.manage") }
  const c = cleanStore(v)
  if (!c.ok) return c
  const { error } = await db.from("site_settings").upsert({ key: "store", value: c.value, updated_at: new Date().toISOString() })
  if (error) return msg(error)
  revalidatePath("/", "layout")
  return { ok: true, saved: c.value }
}

/** Which notifications are on, and where alerts go. */
export async function saveAlertSettings(v: AlertSettings): Promise<Result<{ saved: AlertSettings }>> {
  if (!isLive) return DEMO
  const db = await admin("settings.manage")
  if (!db) return { ok: false, error: await noAccess("settings.manage") }
  const c = cleanAlerts(v)
  if (!c.ok) return c
  const { error } = await db.from("site_settings").upsert({ key: "alerts", value: c.value, updated_at: new Date().toISOString() })
  if (error) return msg(error)
  revalidatePath("/", "layout")
  return { ok: true, saved: c.value }
}

export async function savePolicies(v: Policies): Promise<Result> {
  if (!isLive) return DEMO
  const db = await admin("settings.manage")
  if (!db) return { ok: false, error: await noAccess("settings.manage") }
  const c = cleanPolicies(v)
  if (!c.ok) return c
  const { error } = await db.from("site_settings").upsert({ key: "policies", value: c.value, updated_at: new Date().toISOString() })
  if (error) return msg(error)
  revalidatePath("/", "layout")
  return { ok: true }
}
