import { redirect } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import { isLive } from "@/lib/supabase/env"

export const metadata = { title: "Sign in" }

export default function LoginPage() {
  // Demo mode has no accounts, so there is nothing to sign in to.
  if (!isLive) redirect("/admin")
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <LoginForm />
    </div>
  )
}
