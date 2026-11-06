"use server"

import { revalidatePath } from "next/cache"
import { sessionClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

type Result = { ok: true } | { ok: false; error: string }
const clean = (m: string) => m.replace(/^.*?ERROR:\s*/, "").slice(0, 200)

/** Writes or edits the signed-in customer's review. The database checks they've received the product. */
export async function submitReview(productId: string, rating: number, title: string, body: string): Promise<Result> {
  if (!isLive) return { ok: false, error: "Reviews aren't available in demo mode." }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "Choose a rating from 1 to 5 stars." }
  const { error } = await (await sessionClient()).rpc("submit_review", { p_product: productId, p_rating: rating, p_title: title, p_body: body })
  if (error) return { ok: false, error: clean(error.message) }
  revalidatePath(`/product/${productId}`)
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function deleteMyReview(productId: string): Promise<Result> {
  if (!isLive) return { ok: false, error: "Reviews aren't available in demo mode." }
  const db = await sessionClient()
  if (!(await db.auth.getUser()).data.user) return { ok: false, error: "Please sign in again." }
  // row-level security limits this to the caller's own review
  const { error } = await db.from("reviews").delete().eq("product_id", productId)
  if (error) return { ok: false, error: clean(error.message) }
  revalidatePath(`/product/${productId}`)
  revalidatePath("/", "layout")
  return { ok: true }
}
