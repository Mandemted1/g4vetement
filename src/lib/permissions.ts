/**
 * Staff roles and what each may do. This matrix is mirrored in the database (role_can() in supabase/schema.sql), which is
 * what actually enforces it; scripts/test-permissions.mts checks the two always agree. Here it drives the admin menu,
 * page guards and clear error messages.
 *
 * Everyone on the team can LOOK at orders, products and customers. The capabilities below are for changing things.
 */

export const ROLES = ["owner", "manager", "fulfilment", "viewer"] as const
export type Role = (typeof ROLES)[number]

export const CAPS = [
  "orders.manage", // change order status, add tracking, cancel, print packing slips
  "products.manage", // products, stock, categories, photos, product import
  "marketing.manage", // discount codes, sales, emails, campaigns, subscribers, abandoned carts
  "giftcards.manage", // issue and adjust gift cards
  "reviews.manage", // hide or delete reviews
  "analytics.view", // visitor analytics
  "settings.manage", // store details, shipping, policies, notifications, login screen
  "staff.manage", // add, change and remove team members
  "data.export", // download CSV exports
] as const
export type Cap = (typeof CAPS)[number]

const MATRIX: Record<Role, readonly Cap[]> = {
  owner: CAPS,
  manager: ["orders.manage", "products.manage", "marketing.manage", "giftcards.manage", "reviews.manage", "analytics.view", "data.export"],
  fulfilment: ["orders.manage"],
  viewer: ["analytics.view"],
}

export const ROLE_INFO: Record<Role, { label: string; summary: string }> = {
  owner: { label: "Owner", summary: "Everything, including settings and the team." },
  manager: { label: "Manager", summary: "Runs the store day to day: orders, products, marketing, gift cards, reviews and exports. Can't change settings or the team." },
  fulfilment: { label: "Fulfilment", summary: "Packs and ships: sees orders, products and customers, and can update orders and print packing slips." },
  viewer: { label: "Viewer", summary: "Read only: can look at orders, products, customers and analytics, but change nothing." },
}

export const isRole = (r: unknown): r is Role => typeof r === "string" && (ROLES as readonly string[]).includes(r)

/** What a role can do. A person with no role (not on the team) can do nothing. */
export const roleCan = (role: Role | null | undefined, cap: Cap): boolean => (isRole(role) ? MATRIX[role].includes(cap) : false)
export const capsOf = (role: Role | null | undefined): Cap[] => (isRole(role) ? [...MATRIX[role]] : [])

/** Plain-English name for a capability, for error messages. */
export const CAP_LABEL: Record<Cap, string> = {
  "orders.manage": "manage orders",
  "products.manage": "change products",
  "marketing.manage": "manage discounts and emails",
  "giftcards.manage": "manage gift cards",
  "reviews.manage": "moderate reviews",
  "analytics.view": "view analytics",
  "settings.manage": "change store settings",
  "staff.manage": "manage the team",
  "data.export": "export data",
}

export const deniedMessage = (cap: Cap) => `Your role doesn't allow you to ${CAP_LABEL[cap]}. Ask an owner if you need access.`
