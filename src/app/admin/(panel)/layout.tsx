import { AdminDataProvider } from "@/components/admin-data"
import { AppSidebar } from "@/components/app-sidebar"
import { DemoBanner, LiveOrders } from "@/components/admin-live"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { requireAdmin } from "@/lib/auth"
import { getAdminData } from "@/lib/source"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  const data = await getAdminData()
  return (
    <AdminDataProvider data={data}>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <SiteHeader />
            <DemoBanner />
            <main className="flex flex-1 flex-col gap-6 p-4 pt-2 md:p-6 md:pt-2">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
      <LiveOrders />
    </AdminDataProvider>
  )
}
