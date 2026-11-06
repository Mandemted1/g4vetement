import { requireCap } from "@/lib/auth"
import { CampaignsView } from "@/components/emails/campaigns-view"
import { getCampaigns } from "@/lib/email/admin-data"

export const metadata = { title: "Campaigns" }

export default async function Page() {
  await requireCap("marketing.manage")
  const { items, tablesMissing } = await getCampaigns()
  return <CampaignsView items={items} tablesMissing={tablesMissing} />
}
