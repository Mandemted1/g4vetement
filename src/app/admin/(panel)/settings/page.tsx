import { requireCap } from "@/lib/auth"
import { LoginSettingsCard } from "@/components/settings/settings-view"
import { PoliciesCard } from "@/components/settings/policies-card"
import { NotificationsCard } from "@/components/settings/notifications-card"
import { ShippingCard } from "@/components/settings/shipping-card"
import { StoreDetailsCard } from "@/components/settings/store-details-card"
import { getAlertSettings, getLoginSettings, getPolicies, getStoreSettings } from "@/lib/settings"
import { getAdminZones } from "@/lib/shipping-source"

export const metadata = { title: "Settings" }

export default async function Page() {
  await requireCap("settings.manage")
  const [store, policies, login, shipping, alerts] = await Promise.all([getStoreSettings(), getPolicies(), getLoginSettings(), getAdminZones(), getAlertSettings()])
  return (
    <div className="flex flex-col gap-6">
      <div className="rise">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your business details, shipping, store policies, and how the admin looks.</p>
      </div>
      <StoreDetailsCard initial={store} />
      <NotificationsCard initial={alerts} storeEmail={store.email} />
      <ShippingCard zones={shipping.zones} missing={shipping.missing} demo={shipping.demo} />
      <PoliciesCard initial={policies} />
      <LoginSettingsCard initial={login} />
    </div>
  )
}
