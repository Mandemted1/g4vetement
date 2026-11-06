import { requireCap } from "@/lib/auth"
import { DiscountsView } from "@/components/discounts/discounts-view"
import { getDiscounts } from "@/lib/discounts"

export const metadata = { title: "Discounts" }

export default async function Page() {
  await requireCap("marketing.manage")
  return <DiscountsView data={await getDiscounts()} />
}
