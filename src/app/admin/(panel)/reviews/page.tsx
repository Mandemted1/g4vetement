import { ReviewsView } from "@/components/reviews/reviews-view"
import { getAdminReviews } from "@/lib/admin-reviews"

export const metadata = { title: "Reviews" }

export default async function Page() {
  return <ReviewsView data={await getAdminReviews()} />
}
