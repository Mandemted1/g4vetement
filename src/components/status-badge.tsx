import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { OrderStatus } from "@/lib/data"

const styles: Record<OrderStatus, string> = {
  pending: "bg-warning/15 text-[oklch(0.5_0.12_70)] dark:text-warning",
  processing: "bg-blue-500/12 text-blue-700 dark:text-blue-300",
  shipped: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  delivered: "bg-positive/15 text-[oklch(0.42_0.12_155)] dark:text-positive",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-negative/12 text-negative",
}
export const statusLabel: Record<OrderStatus, string> = {
  pending: "Pending", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded",
}
export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="secondary" className={cn("border-0 font-medium", styles[status])}>
      <span className="mr-1.5 size-1.5 rounded-full bg-current" />
      {statusLabel[status]}
    </Badge>
  )
}
