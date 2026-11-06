import { requireCap } from "@/lib/auth"
import { ReviewsView } from "@/components/reviews/reviews-view"
import { getAdminReviews } from "@/lib/admin-reviews"

export const metadata = { title: "Reviews" }

export default async function Page() {
  await requireCap("reviews.manage")
  return <ReviewsView data={await getAdminReviews()} />
}
