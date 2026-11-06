import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/store/account/auth-form"
import { BackLink } from "@/components/store/back-link"
import { Rise } from "@/components/store/fx"
import { getAccount } from "@/lib/account"
import { isLive } from "@/lib/supabase/env"

export const metadata: Metadata = { title: "Sign in" }

/** Only paths on this site (never a full URL), so a crafted link can't send someone elsewhere after signing in. */
const safeNext = (n: string | undefined) => (n && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : "/account")

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; confirm?: string }> }) {
  const { next, confirm } = await searchParams
  if (isLive && (await getAccount())) redirect(safeNext(next))

  return (
    <div className="px-5 pb-16 pt-28 md:px-8 md:pt-36">
      <BackLink fallback="/" className="-mt-3 mb-2" />
      <p className="label mb-6 text-[var(--mute)]">( Account )</p>
      <Rise as="h1" text="Sign in" className="text-[clamp(3rem,10vw,9rem)] font-medium leading-[0.85] tracking-[-0.06em]" />
      <div className="mt-14">
        {isLive ? (
          <AuthForm next={safeNext(next)} notice={confirm === "failed" ? "That confirmation link didn't work or has expired. Try signing in, or create the account again." : ""} />
        ) : (
          <p className="max-w-md text-[15px] leading-relaxed text-[var(--mute)]">Accounts aren&apos;t available until the store is connected to its database.</p>
        )}
      </div>
    </div>
  )
}
