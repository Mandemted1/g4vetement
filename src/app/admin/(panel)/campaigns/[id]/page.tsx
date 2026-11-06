import { requireCap } from "@/lib/auth"
import { notFound } from "next/navigation"
import { CampaignEditor } from "@/components/emails/campaign-editor"
import { blankCampaign, getCampaign } from "@/lib/email/admin-data"
import { storeUrl } from "@/lib/email/send"
import { audienceCounts, productsLite } from "@/lib/email/service"
import { isLive } from "@/lib/supabase/env"

export const metadata = { title: "Campaign" }
export const maxDuration = 60 // sending to a large list can take a while

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireCap("marketing.manage")
  const { id } = await params
  const item = id === "new" ? blankCampaign() : await getCampaign(id)
  if (!item) notFound()
  const counts = isLive ? await audienceCounts().catch(() => ({ subscribers: 0, buyers: 0, non_buyers: 0, vip: 0 })) : { subscribers: 0, buyers: 0, non_buyers: 0, vip: 0 }
  return <CampaignEditor key={item.id} item={item} products={await productsLite()} storeUrl={storeUrl()} counts={counts} />
}
