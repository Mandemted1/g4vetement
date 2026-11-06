"use client"

import { usePathname } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbLink } from "@/components/ui/breadcrumb"
import { ThemeToggle } from "@/components/theme-toggle"
import { Notifications } from "@/components/notifications"

const titles: Record<string, string> = { "/admin": "Dashboard", "/admin/orders": "Orders", "/admin/products": "Products", "/admin/customers": "Customers", "/admin/subscribers": "Subscribers", "/admin/campaigns": "Campaigns", "/admin/emails": "Emails", "/admin/analytics": "Analytics", "/admin/settings": "Settings" }

export function SiteHeader() {
  const pathname = usePathname()
  const title = titles[pathname] ?? (pathname.startsWith("/admin/campaigns") ? "Campaign" : pathname.startsWith("/admin/emails") ? "Edit email" : "Dashboard")
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block"><BreadcrumbLink href="/admin">G4</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          <BreadcrumbItem><BreadcrumbPage>{title}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-1">
        <Notifications />
        <ThemeToggle />
      </div>
    </header>
  )
}
