import { AnalyticsView } from "@/components/analytics/analytics-view"
import { getOverview } from "./actions"

export const metadata = { title: "Analytics" }

export default async function Page() {
  const r = await getOverview(30)
  return <AnalyticsView initial={r.ok ? r.data : null} initialError={r.ok ? null : r.error} />
}
