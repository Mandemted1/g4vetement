/** Offline test of provider selection and the Gmail sender (uses nodemailer's JSON transport, nothing is sent). */
process.env.EMAIL_TRANSPORT = "json"

const { provider, emailConfigured, fromAddress, maxPerCampaign, sendEmail, sendBatch } = await import("../src/lib/email/send")

const ok = (name: string, cond: boolean, extra = "") => console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
const set = (env: Record<string, string | undefined>) => {
  for (const k of ["EMAIL_PROVIDER", "GMAIL_USER", "GMAIL_APP_PASSWORD", "EMAIL_FROM", "RESEND_API_KEY"]) delete process.env[k]
  Object.assign(process.env, Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined)))
}

set({ RESEND_API_KEY: "re_x" })
ok("Resend key only -> resend", provider() === "resend" && emailConfigured())

set({ RESEND_API_KEY: "re_x", GMAIL_USER: "shop@gmail.com", GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop" })
ok("Gmail vars + no domain -> gmail", provider() === "smtp" && emailConfigured(), fromAddress())
ok("Gmail campaign cap is 300", maxPerCampaign() === 300)

set({ RESEND_API_KEY: "re_x", GMAIL_USER: "shop@gmail.com", GMAIL_APP_PASSWORD: "x", EMAIL_FROM: "G4 <orders@g4vet.com>" })
ok("verified domain configured -> resend wins", provider() === "resend", fromAddress())

set({ GMAIL_USER: "shop@gmail.com", GMAIL_APP_PASSWORD: "x", EMAIL_PROVIDER: "smtp" })
const one = await sendEmail({ to: "a@b.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi", headers: { "List-Unsubscribe": "<https://x/u>" } })
ok("single send through Gmail transport", one.ok, one.ok ? one.id.slice(0, 14) : one.error)
const many = await sendBatch(Array.from({ length: 25 }, (_, i) => ({ to: `u${i}@b.com`, subject: "S", html: "<p>x</p>", text: "x" })))
ok("batch of 25: every result ok, in order", many.length === 25 && many.every((r) => r.ok))

set({})
const none = await sendEmail({ to: "a@b.com", subject: "Hi", html: "x", text: "x" })
ok("nothing configured -> clear error", !none.ok && /not set/.test((none as { error: string }).error), (none as { error: string }).error)
