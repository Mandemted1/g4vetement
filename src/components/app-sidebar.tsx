"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ExternalLinkIcon, LayoutDashboardIcon, LogOutIcon, MailIcon, MegaphoneIcon, MailOpenIcon, BarChart3Icon, SettingsIcon, TagsIcon, PercentIcon, PackageIcon, ShirtIcon, UsersIcon } from "lucide-react"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ADMIN_NAME } from "@/lib/data"
import { useAdmin } from "@/components/admin-data"
import { signOut } from "@/app/admin/actions"

export function AppSidebar() {
  const pathname = usePathname()
  const { orders, products, subscribers, mode } = useAdmin()
  const openOrders = orders.filter((o) => o.status === "pending" || o.status === "processing").length
  const lowStock = products.filter((p) => p.stock <= p.reorderLevel).length
  const nav = [
    { title: "Dashboard", href: "/admin", icon: LayoutDashboardIcon },
    { title: "Orders", href: "/admin/orders", icon: PackageIcon, badge: openOrders },
    { title: "Products", href: "/admin/products", icon: ShirtIcon, badge: lowStock, warn: true },
    { title: "Categories", href: "/admin/categories", icon: TagsIcon },
    { title: "Customers", href: "/admin/customers", icon: UsersIcon },
    { title: "View store", href: "/", icon: ExternalLinkIcon, external: true },
  ]
  const insights = [
    { title: "Analytics", href: "/admin/analytics", icon: BarChart3Icon },
    { title: "Settings", href: "/admin/settings", icon: SettingsIcon },
  ]
  const marketing = [
    { title: "Discounts", href: "/admin/discounts", icon: PercentIcon },
    { title: "Campaigns", href: "/admin/campaigns", icon: MegaphoneIcon },
    { title: "Emails", href: "/admin/emails", icon: MailOpenIcon },
    { title: "Subscribers", href: "/admin/subscribers", icon: MailIcon, badge: subscribers.length || undefined },
  ]
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href))
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/admin" />}>
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
        {[
          { label: "Store", items: nav },
          { label: "Marketing", items: marketing },
          { label: "Insights", items: insights },
        ].map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton tooltip={item.title} isActive={!("external" in item) && active(item.href)} render={<Link href={item.href} />}>
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {"badge" in item && typeof item.badge === "number" && item.badge > 0 ? <SidebarMenuBadge className={"warn" in item && item.warn ? "text-warning" : undefined}>{item.badge}</SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
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
          {mode === "live" && (
            <SidebarMenuItem>
              <form action={signOut}>
                <SidebarMenuButton type="submit" tooltip="Sign out">
                  <LogOutIcon />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </form>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
