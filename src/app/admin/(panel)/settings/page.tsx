import { SettingsView } from "@/components/settings/settings-view"
import { getLoginSettings } from "@/lib/settings"

export const metadata = { title: "Settings" }

export default async function Page() {
  return <SettingsView initial={await getLoginSettings()} />
}
