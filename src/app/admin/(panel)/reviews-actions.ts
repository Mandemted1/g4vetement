"use server"

import { revalidatePath } from "next/cache"
import { adminClient, noAccess } from "@/lib/admin-auth"
import { isLive } from "@/lib/supabase/env"

type Result = { ok: true } | { ok: false; error: string }
const refresh = () => revalidatePath("/", "layout")

/** Hide a review from the store (it stays here) or show it again. */
export async function setReviewStatus(id: string, status: "published" | "hidden"): Promise<Result> {
  if (!isLive) return { ok: false, error: "Demo mode: connect Supabase to manage reviews." }
  const db = await adminClient("reviews.manage")
  if (!db) return { ok: false, error: await noAccess("reviews.manage") }
  if (status !== "published" && status !== "hidden") return { ok: false, error: "Unknown status." }
  const { error } = await db.from("reviews").update({ status }).eq("id", id)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}

export async function deleteReview(id: string): Promise<Result> {
  if (!isLive) return { ok: false, error: "Demo mode: connect Supabase to manage reviews." }
  const db = await adminClient("reviews.manage")
  if (!db) return { ok: false, error: await noAccess("reviews.manage") }
  const { error } = await db.from("reviews").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  refresh()
  return { ok: true }
}
