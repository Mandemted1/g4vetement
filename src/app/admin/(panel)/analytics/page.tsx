import { requireCap } from "@/lib/auth"
import { AnalyticsView } from "@/components/analytics/analytics-view"
import { getOverview } from "./actions"

export const metadata = { title: "Analytics" }

export default async function Page() {
  await requireCap("analytics.view")
  const r = await getOverview(30)
  return <AnalyticsView initial={r.ok ? r.data : null} initialError={r.ok ? null : r.error} />
}
