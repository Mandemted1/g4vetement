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
  { slug: "size-guide", title: "Size guide", blurb: "Measurements and fit notes to help shoppers choose a size." },
  { slug: "shipping", title: "Shipping", blurb: "How long it takes and what it costs." },
  { slug: "returns", title: "Returns", blurb: "What shoppers can send back, and how." },
  { slug: "faq", title: "FAQ", blurb: "Answers to the questions shoppers ask most." },
  { slug: "privacy", title: "Privacy", blurb: "What data you collect and why." },
  { slug: "terms", title: "Terms", blurb: "The rules of buying from your store." },
] as const

/** Help pages are labelled "Help" rather than "Policies" on the store. */
export const HELP_PAGES: readonly string[] = ["size-guide", "faq"]

export type PolicySlug = (typeof POLICY_META)[number]["slug"]
export type Policies = Record<PolicySlug, string>

/**
 * Starting points. Shipping and privacy describe how the store really behaves today.
 * Written to match how this store works (store credit returns, regional shipping, gift cards, accounts). The size charts are typical
 * measurements: check them against your own garments. Returns, privacy and terms should be reviewed by a lawyer before you rely on them.
 */
export const DEFAULT_POLICIES: Policies = {
  "size-guide": `Find your best fit with the charts below. Measurements are of your body, not the garment. If you are between sizes, size up for a relaxed fit and stay true to size for a closer one.

## How to measure
- Chest or bust: around the fullest part, keeping the tape level under your arms.
- Waist: around your natural waist, the narrowest part of your torso.
- Hips: around the fullest part of your hips.
Stand relaxed and keep the tape snug, not tight.

## Men's tops
For tees, long sleeves, hoodies, sweatshirts and jackets.

| Size | Chest (cm) | Waist (cm) | Chest (in) | Waist (in) |
| S | 91 to 96 | 76 to 81 | 36 to 38 | 30 to 32 |
| M | 97 to 102 | 82 to 87 | 38 to 40 | 32 to 34 |
| L | 103 to 108 | 88 to 93 | 41 to 43 | 35 to 37 |
| XL | 109 to 114 | 94 to 99 | 43 to 45 | 37 to 39 |

## Men's bottoms
For cargos, jeans, trousers and shorts. Numbered sizes are your waist size in inches.

| Size | Waist (cm) | Hips (cm) | Waist (in) | Hips (in) |
| 28 | 71 | 91 | 28 | 36 |
| 30 | 76 | 96 | 30 | 38 |
| 32 | 81 | 101 | 32 | 40 |
| 34 | 86 | 106 | 34 | 42 |
| 36 | 91 | 111 | 36 | 44 |

Where a piece comes in letter sizes, S fits a 28 to 30 waist, M a 31 to 32, L a 33 to 34 and XL a 35 to 36.

## Women's
For tops, bottoms, skirts and sweatshirts.

| Size | Bust (cm) | Waist (cm) | Hips (cm) | Bust (in) | Waist (in) | Hips (in) |
| S | 82 to 86 | 62 to 66 | 88 to 92 | 32 to 34 | 24 to 26 | 35 to 36 |
| M | 87 to 91 | 67 to 71 | 93 to 97 | 34 to 36 | 26 to 28 | 37 to 38 |
| L | 92 to 97 | 72 to 77 | 98 to 103 | 36 to 38 | 28 to 30 | 39 to 41 |
| XL | 98 to 103 | 78 to 83 | 104 to 109 | 39 to 40 | 31 to 33 | 41 to 43 |

## Our fit notes
Every product page has a fit note. This is what each one means.
- Slim: close to the body. Size up for a looser fit.
- Regular: true to size, with room to move.
- Relaxed: a little more room through the body and legs.
- Oversized or boxy: cut roomy with a dropped shoulder. True to size for the intended look, size down for a closer fit.
- Bodycon: very close to the body, with stretch.

## Still not sure?
Email us your height, your usual size and the piece you are looking at, and we will help you choose.`,
  faq: `Answers to the questions we hear most. Cannot find yours? Email us and we will reply as soon as we can.

## Do I need an account to order?
No. You can check out as a guest. An account keeps your orders, tracking and delivery address in one place and lets you review the products you have bought.

## How do I use a discount code or gift card?
In your bag, choose Add a discount code or Add a gift card, enter the code and apply it. You can use one of each on an order. A gift card pays for part or all of your total, shipping included.

## Where do you ship, and what does it cost?
We ship to the countries shown at checkout. Choose your country in your bag to see the price and delivery time before you pay. The full details are on our Shipping page.

## How long will my order take?
We pack orders as quickly as we can. Delivery time depends on your country and is shown in your bag. We email you a tracking number as soon as your order ships.

## How can I track my order?
Your shipping email includes a tracking number and a link. If you have an account, your order page shows it too.

## Can I change or cancel my order?
If it has not shipped, yes. Email us straight away with your order number and we will take care of it.

## Will I have to pay customs or import duties?
Orders sent outside our home country may be charged duties or taxes by your country. These are not included in our prices and are paid by you. Your local customs office can tell you what to expect.

## How do returns work?
You have 30 days from delivery to return unworn items with the tags attached. Approved returns are issued as store credit, which does not expire. Our Returns page has the full detail.

## Can I get a refund instead of store credit?
Store credit is our standard. If an item is faulty or incorrect, or if we agree it with you, we can refund to your original payment method. See our Returns page.

## How do I find my size?
Use our Size guide for measurements in centimetres and inches, and check the fit note on each product page. If you are between sizes, size up for a relaxed fit and stay true to size for a closer one.

## How should I care for my pieces?
Wash cold, inside out, with similar colours, and dry flat or hang to dry. Washed and garment dyed pieces can soften and fade a little over time, which is part of the look. Always check the label on your item for specific instructions.

## Are the colours accurate?
We photograph our pieces in natural light and match colours as closely as we can, but screens vary. If you are unsure about a shade, email us and we will describe it.

## How do I know my order went through?
You receive a confirmation email straight away. If it does not arrive, check your spam folder or email us and we will look into it. Customers with an account can see every order there.

## I forgot my password. What should I do?
Email us and we will help you get back into your account.

## How do I contact you?
Use the contact email shown in the footer of this site. We reply as soon as we can.`,
  shipping: `## Shipping rates
Shipping depends on where your order is going. The current rates are listed below and shown at checkout before you pay.

## Processing
We pack orders as quickly as we can. You'll get an email when your order is confirmed and another when it ships.

## Questions
If something looks wrong with your order, reply to any of our emails and we'll sort it out.`,
  returns: `Last updated: 6 November 2026.

We want you to love everything you order. If something is not right, this page explains how returns, exchanges and store credit work.

## Our returns window
You have 30 days from the day your order is delivered to start a return.

## What can be returned
Items must be unworn, unwashed and in their original condition, with all tags attached. For hygiene reasons we cannot take back socks, and items marked as final sale are not returnable. Gift cards cannot be returned.

Sale items can be returned like any other. You will receive credit for the amount you paid, after any discounts.

## How to return an item
- Email us with your order number and the items you would like to return.
- We will reply within 2 business days with your return instructions and address.
- Pack the items in their original packaging and send them back. Please keep your proof of postage.

## Store credit
Store credit is how we handle approved returns. Once your return arrives and has been checked, usually within 5 business days, we email you a gift card for the full value of the items. It can be used on any future order, shipping included, and it does not expire.

## Refunds
Returns are issued as store credit by default. Where we agree to a refund, for example when an item is faulty or we have confirmed one with you in writing, the money goes back to your original payment method and usually appears within 5 to 10 business days. Anything you paid with a gift card goes back onto that card.

## Exchanges
Need a different size or colour? Tell us in your return email. If the new item is in stock, we will send it as soon as your return is on its way, and we cover the shipping of the replacement.

## Return shipping
You cover the cost of sending a return back to us. If the item is faulty, damaged or not what you ordered, we cover it and send you a prepaid label. Original shipping charges are not refunded, and neither are any duties or taxes charged by your country, unless we cancel your order or the law says otherwise.

## Faulty or incorrect items
If something arrives damaged or not as ordered, email us within 14 days of delivery with a photo. We will replace it, credit it or refund it, whichever suits you best.

## Cancelling an order
We can cancel an order that has not shipped. Email us as soon as you can and we will refund it in full to the way you paid.

## Contact
Questions about a return? Write to us at the contact email shown in the footer of this site and we will be happy to help.`,
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
