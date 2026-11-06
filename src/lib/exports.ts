/** CSV exports of orders and customers. Pure: handed the data, returns text. */
import { toCsv } from "./csv"
import type { Customer, Order, Product } from "./data"

export interface OrderExportOptions {
  /** yyyy-mm-dd, inclusive (UTC) */
  from?: string
  to?: string
  status?: string
  /** include the simulated demo orders (off by default: they aren't real customers) */
  includeDemo?: boolean
}

export const ORDER_COLUMNS = [
  "order_id", "order_number", "date", "status", "customer_name", "customer_email", "ship_country", "ship_city", "ship_state", "ship_postcode", "ship_address",
  "product_id", "sku", "product_name", "size", "color", "qty", "list_price", "unit_price", "line_total",
  "subtotal", "sale_discount", "discount", "discount_code", "shipping", "order_total", "gift_card", "payment", "tracking_carrier", "tracking_number",
] as const

const day = (iso: string) => iso.slice(0, 10)

/** The orders this export would include. */
export function selectOrders(orders: Order[], o: OrderExportOptions): Order[] {
  return orders.filter((x) => (o.includeDemo || !x.sim) && (!o.status || o.status === "all" || x.status === o.status) && (!o.from || day(x.date) >= o.from) && (!o.to || day(x.date) <= o.to))
}

/** One row per item in an order; the order's own fields (totals, address, status) are repeated on each of its rows. */
export function ordersToCsv(orders: Order[], customers: Map<string, Pick<Customer, "name" | "email">>, products: Map<string, Pick<Product, "sku">>, o: OrderExportOptions = {}): string {
  const rows = selectOrders(orders, o)
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((x) => {
      const c = customers.get(x.customerId)
      return x.items.map((i) => [
        x.id, x.number, x.date, x.status, c?.name ?? "", c?.email ?? "", x.ship?.country ?? "", x.ship?.city ?? "", x.ship?.state ?? "", x.ship?.postcode ?? "", x.ship?.address ?? "",
        i.productId, products.get(i.productId)?.sku ?? "", i.name, i.size, i.color, i.qty, i.listPrice ?? i.price, i.price, i.price * i.qty,
        x.subtotal, x.saleDiscount ?? 0, x.discount, x.discountCode ?? "", x.shipping, x.total, x.giftAmount ?? 0, x.payment, x.tracking?.carrier ?? "", x.tracking?.number ?? "",
      ])
    })
  return toCsv([...ORDER_COLUMNS], rows)
}

export const CUSTOMER_COLUMNS = ["id", "name", "email", "city", "state", "orders", "total_spent", "first_order", "last_order", "tier"] as const

export function customersToCsv(customers: Customer[]): string {
  return toCsv([...CUSTOMER_COLUMNS], customers.map((c) => [c.id, c.name, c.email, c.city, c.state, c.orders, c.spent, c.firstOrder, c.lastOrder, c.tier]))
}
