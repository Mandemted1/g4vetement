import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AddressForm } from "@/components/store/account/address-form"
import { BackLink } from "@/components/store/back-link"
import { Rise } from "@/components/store/fx"
import { getAccount, getMyOrders } from "@/lib/account"
import { STATUS_LABEL } from "@/lib/account-types"
import { price } from "@/lib/store"
import { signOutCustomer } from "./actions"

export const metadata: Metadata = { title: "Account" }

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })

export default async function AccountPage() {
  const user = await getAccount()
  if (!user) redirect("/account/login")
  const orders = await getMyOrders(user.id)
  const first = user.name.trim().split(/\s+/)[0]

  return (
    <div className="px-5 pb-16 pt-28 md:px-8 md:pt-36">
      <BackLink fallback="/" className="-mt-3 mb-2" />
      <p className="label mb-6 text-[var(--mute)]">( Account )</p>
      <Rise as="h1" text={first ? `Hi, ${first}.` : "Your account"} className="text-[clamp(3rem,10vw,9rem)] font-medium leading-[0.85] tracking-[-0.06em]" />

      <div className="mt-14 grid gap-14 md:grid-cols-12 md:gap-8">
        <section className="md:col-span-7" aria-label="Orders">
          <p className="label text-[var(--mute)]">Orders</p>
          {orders.length === 0 ? (
            <div className="mt-6 border-y py-10">
              <p className="text-[15px] leading-relaxed">No orders yet. Orders you place while signed in will show up here.</p>
              <Link href="/shop" className="label mt-6 inline-block border border-[var(--ink)] px-6 py-3 transition-colors duration-500 hover:bg-[var(--ink)] hover:text-[var(--paper)]">Start shopping</Link>
            </div>
          ) : (
            <ul className="mt-6 divide-y border-y">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/account/orders/${o.id}`} data-cursor="VIEW" className="group grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 py-5">
                    <span className="text-[15px] font-medium tracking-tight"><span className="u">{o.id}</span></span>
                    <span className="label text-right">{price(o.total)}</span>
                    <span className="label text-[var(--mute)]">{day(o.date)} · {o.items.reduce((n, i) => n + i.qty, 0)} {o.items.reduce((n, i) => n + i.qty, 0) === 1 ? "item" : "items"}</span>
                    <span className="label text-right">{STATUS_LABEL[o.status] ?? o.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="md:col-span-4 md:col-start-9">
          <p className="label text-[var(--mute)]">Details</p>
          <p className="mt-4 text-[15px]">{user.email}</p>
          <div className="mt-8">
            <p className="label mb-3 text-[var(--mute)]">Delivery address</p>
            <AddressForm name={user.name} address={user.address} />
          </div>
          <form action={signOutCustomer} className="mt-12">
            <button className="label" data-cursor="OUT"><span className="u">Sign out</span></button>
          </form>
        </aside>
      </div>
    </div>
  )
}
