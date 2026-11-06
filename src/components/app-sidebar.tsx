"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ExternalLinkIcon, LayoutDashboardIcon, LogOutIcon, MailIcon, MegaphoneIcon, MailOpenIcon, BarChart3Icon, SettingsIcon, TagsIcon, PercentIcon, StarIcon, GiftIcon, ShoppingCartIcon, DownloadIcon, ShieldCheckIcon, PackageIcon, ShirtIcon, UsersIcon } from "lucide-react"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ADMIN_NAME } from "@/lib/data"
import { useAdmin } from "@/components/admin-data"
import { useStaff } from "@/components/staff-context"
import { ROLE_INFO, type Cap } from "@/lib/permissions"
import { signOut } from "@/app/admin/actions"

export function AppSidebar() {
  const pathname = usePathname()
  const { orders, products, subscribers, mode } = useAdmin()
  const { role, email, can } = useStaff()
  const openOrders = orders.filter((o) => o.status === "pending" || o.status === "processing").length
  const lowStock = products.filter((p) => p.stock <= p.reorderLevel).length
  const nav = [
    { title: "Dashboard", href: "/admin", icon: LayoutDashboardIcon },
    { title: "Orders", href: "/admin/orders", icon: PackageIcon, badge: openOrders },
    { title: "Products", href: "/admin/products", icon: ShirtIcon, badge: lowStock, warn: true },
    { title: "Categories", href: "/admin/categories", icon: TagsIcon },
    { title: "Customers", href: "/admin/customers", icon: UsersIcon },
    { title: "Reviews", href: "/admin/reviews", icon: StarIcon, cap: "reviews.manage" as Cap },
    { title: "View store", href: "/", icon: ExternalLinkIcon, external: true },
  ]
  const insights = [
    { title: "Analytics", href: "/admin/analytics", icon: BarChart3Icon, cap: "analytics.view" as Cap },
    { title: "Import & export", href: "/admin/data", icon: DownloadIcon, cap: "data.export" as Cap },
    { title: "Team", href: "/admin/team", icon: ShieldCheckIcon, cap: "staff.manage" as Cap },
    { title: "Settings", href: "/admin/settings", icon: SettingsIcon, cap: "settings.manage" as Cap },
  ]
  const marketing = [
    { title: "Discounts", href: "/admin/discounts", icon: PercentIcon, cap: "marketing.manage" as Cap },
    { title: "Gift cards", href: "/admin/gift-cards", icon: GiftIcon, cap: "giftcards.manage" as Cap },
    { title: "Abandoned carts", href: "/admin/abandoned-carts", icon: ShoppingCartIcon, cap: "marketing.manage" as Cap },
    { title: "Campaigns", href: "/admin/campaigns", icon: MegaphoneIcon, cap: "marketing.manage" as Cap },
    { title: "Emails", href: "/admin/emails", icon: MailOpenIcon, cap: "marketing.manage" as Cap },
    { title: "Subscribers", href: "/admin/subscribers", icon: MailIcon, badge: subscribers.length || undefined, cap: "marketing.manage" as Cap },
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
          { label: "Admin", items: insights },
        ].map((g) => ({ ...g, items: g.items.filter((i) => !("cap" in i) || !i.cap || can(i.cap)) })).filter((g) => g.items.length > 0).map((g) => (
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
            <SidebarMenuButton size="lg" tooltip="My account" render={<Link href="/admin/account" />} isActive={pathname.startsWith("/admin/account")}>
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg text-xs font-semibold">{(email || ADMIN_NAME).slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{email || ADMIN_NAME}</span>
                <span className="truncate text-xs text-muted-foreground">{ROLE_INFO[role].label}</span>
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
