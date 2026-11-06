"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { SearchIcon, ArrowUpDownIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { ProductThumb } from "@/components/product-thumb"
import { StatusBadge, statusLabel } from "@/components/status-badge"
import { Pager } from "@/components/pager"
import { type Order, type OrderStatus } from "@/lib/data"
import { useAdmin } from "@/components/admin-data"
import { setOrderStatus } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { dateLabel, initials, money, timeLabel } from "@/lib/format"

const PAGE = 12
const FILTERS: ("all" | OrderStatus)[] = ["all", "pending", "processing", "shipped", "delivered", "cancelled", "refunded"]
type Sort = "date" | "total"

export function OrdersView() {
  const { orders, customerById } = useAdmin()
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<"all" | OrderStatus>("all")
  const [sort, setSort] = useState<Sort>("date")
  const [desc, setDesc] = useState(true)
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const open = orders.find((o) => o.id === openId) ?? null

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length }
    orders.forEach((o) => (c[o.status] = (c[o.status] ?? 0) + 1))
    return c
  }, [orders])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false
      if (!s) return true
      const c = customerById.get(o.customerId)
      return o.id.toLowerCase().includes(s) || c?.name.toLowerCase().includes(s) || c?.email.toLowerCase().includes(s)
    })
    list.sort((a, b) => (sort === "date" ? a.date.localeCompare(b.date) : a.total - b.total))
    return desc ? list.reverse() : list
  }, [q, status, sort, desc, orders, customerById])

  const pages = Math.ceil(rows.length / PAGE)
  const view = rows.slice(page * PAGE, (page + 1) * PAGE)
  const toggle = (s: Sort) => { if (sort === s) setDesc(!desc); else { setSort(s); setDesc(true) } setPage(0) }

  return (
    <div className="flex flex-col gap-5">
      <div className="rise">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">{orders.length} orders since May 1 · click any row for details.</p>
      </div>
      <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="overflow-x-auto">
              <Tabs value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(0) }}>
                <TabsList>
                  {FILTERS.map((f) => (
                    <TabsTrigger key={f} value={f} className="capitalize">{f === "all" ? "All" : statusLabel[f]} <span className="ml-1 text-xs text-muted-foreground tabular">{counts[f] ?? 0}</span></TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <div className="relative w-full lg:w-72">
              <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Search order, name or email" className="pl-8" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell"><button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggle("date")}>Date <ArrowUpDownIcon className="size-3" /></button></TableHead>
                <TableHead className="text-right"><button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggle("total")}>Total <ArrowUpDownIcon className="size-3" /></button></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.map((o) => {
                const c = customerById.get(o.customerId) ?? { name: "Guest", email: "", id: "" }
                return (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => setOpenId(o.id)}>
                    <TableCell className="font-medium">#{o.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-7"><AvatarFallback className="text-[10px]">{initials(c.name)}</AvatarFallback></Avatar>
                        <div className="min-w-0"><div className="truncate">{c.name}</div><div className="hidden truncate text-xs text-muted-foreground lg:block">{c.email}</div></div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{o.channel}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{dateLabel(o.date)}</TableCell>
                    <TableCell className="text-right font-medium tabular">{money(o.total)}</TableCell>
                  </TableRow>
                )
              })}
              {view.length === 0 && <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No orders match your filters.</TableCell></TableRow>}
            </TableBody>
          </Table>
          <Pager page={page} pages={pages} total={rows.length} size={PAGE} onPage={setPage} />
        </CardContent>
      </Card>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && <OrderDetail o={open} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { pending: "processing", processing: "shipped", shipped: "delivered" }

function OrderDetail({ o }: { o: Order }) {
  const { customerById, productById } = useAdmin()
  const router = useRouter()
  const [busy, start] = useTransition()
  const [err, setErr] = useState("")
  const c = customerById.get(o.customerId) ?? { name: "Guest", email: "", city: "", state: "", id: "" }
  const next = NEXT[o.status]
  const terminal = o.status === "cancelled" || o.status === "refunded"
  const change = (to: OrderStatus, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setErr("")
    start(async () => {
      const r = await setOrderStatus(o.id, to)
      if (!r.ok) setErr(r.error)
      else router.refresh()
    })
  }
  const steps: OrderStatus[] = ["pending", "processing", "shipped", "delivered"]
  const idx = steps.indexOf(o.status)
  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <SheetHeader className="px-0">
        <SheetTitle>Order #{o.id}</SheetTitle>
        <SheetDescription>{dateLabel(o.date)} at {timeLabel(o.date)} · {o.channel}</SheetDescription>
      </SheetHeader>
      <div className="flex items-center justify-between"><StatusBadge status={o.status} /><span className="text-xl font-semibold tabular">{money(o.total)}</span></div>
      {!terminal && (
        <div className="flex flex-col gap-2">
          {next && <Button disabled={busy} onClick={() => change(next)}>{busy ? "Saving…" : `Mark as ${statusLabel[next].toLowerCase()}`}</Button>}
          {o.status === "delivered" ? (
            <Button variant="outline" disabled={busy} onClick={() => change("refunded", `Refund order #${o.id}?`)}>Refund</Button>
          ) : (
            <Button variant="outline" disabled={busy} onClick={() => change("cancelled", `Cancel order #${o.id}? Items go back into stock.`)}>Cancel order</Button>
          )}
        </div>
      )}
      {err && <p className="text-xs text-negative">{err}</p>}
      {idx >= 0 && (
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col gap-1.5">
              <div className={`h-1.5 rounded-full transition-colors ${i <= idx ? "bg-foreground" : "bg-muted"}`} />
              <span className={`text-[11px] ${i <= idx ? "text-foreground" : "text-muted-foreground"}`}>{statusLabel[s]}</span>
            </div>
          ))}
        </div>
      )}
      <Separator />
      <div>
        <h3 className="mb-3 text-sm font-medium">Items</h3>
        <ul className="flex flex-col gap-3">
          {o.items.map((i) => (
            <li key={i.productId} className="flex items-center gap-3 text-sm">
              <ProductThumb image={productById.get(i.productId)?.images[0]} color={i.colorHex} className="size-10 rounded-lg" />
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{i.name}</div><div className="text-xs text-muted-foreground">{i.color} · {i.size} · Qty {i.qty}</div></div>
              <span className="tabular">{i.listPrice && i.listPrice > i.price && <s className="mr-1.5 text-muted-foreground">{money(i.listPrice * i.qty)}</s>}{money(i.price * i.qty)}</span>
            </li>
          ))}
        </ul>
      </div>
      <Separator />
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular">{money(o.subtotal)}</dd></div>
        {(o.saleDiscount ?? 0) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Sale</dt><dd className="tabular">−{money(o.saleDiscount ?? 0)}</dd></div>}
        {o.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Discount ({o.discountCode})</dt><dd className="tabular">−{money(o.discount)}</dd></div>}
        <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd className="tabular">{o.shipping ? money(o.shipping) : "Free"}</dd></div>
        <div className="flex justify-between border-t pt-2 font-semibold"><dt>Total</dt><dd className="tabular">{money(o.total)}</dd></div>
      </dl>
      <Separator />
      <div className="text-sm">
        <h3 className="mb-2 font-medium">Customer</h3>
        <div className="flex items-center gap-3">
          <Avatar><AvatarFallback>{initials(c.name)}</AvatarFallback></Avatar>
          <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.email} · {c.city}, {c.state}</div></div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Paid with {o.payment}</p>
      </div>
    </div>
  )
}
