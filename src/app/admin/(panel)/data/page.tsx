import { DataView } from "@/components/data/data-view"
import { requireCap } from "@/lib/auth"
import { isLive } from "@/lib/supabase/env"
import { roleCan } from "@/lib/permissions"

export const metadata = { title: "Import & export" }

export default async function Page() {
  const me = await requireCap("data.export")
  return <DataView live={isLive} canImport={!me || roleCan(me.role, "products.manage")} />
}
