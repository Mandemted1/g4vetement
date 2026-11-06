"use client"

import Link from "next/link"
import { BellIcon, AlertTriangleIcon, PackageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAdmin } from "@/components/admin-data"
import { money, relativeTime } from "@/lib/format"

export function Notifications() {
  const { orders, products, customerById, today } = useAdmin()
  const open = orders.filter((o) => o.status === "pending" || o.status === "processing").slice(-3).reverse()
  const stock = products.filter((p) => p.stock <= p.reorderLevel).sort((a, b) => a.stock - b.stock).slice(0, 3)
  const count = open.length + stock.length
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" aria-label="Notifications" />}>
        <BellIcon className="size-4" />
        <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-negative text-[9px] font-semibold text-white">{count}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Needs attention</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {open.map((o) => (
          <DropdownMenuItem key={o.id} render={<Link href="/admin/orders" />} className="items-start gap-3 py-2">
            <PackageIcon className="mt-0.5 size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">New order #{o.id} · {money(o.total)}</p>
              <p className="text-xs text-muted-foreground">{customerById.get(o.customerId)?.name} · {relativeTime(o.date, today + 86_400_000 - 1)}</p>
            </div>
          </DropdownMenuItem>
        ))}
        {stock.map((p) => (
          <DropdownMenuItem key={p.id} render={<Link href="/admin/products" />} className="items-start gap-3 py-2">
            <AlertTriangleIcon className="mt-0.5 size-4 text-warning" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.stock === 0 ? "Out of stock" : `Only ${p.stock} left`} · reorder at {p.reorderLevel}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
