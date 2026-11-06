"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboardIcon, PackageIcon, ShirtIcon, UsersIcon } from "lucide-react"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { orders, products, ADMIN_NAME } from "@/lib/data"

const openOrders = orders.filter((o) => o.status === "pending" || o.status === "processing").length
const lowStock = products.filter((p) => p.stock <= p.reorderLevel).length

const nav = [
  { title: "Dashboard", href: "/", icon: LayoutDashboardIcon },
  { title: "Orders", href: "/orders", icon: PackageIcon, badge: openOrders },
  { title: "Products", href: "/products", icon: ShirtIcon, badge: lowStock, warn: true },
  { title: "Customers", href: "/customers", icon: UsersIcon },
]

export function AppSidebar() {
  const pathname = usePathname()
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold tracking-tight text-sidebar-primary-foreground">
                G4
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">G4 Admin</span>
                <span className="truncate text-xs text-muted-foreground">Clothing store</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Store</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton tooltip={item.title} isActive={active(item.href)} render={<Link href={item.href} />}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  {item.badge ? <SidebarMenuBadge className={item.warn ? "text-warning" : undefined}>{item.badge}</SidebarMenuBadge> : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={ADMIN_NAME}>
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg text-xs font-semibold">G4</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{ADMIN_NAME}</span>
                <span className="truncate text-xs text-muted-foreground">Store owner</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
