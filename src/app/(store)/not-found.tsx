import type { Metadata } from "next"
import { NotFoundContent } from "@/components/store/not-found-content"

export const metadata: Metadata = { title: "Page not found", robots: { index: false } }

/** A missing product, policy or account page inside the store: keeps the store's header and footer. */
export default function StoreNotFound() {
  return <NotFoundContent />
}
