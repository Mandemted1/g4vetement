import { currentStaff } from "@/lib/admin-auth"
import { customersToCsv, ordersToCsv } from "@/lib/exports"
import { productTemplateCsv, productsToCsv } from "@/lib/product-import"
import { roleCan } from "@/lib/permissions"
import { getAdminData } from "@/lib/source"
import { isLive } from "@/lib/supabase/env"

export const dynamic = "force-dynamic"

const DATE = /^\d{4}-\d{2}-\d{2}$/
const STATUSES = new Set(["all", "pending", "processing", "shipped", "delivered", "cancelled", "refunded"])

/** CSV downloads for the admin: products, orders, customers, and a blank product template. */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params
  const text = (body: string, status = 200, name?: string) =>
    new Response(body, {
      status,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...(name ? { "Content-Disposition": `attachment; filename="${name}"` } : {}),
      },
    })
  const fail = (msg: string, status: number) => new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })

  if (!isLive) return fail("Demo mode: connect Supabase to export data.", 400)
  const staff = await currentStaff()
  if (!staff) return fail("Please sign in again.", 401)
  if (!roleCan(staff.role, "data.export")) return fail("Your role can't export data.", 403)

  const stamp = new Date().toISOString().slice(0, 10)
  if (kind === "products-template") return text(productTemplateCsv(), 200, "g4-products-template.csv")

  const url = new URL(req.url)
  const data = await getAdminData()
  if (kind === "products") return text(productsToCsv(data.products), 200, `g4-products-${stamp}.csv`)
  if (kind === "customers") return text(customersToCsv(data.customers), 200, `g4-customers-${stamp}.csv`)
  if (kind === "orders") {
    const from = url.searchParams.get("from") ?? ""
    const to = url.searchParams.get("to") ?? ""
    const status = url.searchParams.get("status") ?? "all"
    if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return fail("Dates must look like 2026-11-05.", 400)
    if (!STATUSES.has(status)) return fail("Unknown status.", 400)
    const customers = new Map(data.customers.map((c) => [c.id, c]))
    const products = new Map(data.products.map((p) => [p.id, p]))
    return text(ordersToCsv(data.orders, customers, products, { from: from || undefined, to: to || undefined, status, includeDemo: url.searchParams.get("demo") === "1" }), 200, `g4-orders-${stamp}.csv`)
  }
  return fail("Not found.", 404)
}
