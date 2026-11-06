"use client"

import Link from "next/link"
import { AlertTriangleIcon, CheckCircle2Icon, PencilIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { MessageItem, TemplateItem, emailConfig } from "@/lib/email/admin-data"
import { dateLabel, timeLabel } from "@/lib/format"
import { cn } from "@/lib/utils"

const KIND: Record<string, string> = { campaign: "Campaign", order_confirmation: "Order confirmation", order_shipped: "Order shipped", welcome: "Welcome", test: "Test" }

export function EmailsView({ templates, messages, config, tablesMissing }: { templates: TemplateItem[]; messages: MessageItem[]; config: ReturnType<typeof emailConfig>; tablesMissing: boolean }) {
  const issues: string[] = []
  const gmail = config.provider === "smtp"
  if (!config.configured) issues.push(gmail ? "GMAIL_USER and GMAIL_APP_PASSWORD aren't set, so no emails can be sent." : "RESEND_API_KEY isn't set, so no emails can be sent.")
  if (config.testMode) issues.push("You're using Resend's test sender, which only delivers to your own email. Verify a domain at resend.com/domains and set EMAIL_FROM to send to customers.")
  if (gmail) issues.push("Sending through Gmail: fine for order emails, but limited to about 500 recipients a day and 300 per campaign, with no open or click tracking. For newsletters, switch to Resend with a verified domain.")
  if (!config.hasAddress) issues.push("Add STORE_ADDRESS so marketing emails include your mailing address (required by anti-spam law in most countries).")
  if (!gmail && !config.hasWebhook) issues.push("Add RESEND_WEBHOOK_SECRET and the webhook (see below) to track delivered, opened and clicked.")
  if (tablesMissing) issues.push("The email tables aren't installed yet. Run `npm run migrate`, or paste supabase/003_email_analytics.sql into the Supabase SQL editor.")

  return (
    <div className="flex flex-col gap-6">
      <div className="rise">
        <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
        <p className="mt-1 text-sm text-muted-foreground">Edit the emails customers get automatically. Sent from <b className="font-medium text-foreground">{config.from}</b>.</p>
      </div>

      <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {issues.length ? <AlertTriangleIcon className="size-4 text-warning" /> : <CheckCircle2Icon className="size-4 text-positive" />}
            {issues.length ? "Setup notes" : "Email is ready"}
          </CardTitle>
          {issues.length === 0 && <CardDescription>{gmail ? "Gmail is connected." : "Resend is connected and your sending domain is set up."}</CardDescription>}
        </CardHeader>
        {issues.length > 0 && (
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
            {!gmail && <p className="mt-4 text-xs text-muted-foreground">
              Webhook URL to add in Resend: <code className="rounded bg-muted px-1.5 py-0.5">{config.siteUrl}/api/webhooks/resend</code> (events: delivered, opened, clicked, bounced, complained).
            </p>}
          </CardContent>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {templates.map((t, i) => (
          <Card key={t.key} className="rise" style={{ "--i": i + 2 } as React.CSSProperties}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <Badge variant="secondary" className={cn("border-0", t.enabled ? "bg-positive/15 text-[oklch(0.42_0.12_155)] dark:text-positive" : "bg-muted text-muted-foreground")}>{t.enabled ? "On" : "Off"}</Badge>
              </div>
              <CardDescription>{t.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Subject</p>
                <p className="mt-0.5 text-sm">{t.subject}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t.customised ? "Customised" : "Original design"}</span>
                <Button size="sm" render={<Link href={`/admin/emails/${t.key}`} />} nativeButton={false}><PencilIcon /> Edit</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rise" style={{ "--i": 5 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle>Recent emails</CardTitle>
          <CardDescription>Every email sent by the store, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Engagement</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="max-w-48 truncate font-medium">{m.to}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{KIND[m.kind] ?? m.kind}</TableCell>
                  <TableCell title={m.error ?? undefined}>
                    <Badge variant="secondary" className={cn("border-0", m.status === "delivered" ? "bg-positive/15 text-[oklch(0.42_0.12_155)] dark:text-positive" : m.status === "failed" || m.status === "bounced" || m.status === "complained" ? "bg-negative/12 text-negative" : "bg-muted text-muted-foreground")}>{m.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{m.clicked ? "Clicked" : m.opened ? "Opened" : "–"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{dateLabel(m.at)} {timeLabel(m.at)}</TableCell>
                </TableRow>
              ))}
              {messages.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No emails sent yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
