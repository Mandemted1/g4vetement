import { PrintButton } from "@/components/orders/print-button"
import { requireCap } from "@/lib/auth"
import { code39 } from "@/lib/code39"
import { countryName } from "@/lib/countries"
import { dateLabel, money } from "@/lib/format"
import { getStoreSettings } from "@/lib/settings"
import { getAdminData } from "@/lib/source"

export const metadata = { title: "Packing slips", robots: { index: false } }
export const dynamic = "force-dynamic"

const MAX = 100
const ID = /^[A-Za-z0-9-]{1,40}$/

function Barcode({ text }: { text: string }) {
  const b = code39(text)
  if (!b) return null
  return (
    <svg role="img" aria-label={`Barcode for order ${text}`} viewBox={`0 0 ${b.width} 40`} preserveAspectRatio="none" style={{ width: 190, height: 34 }}>
      {b.bars.map((x, i) => <rect key={i} x={x.x} y={0} width={x.w} height={40} fill="#000" />)}
    </svg>
  )
}

export default async function Page({ searchParams }: { searchParams: Promise<{ ids?: string; prices?: string }> }) {
  await requireCap("orders.manage")
  const sp = await searchParams
  const wanted = [...new Set((sp.ids ?? "").split(",").map((s) => s.trim()).filter((s) => ID.test(s)))].slice(0, MAX)
  const prices = sp.prices === "1"
  const [data, store] = await Promise.all([getAdminData(), getStoreSettings()])
  const byId = new Map(data.orders.map((o) => [o.id, o]))
  const customers = new Map(data.customers.map((c) => [c.id, c]))
  const products = new Map(data.products.map((p) => [p.id, p]))
  const orders = wanted.map((id) => byId.get(id)).filter((o): o is NonNullable<typeof o> => !!o)
  const missing = wanted.filter((id) => !byId.has(id))
  const q = (on: boolean) => `/admin/packing-slips?ids=${encodeURIComponent(wanted.join(","))}${on ? "&prices=1" : ""}`

  return (
    <div className="slip-root">
      <style>{`
        .slip-root { background:#fff; color:#111; min-height:100vh; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; font-size:13px; line-height:1.45; }
        .slip-bar { position:sticky; top:0; z-index:5; display:flex; flex-wrap:wrap; gap:12px; align-items:center; padding:12px 20px; background:#f4f4f2; border-bottom:1px solid #ddd; }
        .slip-bar a, .slip-bar button { font:inherit; border:1px solid #bbb; background:#fff; color:#111; padding:6px 12px; border-radius:6px; cursor:pointer; text-decoration:none; }
        .slip-bar button.primary { background:#111; color:#fff; border-color:#111; }
        .slip { width:100%; max-width:780px; margin:24px auto; padding:36px 40px; border:1px solid #e3e3e0; background:#fff; break-after:page; page-break-after:always; }
        .slip:last-of-type { break-after:auto; page-break-after:auto; }
        .slip h1 { font-size:22px; letter-spacing:.02em; margin:0; }
        .slip h2 { font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:#666; margin:0 0 4px; font-weight:600; }
        .slip table { width:100%; border-collapse:collapse; margin-top:22px; }
        .slip th { text-align:left; font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:#666; border-bottom:1.5px solid #111; padding:6px 8px 6px 0; }
        .slip td { border-bottom:1px solid #e3e3e0; padding:9px 8px 9px 0; vertical-align:top; }
        .slip .r { text-align:right; } .slip .box { display:inline-block; width:14px; height:14px; border:1.5px solid #111; border-radius:2px; }
        .slip .grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:26px; }
        .slip .muted { color:#666; } .slip .pre { white-space:pre-line; }
        .slip .totals { margin-left:auto; width:260px; margin-top:14px; } .slip .totals div { display:flex; justify-content:space-between; padding:2px 0; }
        .slip .totals .t { border-top:1.5px solid #111; margin-top:4px; padding-top:6px; font-weight:700; }
        @media print { .no-print { display:none !important; } .slip { border:0; margin:0; max-width:none; padding:0 4px; } @page { margin:14mm; } }
        @media (max-width:600px) { .slip { padding:20px 16px; } .slip .grid { grid-template-columns:1fr; } }
      `}</style>

      <div className="slip-bar no-print">
        <strong>{orders.length} packing slip{orders.length === 1 ? "" : "s"}</strong>
        <PrintButton />
        <a href={q(!prices)}>{prices ? "Hide prices" : "Show prices"}</a>
        <a href="/admin/orders">Back to orders</a>
        {missing.length > 0 && <span style={{ color: "#b00" }}>Not found: {missing.join(", ")}</span>}
      </div>

      {orders.length === 0 && <p style={{ padding: 40, textAlign: "center" }}>No orders to print. Choose orders from the Orders page.</p>}

      {orders.map((o) => {
        const c = customers.get(o.customerId)
        const units = o.items.reduce((n, i) => n + i.qty, 0)
        const s = o.ship
        return (
          <section key={o.id} className="slip" aria-label={`Packing slip for order ${o.id}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 24, alignItems: "flex-start" }}>
              <div>
                <h1>{store.name || "G4"}</h1>
                {store.address && <div className="muted pre" style={{ marginTop: 4 }}>{store.address}</div>}
                {(store.email || store.phone) && <div className="muted">{[store.email, store.phone].filter(Boolean).join(" · ")}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <h2>Packing slip</h2>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Order #{o.id}</div>
                <div className="muted">{dateLabel(o.date)}</div>
                <div style={{ marginTop: 6 }}><Barcode text={o.id} /></div>
              </div>
            </div>

            <div className="grid">
              <div>
                <h2>Ship to</h2>
                <div style={{ fontWeight: 600 }}>{c?.name ?? "Customer"}</div>
                {s ? (
                  <div className="pre">{[s.address, [s.city, s.state, s.postcode].filter(Boolean).join(", "), countryName(s.country)].filter(Boolean).join("\n")}</div>
                ) : <div className="muted">No address recorded for this order.</div>}
                {c?.email && <div className="muted">{c.email}</div>}
              </div>
              <div>
                <h2>Shipping</h2>
                <div>{s?.method || "Standard"}{s?.estimate ? ` · ${s.estimate}` : ""}</div>
                {o.tracking && <div className="muted">{o.tracking.carrier} {o.tracking.number}</div>}
                <div className="muted">{units} item{units === 1 ? "" : "s"}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr><th style={{ width: 24 }}></th><th>Item</th><th>Size</th><th>Colour</th><th className="r">Qty</th>{prices && <><th className="r">Price</th><th className="r">Total</th></>}</tr>
              </thead>
              <tbody>
                {o.items.map((i, k) => (
                  <tr key={k}>
                    <td><span className="box" /></td>
                    <td><div style={{ fontWeight: 600 }}>{i.name}</div><div className="muted" style={{ fontSize: 11 }}>{products.get(i.productId)?.sku ?? i.productId}</div></td>
                    <td>{i.size}</td>
                    <td>{i.color}</td>
                    <td className="r" style={{ fontWeight: 700 }}>{i.qty}</td>
                    {prices && <><td className="r">{money(i.price)}</td><td className="r">{money(i.price * i.qty)}</td></>}
                  </tr>
                ))}
              </tbody>
            </table>

            {prices && (
              <div className="totals">
                <div><span>Subtotal</span><span>{money(o.subtotal)}</span></div>
                {o.discount > 0 && <div><span>Discount{o.discountCode ? ` (${o.discountCode})` : ""}</span><span>−{money(o.discount)}</span></div>}
                <div><span>Shipping</span><span>{money(o.shipping)}</span></div>
                {(o.giftAmount ?? 0) > 0 && <div><span>Gift card</span><span>−{money(o.giftAmount ?? 0)}</span></div>}
                <div className="t"><span>Total</span><span>{money(o.total)}</span></div>
              </div>
            )}

            <p className="muted" style={{ marginTop: 34, borderTop: "1px solid #e3e3e0", paddingTop: 14 }}>
              Thank you for your order. If anything isn&apos;t right, contact us{store.email ? ` at ${store.email}` : ""} and we&apos;ll sort it out. Returns are covered in our returns policy on the website.
            </p>
          </section>
        )
      })}
    </div>
  )
}
