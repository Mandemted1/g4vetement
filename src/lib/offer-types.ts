export interface WelcomeOffer {
  code: string
  kind: "percent" | "fixed" | "free_shipping"
  value: number
  minSpend: number
  firstOrderOnly: boolean
}

/** "$10 off", "10% off" or "Free shipping". */
export const offerHeadline = (o: Pick<WelcomeOffer, "kind" | "value">) => (o.kind === "percent" ? `${o.value}% off` : o.kind === "fixed" ? `$${o.value} off` : "Free shipping")

export const offerFinePrint = (o: Pick<WelcomeOffer, "minSpend" | "firstOrderOnly">) =>
  [o.firstOrderOnly ? "First orders only" : "", o.minSpend > 0 ? `Valid on bags over $${o.minSpend}` : ""].filter(Boolean).join(". ")
