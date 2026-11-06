import type { LowStockEvent } from "@/lib/alerts"
import { defaultTheme, uid, type EmailDoc } from "./types"

/** The emails sent to the store owner. Built in code (not editable templates): they're for you, not your customers. */

export const newOrderDoc = (): EmailDoc => ({
  theme: defaultTheme,
  blocks: [
    { id: uid(), type: "heading", text: "New order", align: "left", size: "l" },
    { id: uid(), type: "text", text: "**{{customer_name}}** ({{customer_email}}) placed order **{{order_id}}** for **{{order_total}}**.", align: "left" },
    { id: uid(), type: "spacer", height: 8 },
    { id: uid(), type: "order" },
    { id: uid(), type: "button", label: "Open orders", url: "{{admin_url}}/orders", align: "left", style: "solid" },
  ],
})

export const newOrderSubject = (orderId: string, total: number, customer: string) => `New order ${orderId} · $${total}${customer.trim() ? ` · ${customer.trim().slice(0, 40)}` : ""}`

const line = (e: LowStockEvent) => {
  const head = e.soldOut ? `**${e.name}** is sold out.` : e.crossed ? `**${e.name}**: ${e.left} left (your warning level is ${e.reorderLevel}).` : `**${e.name}**: ${e.left} left.`
  const sizes = e.soldOutSizes.length ? ` Sold out in ${e.soldOutSizes.length === 1 ? "size" : "sizes"} ${e.soldOutSizes.join(", ")}.` : ""
  return head + sizes
}

export const lowStockDoc = (events: LowStockEvent[]): EmailDoc => ({
  theme: defaultTheme,
  blocks: [
    { id: uid(), type: "heading", text: events.some((e) => e.soldOut) ? "Stock alert" : "Running low", align: "left", size: "l" },
    { id: uid(), type: "text", text: events.map(line).join("\n"), align: "left" },
    { id: uid(), type: "button", label: "Open products", url: "{{admin_url}}/products", align: "left", style: "solid" },
  ],
})

export function lowStockSubject(events: LowStockEvent[]): string {
  if (events.length === 1) {
    const e = events[0]
    return e.soldOut ? `Sold out: ${e.name}` : e.crossed ? `Low stock: ${e.name} (${e.left} left)` : `${e.name}: ${e.soldOutSizes.join(", ")} sold out`
  }
  return `Stock alert: ${events.length} products need attention`
}
