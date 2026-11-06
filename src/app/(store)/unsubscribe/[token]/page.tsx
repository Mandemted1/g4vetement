import Link from "next/link"
import { UnsubscribeForm } from "./form"
import { serviceClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

export const metadata = { title: "Unsubscribe", robots: { index: false } }

const mask = (e: string) => e.replace(/^(.).*(@.*)$/, "$1•••$2")

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let email = ""
  let status = ""
  if (isLive && /^[0-9a-f-]{36}$/i.test(token)) {
    const { data } = await serviceClient().from("subscribers").select("email, status").eq("token", token).maybeSingle()
    email = data?.email ?? ""
    status = data?.status ?? ""
  }

  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-[1200px] flex-col justify-center px-5 pb-10 pt-32 md:px-8">
      {email ? (
        <UnsubscribeForm token={token} email={mask(email)} initiallyOut={status === "unsubscribed"} />
      ) : (
        <div>
          <p className="label text-[var(--mute)]">( Unsubscribe )</p>
          <h1 className="mt-5 text-[clamp(2.6rem,8vw,6.5rem)] font-medium leading-[0.9] tracking-[-0.055em]">This link<br />isn&apos;t valid.</h1>
          <p className="mt-6 max-w-[40ch] text-[14px] leading-relaxed text-[var(--mute)]">It may have expired or been copied incorrectly. Use the unsubscribe link in your latest email, or reply to it and we&apos;ll remove you.</p>
          <Link href="/" className="label mt-10 inline-block border border-[var(--ink)] px-8 py-4 transition-colors duration-500 hover:bg-[var(--ink)] hover:text-[var(--paper)]">Back to G4</Link>
        </div>
      )}
    </div>
  )
}
