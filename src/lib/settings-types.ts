export interface LoginSettings {
  /** image URL (Cloudinary recommended); empty = plain background */
  image: string
  /** 0–0.9, how dark the layer over the image is */
  overlay: number
  layout: "full" | "split"
  tagline: string
}

export const DEFAULT_LOGIN: LoginSettings = {
  image: "",
  overlay: 0.5,
  layout: "full",
  tagline: "Sign in to manage orders, products and customers.",
}

/** Public details about the business: shown in the store footer, policy pages and email footers. */
export interface StoreSettings {
  name: string
  email: string
  phone: string
  /** multi-line; emails show it on one line */
  address: string
  /** handles only, e.g. "g4vet" (a pasted @handle or profile link is cleaned up on save) */
  instagram: string
  tiktok: string
}

export const DEFAULT_STORE: StoreSettings = { name: "G4", email: "", phone: "", address: "", instagram: "", tiktok: "" }

export const POLICY_META = [
  { slug: "shipping", title: "Shipping", blurb: "How long it takes and what it costs." },
  { slug: "returns", title: "Returns", blurb: "What shoppers can send back, and how." },
  { slug: "privacy", title: "Privacy", blurb: "What data you collect and why." },
  { slug: "terms", title: "Terms", blurb: "The rules of buying from your store." },
] as const

export type PolicySlug = (typeof POLICY_META)[number]["slug"]
export type Policies = Record<PolicySlug, string>

/**
 * Starting points. Shipping and privacy describe how the store really behaves today.
 * Returns and terms are drafts: they contain placeholders you must fill in, and all four should be reviewed
 * (ideally by a lawyer) before you rely on them.
 */
export const DEFAULT_POLICIES: Policies = {
  shipping: `## Shipping rates
Shipping depends on where your order is going. The current rates are listed below and shown at checkout before you pay.

## Processing
We pack orders as quickly as we can. You'll get an email when your order is confirmed and another when it ships.

## Questions
If something looks wrong with your order, reply to any of our emails and we'll sort it out.`,
  returns: `## Returns
[Draft. Replace this with your own policy.]

Tell shoppers how many days they have to return an item, what condition it must be in, who pays return shipping, and how refunds are issued.

## How to start a return
Email us with your order number and the item you'd like to return.`,
  privacy: `## What we collect
When you place an order we collect your name, email address and the city and state you give us, plus what you ordered. If you join our email list we collect your email address.

## How we use it
We use your details to process and confirm your order, to email you about it, and, if you joined the list, to send you news and offers. You can unsubscribe from marketing emails at any time using the link in every email.

## Visit statistics
We count visits to understand what's popular. This is anonymous: we don't use advertising cookies and don't track you across other sites.

## Who handles your data
Your information is stored with our hosting and database provider and our email provider, only to run the store. We don't sell your data.

## Your choices
To see, correct or delete your information, email us.`,
  terms: `## Terms of sale
[Draft. Replace this with your own terms.]

Cover prices and availability, how orders are accepted, payment, shipping and delivery, returns, and how to contact you.

## Contact
Use the email address in the footer of this site.`,
}
