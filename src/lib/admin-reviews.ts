import "server-only"
import { adminClient } from "@/lib/admin-auth"
import { isLive } from "@/lib/supabase/env"

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AdminReview {
  id: string
  productId: string
  productName: string
  author: string
  rating: number
  title: string
  body: string
  status: "published" | "hidden"
  createdAt: string
}
export interface ReviewsData {
  reviews: AdminReview[]
  /** the reviews table isn't there yet (migration not run) */
  missing: boolean
  demo: boolean
}

/** Every review, newest first, for the admin. */
export async function getAdminReviews(): Promise<ReviewsData> {
  if (!isLive) return { reviews: [], missing: false, demo: true }
  const db = await adminClient()
  if (!db) return { reviews: [], missing: false, demo: false }
  const { data, error } = await db
    .from("reviews")
    .select("id, product_id, author, rating, title, body, status, created_at, products(name)")
    .order("created_at", { ascending: false })
    .limit(500)
  if (error) return { reviews: [], missing: true, demo: false }
  return {
    missing: false,
    demo: false,
    reviews: (data as any[]).map((r) => ({
      id: r.id, productId: r.product_id, productName: r.products?.name ?? r.product_id, author: r.author, rating: r.rating,
      title: r.title, body: r.body, status: r.status, createdAt: r.created_at,
    })),
  }
}
