"use client"

import { useMemo, useState } from "react"
import { SearchIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { products, orders, isBooked, stockState, type Category } from "@/lib/data"
import { int, money } from "@/lib/format"
import { cn } from "@/lib/utils"

const CATS: ("All" | Category)[] = ["All", "Tees", "Hoodies & Sweats", "Bottoms", "Outerwear", "Accessories"]

export function ProductsView() {
  const [q, setQ] = useState("")
  const [cat, setCat] = useState<(typeof CATS)[number]>("All")

  const sales = useMemo(() => {
    const m = new Map<string, { units: number; revenue: number }>()
    orders.filter(isBooked).forEach((o) => o.items.forEach((i) => {
      const e = m.get(i.productId) ?? { units: 0, revenue: 0 }
      e.units += i.qty
      e.revenue += i.price * i.qty - (o.discount * i.price * i.qty) / o.subtotal
      m.set(i.productId, e)
    }))
    return m
  }, [])

  const rows = products
    .filter((p) => (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sales.get(b.id)?.revenue ?? 0) - (sales.get(a.id)?.revenue ?? 0))

  return (
    <div className="flex flex-col gap-5">
      <div className="rise">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">{products.length} products · sales are all-time net of discounts.</p>
      </div>
      <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="overflow-x-auto">
              <Tabs value={cat} onValueChange={(v) => setCat(v as typeof cat)}>
                <TabsList>{CATS.map((c) => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}</TabsList>
              </Tabs>
            </div>
            <div className="relative w-full lg:w-64">
              <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="pl-8" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Units sold</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Revenue</TableHead>
                <TableHead className="w-44">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const s = sales.get(p.id) ?? { units: 0, revenue: 0 }
                const st = stockState(p)
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-1.5">{p.colors.map((c) => <span key={c.name} title={c.name} className="size-5 rounded-full border-2 border-card" style={{ background: c.hex }} />)}</div>
                        <div className="min-w-0"><div className="truncate font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.sku}</div></div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{p.category}</TableCell>
                    <TableCell className="text-right tabular">{money(p.price)}</TableCell>
                    <TableCell className="hidden text-right tabular sm:table-cell">{int(s.units)}</TableCell>
                    <TableCell className="hidden text-right font-medium tabular sm:table-cell">{money(s.revenue)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="tabular">{p.stock} units</span>
                          {st !== "ok" && <Badge variant="secondary" className={cn("border-0", st === "out" ? "bg-negative/12 text-negative" : "bg-warning/15 text-[oklch(0.5_0.12_70)] dark:text-warning")}>{st === "out" ? "Sold out" : "Low"}</Badge>}
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all duration-700", st === "ok" ? "bg-foreground" : st === "low" ? "bg-warning" : "bg-negative")} style={{ width: `${Math.min(100, (p.stock / (p.reorderLevel * 4)) * 100)}%` }} /></div>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
