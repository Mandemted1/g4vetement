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
 * Returns is still a draft you must fill in. The terms are a complete starting point written to match how this store works,
 * but all four should be reviewed (ideally by a lawyer) before you rely on them.
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
  terms: `Last updated: 6 November 2026.

Welcome to G4. These terms cover your purchases from us and your use of this website. By placing an order or creating an account, you agree to them.

## Orders
An order is a request to buy. We confirm it by email, and it becomes a contract when we dispatch your items. We may decline or cancel an order if an item is out of stock, a price was shown in error, we cannot deliver to your address, or we suspect fraud. If we do, we will tell you and refund everything you paid, including any gift card balance.

Please check your sizes, colours and delivery address before you order. We can only change or cancel an order that has not shipped, so get in touch as soon as you can.

## Prices and payment
Prices are in US dollars and include any sale discount. Your bag shows the full total, shipping included, before you confirm. Prices may change at any time, but never after your order is placed.

Orders shipped outside our home country may be subject to import duties, customs fees or local taxes. These are not included in our prices and are your responsibility.

Payment is taken at checkout using the methods shown there.

## Sales, codes and gift cards
Sales apply automatically for the dates shown. Discount codes may carry conditions, such as a minimum spend, selected products, a validity period or one use per customer, and these are checked at checkout. We may withdraw or change a code at any time.

A gift card holds a set amount that can pay for all or part of an order, shipping included. It has no cash value, cannot be replaced if lost or shared, and cannot be used after its expiry date, if it has one. Please keep your code private. If an order paid with a gift card is cancelled or refunded, the amount is returned to the card.

## Shipping and delivery
Shipping options, prices and estimated delivery times depend on your country and are shown at checkout and on our Shipping page. Delivery times are estimates. We are not responsible for delays caused by carriers, customs or events beyond our control.

Please give us a complete and accurate address. If a parcel is returned because the address was wrong, we may charge to send it again. Where your carrier provides one, we email you a tracking number when your order ships. Your items are at your risk once they are delivered to the address you gave us.

## Returns and refunds
Our Returns page explains how to send something back and how refunds are issued. Nothing in these terms affects your legal rights as a consumer.

## Your account
You do not need an account to shop with us. If you create one, please keep your password private and let us know if you think it has been used without your permission. You are responsible for activity on your account. We may close accounts that are used to cheat or abuse the store, and you can ask us to delete yours at any time.

## Reviews
Reviews are open to customers who have received the product. They should be honest and about the product, and must not include abuse, spam, personal details or anything unlawful. When you post a review, you allow us to display it on our store and in our marketing. We may hide a review that breaks these rules, and you can edit or delete your own at any time.

## Product information
We photograph and describe our products as carefully as we can. Colours can vary between screens, and sizes may differ slightly from one piece to another. Fabric and fit notes are a guide, not a guarantee.

## Our content
All photography, text, designs and logos on this site belong to us or are used with permission. You are welcome to view and share our pages, but please do not copy, sell or reuse our content without written permission.

## Using this website
Please do not use the site for anything unlawful, to place fraudulent orders, to interfere with how it works, to collect its data automatically, or to access accounts or systems that are not yours.

## Our responsibility
We work hard to keep the store running smoothly, but we cannot promise it will always be available or free of errors. Nothing in these terms limits our liability where the law does not allow it, including for fraud, or for death or personal injury caused by our negligence. Otherwise, we are not liable for losses that were not a reasonably foreseeable result of our actions, or for loss of profit or business, and our total liability for any order is limited to the amount you paid for it.

## Privacy
Our Privacy page explains what we collect and how we use it.

## Changes to these terms
We may update these terms from time to time. The version shown here when you place an order is the one that applies to that order.

## Governing law
These terms are governed by the law of the place where our business is registered, and its courts will handle any dispute, unless the law where you live lets you bring a claim in your own country.

## Contact
Questions about these terms? Write to us at the contact email shown in the footer of this site and we will be happy to help.`,
}
