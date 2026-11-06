import { LoginSettingsCard } from "@/components/settings/settings-view"
import { PoliciesCard } from "@/components/settings/policies-card"
import { StoreDetailsCard } from "@/components/settings/store-details-card"
import { getLoginSettings, getPolicies, getStoreSettings } from "@/lib/settings"

export const metadata = { title: "Settings" }

export default async function Page() {
  const [store, policies, login] = await Promise.all([getStoreSettings(), getPolicies(), getLoginSettings()])
  return (
    <div className="flex flex-col gap-6">
      <div className="rise">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your business details, store policies, and how the admin looks.</p>
      </div>
      <StoreDetailsCard initial={store} />
      <PoliciesCard initial={policies} />
      <LoginSettingsCard initial={login} />
    </div>
  )
}
