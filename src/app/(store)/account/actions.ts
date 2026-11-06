"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { storeUrl } from "@/lib/email/send"
import { cleanAddress, type Address } from "@/lib/account-types"
import { isCountry } from "@/lib/countries"
import { sessionClient } from "@/lib/supabase/clients"
import { isLive } from "@/lib/supabase/env"

type Result = { ok: true; confirm?: boolean } | { ok: false; error: string }
const DEMO: Result = { ok: false, error: "Accounts aren't available in demo mode." }
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const friendly = (m: string) => {
  if (/invalid login credentials/i.test(m)) return "Wrong email or password."
  if (/email not confirmed/i.test(m)) return "Please confirm your email first. We sent you a link when you signed up."
  if (/already registered|already been registered/i.test(m)) return "An account with this email already exists. Sign in instead."
  if (/rate limit|too many/i.test(m)) return "Too many attempts. Please wait a few minutes and try again."
  if (/password/i.test(m) && /(weak|short|least)/i.test(m)) return "Choose a stronger password (at least 8 characters)."
  if (/invalid/i.test(m) && /email/i.test(m)) return "That email address doesn't look right."
  return m.replace(/^.*?ERROR:\s*/, "")
}

export async function signUpCustomer(input: { name: string; email: string; password: string }): Promise<Result> {
  if (!isLive) return DEMO
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 80)
  const email = input.email.trim().toLowerCase()
  if (!name) return { ok: false, error: "Enter your name." }
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." }
  if (input.password.length < 8) return { ok: false, error: "Your password needs at least 8 characters." }
  if (input.password.length > 72) return { ok: false, error: "That password is too long (72 characters max)." }
  const { data, error } = await (await sessionClient()).auth.signUp({ email, password: input.password, options: { data: { full_name: name }, emailRedirectTo: `${storeUrl()}/account/callback` } })
  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath("/", "layout")
  // with "Confirm email" on in Supabase there is no session yet: they must click the link we email first
  return data.session ? { ok: true } : { ok: true, confirm: true }
}

/** Emails a reset link. Always says OK, so nobody can use this to find out which emails have accounts. */
export async function requestPasswordReset(emailIn: string): Promise<Result> {
  if (!isLive) return DEMO
  const email = emailIn.trim().toLowerCase()
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." }
  const { error } = await (await sessionClient()).auth.resetPasswordForEmail(email, { redirectTo: `${storeUrl()}/account/callback?next=/account/reset` })
  if (error && /rate limit|too many/i.test(error.message)) return { ok: false, error: friendly(error.message) }
  return { ok: true }
}

/** Sets a new password for the person who opened a reset link (they have a session from it). */
export async function setNewPassword(password: string): Promise<Result> {
  if (!isLive) return DEMO
  if (password.length < 8) return { ok: false, error: "Your password needs at least 8 characters." }
  if (password.length > 72) return { ok: false, error: "That password is too long (72 characters max)." }
  const db = await sessionClient()
  const { data } = await db.auth.getUser()
  if (!data.user) return { ok: false, error: "This link has expired. Request a new one from the sign in page." }
  const { error } = await db.auth.updateUser({ password })
  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function signInCustomer(input: { email: string; password: string }): Promise<Result> {
  if (!isLive) return DEMO
  const { error } = await (await sessionClient()).auth.signInWithPassword({ email: input.email.trim().toLowerCase(), password: input.password })
  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function signOutCustomer() {
  if (isLive) await (await sessionClient()).auth.signOut()
  revalidatePath("/", "layout")
  redirect("/")
}

/** Saves the delivery address that checkout prefills. */
export async function saveAddress(input: Address & { name?: string }): Promise<Result> {
  if (!isLive) return DEMO
  const db = await sessionClient()
  const { data } = await db.auth.getUser()
  if (!data.user) return { ok: false, error: "Please sign in again." }
  const a = cleanAddress(input)
  if (!a) return { ok: false, error: "Enter your address and city." }
  if (a.country && !isCountry(a.country)) return { ok: false, error: "Choose your country." }
  const name = (input.name ?? "").trim().slice(0, 80)
  const { error } = await db.auth.updateUser({ data: { address: a, ...(name ? { full_name: name } : {}) } })
  if (error) return { ok: false, error: friendly(error.message) }
  revalidatePath("/", "layout")
  return { ok: true }
}
