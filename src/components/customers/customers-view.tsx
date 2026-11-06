"use client"

import { useMemo, useState } from "react"
import { SearchIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pager } from "@/components/pager"
import { type Customer } from "@/lib/data"
import { useAdmin } from "@/components/admin-data"
import { dateLabel, initials, money } from "@/lib/format"
import { cn } from "@/lib/utils"

const PAGE = 12
const TIERS: ("All" | Customer["tier"])[] = ["All", "VIP", "Loyal", "Returning", "New"]
const tierStyle: Record<Customer["tier"], string> = {
  VIP: "bg-foreground text-background",
  Loyal: "bg-positive/15 text-[oklch(0.42_0.12_155)] dark:text-positive",
  Returning: "bg-blue-500/12 text-blue-700 dark:text-blue-300",
  New: "bg-muted text-muted-foreground",
}

export function CustomersView() {
  const { customers } = useAdmin()
  const [q, setQ] = useState("")
  const [tier, setTier] = useState<(typeof TIERS)[number]>("All")
  const [page, setPage] = useState(0)

  const rows = useMemo(() => {
    const s = q.toLowerCase()
    return customers
      .filter((c) => (tier === "All" || c.tier === tier) && (c.name.toLowerCase().includes(s) || c.email.includes(s)))
      .sort((a, b) => b.spent - a.spent)
  }, [q, tier, customers])
  const view = rows.slice(page * PAGE, (page + 1) * PAGE)
  const total = customers.reduce((s, c) => s + c.spent, 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="rise">
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">{customers.length} customers · {money(total)} lifetime spend (matches total revenue).</p>
      </div>
      <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={tier} onValueChange={(v) => { setTier(v as typeof tier); setPage(0) }}>
              <TabsList>{TIERS.map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}</TabsList>
            </Tabs>
            <div className="relative w-full lg:w-72">
              <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Search name or email" className="pl-8" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="hidden sm:table-cell">Last order</TableHead>
                <TableHead className="text-right">Spent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-8"><AvatarFallback className="text-[11px]">{initials(c.name)}</AvatarFallback></Avatar>
                      <div className="min-w-0"><div className="truncate font-medium">{c.name}</div><div className="truncate text-xs text-muted-foreground">{c.email}</div></div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{c.city}, {c.state}</TableCell>
                  <TableCell><Badge variant="secondary" className={cn("border-0", tierStyle[c.tier])}>{c.tier}</Badge></TableCell>
                  <TableCell className="text-right tabular">{c.orders}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{dateLabel(c.lastOrder)}</TableCell>
                  <TableCell className="text-right font-medium tabular">{money(c.spent)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager page={page} pages={Math.ceil(rows.length / PAGE)} total={rows.length} size={PAGE} onPage={setPage} />
        </CardContent>
      </Card>
    </div>
  )
}
