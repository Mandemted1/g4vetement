"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { deleteCampaign } from "@/app/admin/(panel)/email-actions"
import type { CampaignItem } from "@/lib/email/admin-data"
import { dateLabel, int } from "@/lib/format"
import { cn } from "@/lib/utils"

const STATUS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/12 text-blue-700 dark:text-blue-300",
  sending: "bg-warning/15 text-[oklch(0.5_0.12_70)] dark:text-warning",
  sent: "bg-positive/15 text-[oklch(0.42_0.12_155)] dark:text-positive",
  failed: "bg-negative/12 text-negative",
}
const rate = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–")

export function CampaignsView({ items, tablesMissing }: { items: CampaignItem[]; tablesMissing: boolean }) {
  const router = useRouter()
  const [, start] = useTransition()
  const remove = (c: CampaignItem) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return
    start(async () => {
      await deleteCampaign(c.id)
      router.refresh()
    })
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="rise flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">Newsletters and promotions sent to your subscribers.</p>
        </div>
        <Button render={<Link href="/admin/campaigns/new" />} nativeButton={false}><PlusIcon /> New campaign</Button>
      </div>
      {tablesMissing && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">The campaign tables aren&apos;t installed yet. Run <code>npm run migrate</code> (or paste supabase/003_email_analytics.sql into the Supabase SQL editor).</p>}
      <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Sent</TableHead>
                <TableHead className="hidden text-right md:table-cell">Opened</TableHead>
                <TableHead className="hidden text-right md:table-cell">Clicked</TableHead>
                <TableHead className="text-right">Date</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/admin/campaigns/${c.id}`)}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="max-w-64 truncate text-xs text-muted-foreground">{c.subject}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className={cn("border-0 capitalize", STATUS[c.status])}>{c.status}</Badge></TableCell>
                  <TableCell className="hidden text-right tabular sm:table-cell">{c.status === "sent" ? int(c.recipients) : "–"}</TableCell>
                  <TableCell className="hidden text-right tabular md:table-cell">{c.status === "sent" ? rate(c.stats.opened, c.stats.sent) : "–"}</TableCell>
                  <TableCell className="hidden text-right tabular md:table-cell">{c.status === "sent" ? rate(c.stats.clicked, c.stats.sent) : "–"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{dateLabel(c.sentAt ?? c.scheduledAt ?? new Date().toISOString())}</TableCell>
                  <TableCell>
                    {c.status !== "sending" && (
                      <button aria-label="Delete campaign" onClick={(e) => { e.stopPropagation(); remove(c) }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-negative"><Trash2Icon className="size-4" /></button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No campaigns yet. Create your first newsletter.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
