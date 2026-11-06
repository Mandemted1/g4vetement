import "server-only"
import { anonClient, sessionClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"
import type { Rating, Review, ReviewAccess } from "./review-types"

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Average rating and count for every product with published reviews. Never throws (no reviews table yet = no ratings). */
export async function getReviewSummary(): Promise<Record<string, Rating>> {
  if (!isLive) return {}
  try {
    const { data, error } = await anonClient().rpc("review_summary")
    if (error || !data) return {}
    return Object.fromEntries((data as any[]).map((r) => [r.product_id, { average: Number(r.average), total: Number(r.total) }]))
  } catch {
    return {}
  }
}

/** Published reviews of one product, newest first. (Columns are named: the user id column isn't readable.) */
export async function getProductReviews(productId: string): Promise<Review[]> {
  if (!isLive) return []
  try {
    const { data, error } = await anonClient()
      .from("reviews")
      .select("id, author, rating, title, body, created_at")
      .eq("product_id", productId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(50)
    if (error || !data) return []
    return (data as any[]).map((r) => ({ id: r.id, author: r.author, rating: r.rating, title: r.title, body: r.body, createdAt: r.created_at }))
  } catch {
    return []
  }
}

/** Can this visitor review the product, and what have they written so far? */
export async function getReviewAccess(productId: string): Promise<ReviewAccess> {
  const none = { signedIn: false, canReview: false, mine: null }
  if (!isLive) return none
  try {
    const db = await sessionClient()
    const { data } = await db.auth.getUser()
    if (!data.user) return none
    const [can, mine] = await Promise.all([db.rpc("can_review", { p_product: productId }), db.rpc("my_review", { p_product: productId })])
    const m = (mine.data as any[] | null)?.[0]
    return { signedIn: true, canReview: can.data === true, mine: m ? { rating: m.rating, title: m.title, body: m.body, status: m.status } : null }
  } catch {
    return none
  }
}
