import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { BackLink } from "@/components/store/back-link"
import { Rise } from "@/components/store/fx"
import { OrderLines } from "@/components/store/account/order-lines"
import { getAccount, getMyOrder } from "@/lib/account"
import { STATUS_LABEL } from "@/lib/account-types"
import { countryName } from "@/lib/countries"
import { price } from "@/lib/store"

export const metadata: Metadata = { title: "Order" }

const STEPS = ["pending", "processing", "shipped", "delivered"] as const
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getAccount()
  if (!user) redirect(`/account/login?next=${encodeURIComponent(`/account/orders/${id}`)}`)
  const o = await getMyOrder(user.id, id)
  if (!o) notFound()

  const step = STEPS.indexOf(o.status as (typeof STEPS)[number])
  const closed = o.status === "cancelled" || o.status === "refunded"
  const link = o.tracking && /^https?:\/\//i.test(o.tracking.url) ? o.tracking.url : ""

  return (
    <div className="px-5 pb-16 pt-28 md:px-8 md:pt-36">
      <BackLink fallback="/account" className="-mt-3 mb-2" />
      <p className="label mb-6 text-[var(--mute)]">( Order · {day(o.date)} )</p>
      <Rise as="h1" text={o.id} className="text-[clamp(3rem,10vw,9rem)] font-medium leading-[0.85] tracking-[-0.06em]" />

      <div className="mt-14 grid gap-14 md:grid-cols-12 md:gap-8">
        <section className="md:col-span-7" aria-label="Items">
          <OrderLines order={o} canReview={o.status === "shipped" || o.status === "delivered"} />
          <dl className="label mt-5 space-y-2">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{price(o.subtotal + (o.saleDiscount ?? 0))}</dd></div>
            {(o.saleDiscount ?? 0) > 0 && <div className="flex justify-between"><dt>Sale</dt><dd>−{price(o.saleDiscount ?? 0)}</dd></div>}
            {o.discount > 0 && <div className="flex justify-between"><dt>Discount{o.discountCode ? ` (${o.discountCode})` : ""}</dt><dd>−{price(o.discount)}</dd></div>}
            <div className="flex justify-between"><dt>Shipping{o.ship?.method ? ` (${o.ship.method})` : ""}</dt><dd>{o.shipping ? price(o.shipping) : "Free"}</dd></div>
            <div className="flex justify-between text-[12px]"><dt>Total</dt><dd>{price(o.total)}</dd></div>
          </dl>
        </section>

        <aside className="space-y-10 md:col-span-4 md:col-start-9">
          <div>
            <p className="label text-[var(--mute)]">Status</p>
            <p className="mt-3 text-2xl font-medium tracking-tight">{STATUS_LABEL[o.status] ?? o.status}</p>
            {!closed && step >= 0 && (
              <ol className="mt-5 grid grid-cols-4 gap-1.5" aria-label="Progress">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex flex-col gap-2">
                    <span className={`h-px w-full ${i <= step ? "bg-[var(--ink)]" : "bg-[var(--line)]"}`} />
                    <span className={`label text-[9px] ${i <= step ? "" : "text-[var(--mute)]"}`}>{i === 0 ? "Received" : i === 1 ? "Preparing" : i === 2 ? "Shipped" : "Delivered"}</span>
                  </li>
                ))}
              </ol>
            )}
            {o.ship?.estimate && !closed && o.status !== "delivered" && <p className="label mt-4 text-[var(--mute)]">Estimated delivery: {o.ship.estimate}</p>}
          </div>

          {o.tracking && (
            <div>
              <p className="label text-[var(--mute)]">Tracking{o.tracking.carrier ? ` · ${o.tracking.carrier}` : ""}</p>
              <p className="mt-3 break-all font-mono text-[15px]">{o.tracking.number}</p>
              {link && (
                <a href={link} target="_blank" rel="noopener noreferrer" data-cursor="TRACK" className="label group relative mt-4 inline-block overflow-hidden bg-[var(--ink)] px-6 py-3 text-[var(--paper)]">
                  <span className="absolute inset-0 origin-bottom scale-y-0 bg-[var(--paper)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100" />
                  <span className="relative mix-blend-difference">Track your package</span>
                </a>
              )}
            </div>
          )}

          {o.ship && (
            <div>
              <p className="label text-[var(--mute)]">Delivering to</p>
              <address className="mt-3 text-[14px] not-italic leading-relaxed">
                <div>{user.name}</div>
                {o.ship.address && <div>{o.ship.address}</div>}
                <div>{[o.ship.city, o.ship.state, o.ship.postcode].filter(Boolean).join(", ")}</div>
                {o.ship.country && <div>{countryName(o.ship.country)}</div>}
              </address>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
