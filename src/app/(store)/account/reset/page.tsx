import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ResetForm } from "@/components/store/account/reset-form"
import { Rise } from "@/components/store/fx"
import { getAccount } from "@/lib/account"
import { isLive } from "@/lib/supabase/env"

export const metadata: Metadata = { title: "New password", robots: { index: false } }

export default async function ResetPage() {
  // the reset link signs them in; without that there is nothing to reset
  if (!isLive || !(await getAccount())) redirect("/account/login?reset=failed")
  return (
    <div className="px-5 pb-16 pt-28 md:px-8 md:pt-36">
      <p className="label mb-6 text-[var(--mute)]">( Account )</p>
      <Rise as="h1" text="New password" className="text-[clamp(3rem,10vw,9rem)] font-medium leading-[0.85] tracking-[-0.06em]" />
      <div className="mt-14"><ResetForm /></div>
    </div>
  )
}
