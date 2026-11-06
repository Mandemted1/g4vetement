import Link from "next/link"
import { StopForm } from "./form"
import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

export const metadata = { title: "Stop reminders", robots: { index: false } }

const mask = (e: string) => e.replace(/^(.).*(@.*)$/, "$1•••$2")
const UUID = /^[0-9a-f-]{36}$/i

/** The "Stop reminders" link in the cart reminder email. A plain visit only shows a button, so link scanners can't opt people out by accident. */
export default async function StopPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let email = ""
  if (isLive && UUID.test(token)) {
    const { data } = await serviceClient().from("abandoned_carts").select("email").eq("token", token).maybeSingle()
    email = data?.email ?? ""
  }
  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-[1200px] flex-col justify-center px-5 pb-10 pt-32 md:px-8">
      {email ? (
        <StopForm token={token} email={mask(email)} />
      ) : (
        <div>
          <p className="label text-[var(--mute)]">( Reminders )</p>
          <h1 className="mt-5 text-[clamp(2.6rem,8vw,6.5rem)] font-medium leading-[0.9] tracking-[-0.055em]">Nothing to stop.</h1>
          <p className="mt-6 max-w-[42ch] text-[14px] leading-relaxed text-[var(--mute)]">This link has already been used or has expired, so there are no reminders waiting for this address.</p>
          <Link href="/" className="label mt-10 inline-block border border-[var(--ink)] px-8 py-4 transition-colors duration-500 hover:bg-[var(--ink)] hover:text-[var(--paper)]">Back to G4</Link>
        </div>
      )}
    </div>
  )
}
