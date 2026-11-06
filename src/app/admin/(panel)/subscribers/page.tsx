import { requireCap } from "@/lib/auth"
import { SubscribersView } from "@/components/subscribers/subscribers-view"

export const metadata = { title: "Subscribers" }

export default async function Page() {
  await requireCap("marketing.manage")
  return <SubscribersView />
}
