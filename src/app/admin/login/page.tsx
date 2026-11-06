import { redirect } from "next/navigation"
import { LoginScreen } from "@/components/login-screen"
import { getLoginSettings } from "@/lib/settings"
import { isLive } from "@/lib/supabase/env"

export const metadata = { title: "Sign in" }
export const dynamic = "force-dynamic" // the look is editable in the admin, so never serve a stale copy

export default async function LoginPage() {
  if (!isLive) {
    // Locally, demo mode has no accounts, so skip the login. On a live site, explain what's missing instead.
    if (process.env.VERCEL_ENV !== "production") redirect("/admin")
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
        <div className="max-w-sm rounded-xl border bg-card p-6 text-sm">
          <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold tracking-tight text-primary-foreground">G4</div>
          <h1 className="text-lg font-semibold tracking-tight">Admin isn&apos;t connected yet</h1>
          <p className="mt-2 text-muted-foreground">Add the Supabase environment variables in Vercel (Settings, Environment Variables) and redeploy. Then this page becomes the admin login.</p>
        </div>
      </div>
    )
  }
  return <LoginScreen settings={await getLoginSettings()} />
}
