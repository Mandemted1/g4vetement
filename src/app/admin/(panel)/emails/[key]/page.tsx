import { requireCap } from "@/lib/auth"
import { notFound } from "next/navigation"
import { TemplateEditor } from "@/components/emails/template-editor"
import { getTemplates } from "@/lib/email/admin-data"
import { productsLite } from "@/lib/email/service"
import { storeUrl } from "@/lib/email/send"

export const metadata = { title: "Edit email" }

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  await requireCap("marketing.manage")
  const { key } = await params
  const { items } = await getTemplates()
  const item = items.find((t) => t.key === key)
  if (!item) notFound()
  return <TemplateEditor key={key} item={item} products={await productsLite()} storeUrl={storeUrl()} />
}
