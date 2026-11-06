import { requireCap } from "@/lib/auth"
import { CartsView } from "@/components/carts/carts-view"
import { getAbandonedCarts } from "@/lib/admin-carts"
import { getAlertSettings } from "@/lib/settings"

export const metadata = { title: "Abandoned carts" }

export default async function Page() {
  await requireCap("marketing.manage")
  const [data, alerts] = await Promise.all([getAbandonedCarts(), getAlertSettings()])
  return <CartsView data={data} remindersOn={alerts.abandonedCart} />
}
