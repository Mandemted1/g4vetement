"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangleIcon, PlusIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { setCodeActive, setSaleActive } from "@/app/admin/(panel)/discount-actions"
import { CodeEditor } from "@/components/discounts/code-editor"
import { SaleEditor } from "@/components/discounts/sale-editor"
import { codeStatus, describeCode, describeSale, saleStatus, type DiscountCode, type Sale, type Status } from "@/lib/discount-types"
import type { DiscountsData } from "@/lib/discounts"
import { int, money } from "@/lib/format"
import { useMounted } from "@/lib/use-mounted"
import { cn } from "@/lib/utils"

const STATUS: Record<Status, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-positive/15 text-[oklch(0.42_0.12_155)] dark:text-positive" },
  scheduled: { label: "Scheduled", cls: "bg-blue-500/12 text-blue-700 dark:text-blue-300" },
  expired: { label: "Expired", cls: "bg-muted text-muted-foreground" },
  disabled: { label: "Off", cls: "bg-muted text-muted-foreground" },
  used_up: { label: "Used up", cls: "bg-warning/15 text-[oklch(0.5_0.12_70)] dark:text-warning" },
}
const Pill = ({ s }: { s: Status }) => <Badge variant="secondary" className={cn("border-0", STATUS[s].cls)}>{STATUS[s].label}</Badge>

export function DiscountsView({ data }: { data: DiscountsData }) {
  const router = useRouter()
  // dates are shown in the viewer's own time zone, so they're drawn only once the page is in the browser
  const mounted = useMounted()
  const [tab, setTab] = useState<"codes" | "sales">("codes")
  const [editCode, setEditCode] = useState<DiscountCode | null>(null)
  const [newCode, setNewCode] = useState(false)
  const [editSale, setEditSale] = useState<Sale | null>(null)
  const [newSale, setNewSale] = useState(false)
  const [error, setError] = useState("")
  const [pending, start] = useTransition()

  const toggle = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("")
      const r = await fn()
      if (!r.ok) return setError(r.error ?? "Something went wrong.")
      router.refresh()
    })

  const welcome = data.codes.find((c) => c.code === "WELCOME10")
  const welcomeLive = welcome ? codeStatus(welcome, data.stats[welcome.code]?.realUses ?? 0) === "active" : false

  return (
    <div className="flex flex-col gap-5">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Discounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">Codes shoppers type at checkout, and sales that lower prices automatically.</p>
        </div>
        {tab === "codes" ? (
          <Button onClick={() => setNewCode(true)}><PlusIcon /> New code</Button>
        ) : (
          <Button onClick={() => setNewSale(true)}><PlusIcon /> New sale</Button>
        )}
      </div>

      {data.demo && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Demo mode: connect Supabase to create discounts.</p>}
      {data.tablesMissing && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Discounts aren&apos;t installed yet. Run <code>npm run migrate</code> first.</p>}
      {error && <p className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p>}
      {!data.demo && !data.tablesMissing && !welcomeLive && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            <b className="font-medium">The welcome offer is paused.</b> The popup for new visitors and the welcome email both use the code <b className="font-medium">WELCOME10</b>
            {welcome ? ", which is currently off, expired or used up." : ", which doesn't exist. Create a code with exactly that name to bring the offer back."}
          </p>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as "codes" | "sales")} className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <TabsList>
          <TabsTrigger value="codes">Codes <span className="ml-1 text-xs text-muted-foreground tabular">{data.codes.length}</span></TabsTrigger>
          <TabsTrigger value="sales">Sales <span className="ml-1 text-xs text-muted-foreground tabular">{data.sales.length}</span></TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "codes" ? (
        <Card className="rise" style={{ "--i": 2 } as React.CSSProperties}>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead className="hidden md:table-cell">What it does</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Used</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Sales with it</TableHead>
                  <TableHead className="w-16 text-right">On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.codes.map((c) => {
                  const st = data.stats[c.code]
                  const status = codeStatus(c, st?.realUses ?? 0)
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setEditCode(c)}>
                      <TableCell>
                        <div className="font-mono text-sm font-medium">{c.code}</div>
                        {c.note && <div className="max-w-48 truncate text-xs text-muted-foreground">{c.note}</div>}
                      </TableCell>
                      <TableCell className="hidden max-w-sm text-muted-foreground md:table-cell">{describeCode(c, { dates: mounted })}</TableCell>
                      <TableCell><Pill s={status} /></TableCell>
                      <TableCell className="hidden text-right tabular sm:table-cell">
                        {int(st?.uses ?? 0)}{c.usageLimit ? <span className="text-muted-foreground"> / {c.usageLimit}</span> : ""}
                      </TableCell>
                      <TableCell className="hidden text-right tabular lg:table-cell">{money(st?.revenue ?? 0)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`${c.code} on or off`} checked={c.active} disabled={pending} onChange={(e) => toggle(() => setCodeActive(c.id, e.target.checked))} className="size-4" />
                      </TableCell>
                    </TableRow>
                  )
                })}
                {data.codes.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-14 text-center text-muted-foreground">No codes yet. Create one to run a promotion.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="rise" style={{ "--i": 2 } as React.CSSProperties}>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale</TableHead>
                  <TableHead className="hidden md:table-cell">Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16 text-right">On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sales.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setEditSale(s)}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="hidden max-w-md text-muted-foreground md:table-cell">{describeSale(s, { dates: mounted })}</TableCell>
                    <TableCell><Pill s={saleStatus(s)} /></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`${s.name} on or off`} checked={s.active} disabled={pending} onChange={(e) => toggle(() => setSaleActive(s.id, e.target.checked))} className="size-4" />
                    </TableCell>
                  </TableRow>
                ))}
                {data.sales.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="py-14 text-center text-muted-foreground">No sales yet. A sale lowers prices store-wide, by category, or on chosen products, between the dates you pick.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CodeEditor code={editCode} stats={editCode ? data.stats[editCode.code] : undefined} open={newCode || !!editCode} onClose={() => { setNewCode(false); setEditCode(null) }} />
      <SaleEditor sale={editSale} open={newSale || !!editSale} onClose={() => { setNewSale(false); setEditSale(null) }} />
    </div>
  )
}
