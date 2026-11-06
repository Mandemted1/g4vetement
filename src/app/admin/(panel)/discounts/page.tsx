import { DiscountsView } from "@/components/discounts/discounts-view"
import { getDiscounts } from "@/lib/discounts"

export const metadata = { title: "Discounts" }

export default async function Page() {
  return <DiscountsView data={await getDiscounts()} />
}
