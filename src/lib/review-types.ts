/** Reviews, as shown on the storefront. */
export interface Review {
  id: string
  /** display name only, like "Alex M." */
  author: string
  rating: number
  title: string
  body: string
  createdAt: string
}

export interface Rating {
  average: number
  total: number
}

/** What the signed-in visitor can do on a product page. */
export interface ReviewAccess {
  signedIn: boolean
  /** they've received this product, so they may review it */
  canReview: boolean
  /** their existing review (if any), so the form can edit it */
  mine: { rating: number; title: string; body: string; status: string } | null
}

export const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"]
