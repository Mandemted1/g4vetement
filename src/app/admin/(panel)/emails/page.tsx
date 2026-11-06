import { EmailsView } from "@/components/emails/emails-view"
import { emailConfig, getMessages, getTemplates } from "@/lib/email/admin-data"

export const metadata = { title: "Emails" }

export default async function Page() {
  const [{ items, tablesMissing }, messages] = await Promise.all([getTemplates(), getMessages()])
  return <EmailsView templates={items} messages={messages} config={await emailConfig()} tablesMissing={tablesMissing} />
}
