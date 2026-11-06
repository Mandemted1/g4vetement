"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AdminCart } from "@/lib/email/abandoned"
import type { CartsData } from "@/lib/admin-carts"
import { money } from "@/lib/format"
import { useMounted } from "@/lib/use-mounted"
import { cn } from "@/lib/utils"

type State = "recovered" | "reminded" | "waiting"
const stateOf = (c: AdminCart): State => (c.recoveredAt ? "recovered" : c.reminderSentAt ? "reminded" : "waiting")
const PILL: Record<State, { label: string; cls: string }> = {
  recovered: { label: "Ordered", cls: "bg-positive/15 text-[oklch(0.42_0.12_155)] dark:text-positive" },
  reminded: { label: "Reminded", cls: "bg-blue-500/12 text-blue-700 dark:text-blue-300" },
  waiting: { label: "Waiting", cls: "bg-muted text-muted-foreground" },
}

export function CartsView({ data, remindersOn }: { data: CartsData; remindersOn: boolean }) {
  const mounted = useMounted()
  const [tab, setTab] = useState<"all" | State>("all")
  const withState = useMemo(() => data.carts.map((c) => ({ c, s: stateOf(c) })), [data.carts])
  const count = (s: State) => withState.filter((x) => x.s === s).length
  const waitingValue = withState.filter((x) => x.s !== "recovered").reduce((n, x) => n + x.c.subtotal, 0)
  const recoveredValue = withState.filter((x) => x.s === "recovered").reduce((n, x) => n + x.c.subtotal, 0)
  const rows = withState.filter((x) => tab === "all" || x.s === tab)

  return (
    <div className="flex flex-col gap-5">
      <div className="rise">
        <h1 className="text-2xl font-semibold tracking-tight">Abandoned carts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bags left behind by shoppers who typed their email at checkout. Each gets one reminder; once they order, the bag shows as Ordered.</p>
      </div>

      {data.demo && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Demo mode: connect Supabase to collect abandoned carts.</p>}
      {data.missing && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Abandoned carts aren&apos;t installed yet. Run <code>npm run migrate</code> first.</p>}
      {!data.demo && !data.missing && !remindersOn && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Reminders are <b className="font-medium">off</b>, so no new bags are being saved and nothing is being sent. Turn them on in <Link href="/admin/settings" className="underline underline-offset-2">Settings &gt; Notifications</Link>.
        </p>
      )}

      <div className="rise grid grid-cols-2 gap-3 lg:grid-cols-4" style={{ "--i": 1 } as React.CSSProperties}>
        {[
          { label: "Waiting or reminded", value: String(count("waiting") + count("reminded")), sub: `${money(waitingValue)} in bags` },
          { label: "Reminders sent", value: String(count("reminded") + data.carts.filter((c) => c.recoveredAt && c.reminderSentAt).length), sub: "one per shopper" },
          { label: "Came back and ordered", value: String(count("recovered")), sub: `${money(recoveredValue)} in bags` },
          { label: "Opted out", value: String(data.optOuts), sub: "never reminded again" },
        ].map((t) => (
          <Card key={t.label}>
            <CardContent>
              <div className="text-xs text-muted-foreground">{t.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular">{t.value}</div>
              <div className="text-xs text-muted-foreground">{t.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rise" style={{ "--i": 2 } as React.CSSProperties}>
        <CardContent className="flex flex-col gap-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">All <span className="ml-1 text-xs text-muted-foreground tabular">{data.carts.length}</span></TabsTrigger>
              <TabsTrigger value="waiting">Waiting <span className="ml-1 text-xs text-muted-foreground tabular">{count("waiting")}</span></TabsTrigger>
              <TabsTrigger value="reminded">Reminded <span className="ml-1 text-xs text-muted-foreground tabular">{count("reminded")}</span></TabsTrigger>
              <TabsTrigger value="recovered">Ordered <span className="ml-1 text-xs text-muted-foreground tabular">{count("recovered")}</span></TabsTrigger>
            </TabsList>
          </Tabs>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shopper</TableHead>
                <TableHead>In the bag</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ c, s }) => (
                <TableRow key={c.id}>
                  <TableCell className="max-w-48 truncate font-medium">{c.email}</TableCell>
                  <TableCell className="max-w-72 text-muted-foreground">
                    <span className="line-clamp-2">{c.items.map((i) => `${i.qty}× ${i.name} (${i.color}, ${i.size})`).join(", ")}</span>
                  </TableCell>
                  <TableCell className="text-right tabular">{money(c.subtotal)}</TableCell>
                  <TableCell><Badge variant="secondary" className={cn("border-0", PILL[s].cls)}>{PILL[s].label}</Badge></TableCell>
                  <TableCell className="hidden text-right text-muted-foreground sm:table-cell">{mounted ? new Date(c.updatedAt).toLocaleString() : ""}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-14 text-center text-muted-foreground">{data.carts.length === 0 ? "Nothing yet. Bags appear here when a shopper types their email at checkout and leaves." : "No bags in this view."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
