"use client"

import { useMemo, useState } from "react"
import { PlusIcon, SearchIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ProductThumb } from "@/components/product-thumb"
import { ProductEditor } from "@/components/products/product-editor"
import { useAdmin } from "@/components/admin-data"
import { isBooked, stockState, type Product } from "@/lib/data"
import { SECTIONS, departmentLabel, inSection, type Section } from "@/lib/departments"
import { searchProducts } from "@/lib/search"
import { soldOutSizes } from "@/lib/stock"
import { int, money } from "@/lib/format"
import { cn } from "@/lib/utils"

export function ProductsView() {
  const { products, orders, categories: managed } = useAdmin()
  const [q, setQ] = useState("")
  const [cat, setCat] = useState("All")
  const [dept, setDept] = useState<"all" | Section>("all")
  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)

  // every category the editor can offer, with its department (ones products use but aren't in the list count as shared)
  const options = useMemo(() => {
    const names = managed.map((c) => c.name)
    const orphans = [...new Set(products.map((p) => p.category).filter((c) => !names.includes(c)))]
    return [...managed.map((c) => ({ name: c.name, department: c.department })), ...orphans.map((name) => ({ name, department: "both" as const }))]
  }, [products, managed])
  // category tabs follow the department tab: Men shows men's and shared categories, and so on
  const cats = useMemo(() => ["All", ...options.filter((o) => dept === "all" || o.department === "both" || o.department === dept).map((o) => o.name)], [options, dept])
  const sales = useMemo(() => {
    const m = new Map<string, { units: number; revenue: number }>()
    orders.filter(isBooked).forEach((o) =>
      o.items.forEach((i) => {
        const e = m.get(i.productId) ?? { units: 0, revenue: 0 }
        e.units += i.qty
        e.revenue += i.price * i.qty - (o.subtotal ? (o.discount * i.price * i.qty) / o.subtotal : 0)
        m.set(i.productId, e)
      }),
    )
    return m
  }, [orders])

  // same matching as the storefront: name, colour, category, product code, description (typos and plurals are fine)
  const matched = q.trim() ? new Set(searchProducts(products, q, { codes: true }).map((p) => p.id)) : null
  const rows = products
    .filter((p) => (dept === "all" || inSection(p, dept)) && (cat === "All" || p.category === cat) && (matched?.has(p.id) ?? true))
    .sort((a, b) => (sales.get(b.id)?.revenue ?? 0) - (sales.get(a.id)?.revenue ?? 0))

  return (
    <div className="flex flex-col gap-5">
      <div className="rise flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">{products.length} products · click a row to edit. Sales are all-time, net of discounts.</p>
        </div>
        <Button onClick={() => setCreating(true)}><PlusIcon /> New product</Button>
      </div>
      <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 overflow-x-auto">
              <Tabs value={dept} onValueChange={(v) => { setDept(v as "all" | Section); setCat("All") }}>
                <TabsList>
                  <TabsTrigger value="all">All departments</TabsTrigger>
                  {SECTIONS.map((s) => <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>)}
                </TabsList>
              </Tabs>
              <Tabs value={cats.includes(cat) ? cat : "All"} onValueChange={(v) => setCat(v as string)}>
                <TabsList>{cats.map((c) => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}</TabsList>
              </Tabs>
            </div>
            <div className="relative w-full lg:w-64">
              <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, colour, code…" className="pl-8" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="hidden sm:table-cell">Department</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Units sold</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Revenue</TableHead>
                <TableHead className="w-44">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const s = sales.get(p.id) ?? { units: 0, revenue: 0 }
                const st = stockState(p)
                return (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setEditing(p)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ProductThumb image={p.images[0]} color={p.colors[0]?.hex ?? "#999"} className="size-11 rounded-lg" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{p.name}</span>
                            {!p.active && <Badge variant="secondary" className="border-0 bg-muted text-muted-foreground">Hidden</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{p.sku}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"><Badge variant="secondary" className="border-0 bg-muted text-muted-foreground">{departmentLabel(p.department)}</Badge></TableCell>
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
                        {st !== "out" && soldOutSizes(p).length > 0 && <div className="text-xs text-muted-foreground">Out of: {soldOutSizes(p).join(", ")}</div>}
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full transition-all duration-700", st === "ok" ? "bg-foreground" : st === "low" ? "bg-warning" : "bg-negative")} style={{ width: `${Math.min(100, (p.stock / Math.max(1, p.reorderLevel * 4)) * 100)}%` }} />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ProductEditor product={editing} categories={options} open={!!editing || creating} onClose={() => { setEditing(null); setCreating(false) }} />
    </div>
  )
}
