import { defaultTheme, uid, type EmailDoc } from "./types"

export const TEMPLATE_META = [
  { key: "order_confirmation", name: "Order confirmation", description: "Sent to the customer right after they place an order." },
  { key: "order_shipped", name: "Order shipped", description: "Sent when you mark an order as shipped in the admin." },
  { key: "welcome", name: "Welcome + discount code", description: "Sent when someone joins through the welcome popup or newsletter box." },
] as const

export type TemplateKey = (typeof TEMPLATE_META)[number]["key"]

interface DefaultTemplate {
  subject: string
  preheader: string
  doc: EmailDoc
}

const b = {
  heading: (text: string, size: "s" | "m" | "l" = "l") => ({ id: uid(), type: "heading" as const, text, align: "left" as const, size }),
  text: (text: string) => ({ id: uid(), type: "text" as const, text, align: "left" as const }),
  button: (label: string, url: string) => ({ id: uid(), type: "button" as const, label, url, align: "left" as const, style: "solid" as const }),
  order: () => ({ id: uid(), type: "order" as const }),
  spacer: (height = 16) => ({ id: uid(), type: "spacer" as const, height }),
  divider: () => ({ id: uid(), type: "divider" as const }),
}

export const DEFAULT_TEMPLATES: Record<TemplateKey, DefaultTemplate> = {
  order_confirmation: {
    subject: "Your G4 order {{order_id}}",
    preheader: "Thanks for your order, {{first_name}}.",
    doc: {
      theme: defaultTheme,
      blocks: [
        b.heading("Thank you, {{first_name}}."),
        b.text("We've received your order **{{order_id}}** and we're getting it ready. We'll email you again the moment it ships."),
        b.spacer(8),
        b.order(),
        b.button("Continue shopping", "{{store_url}}/shop"),
      ],
    },
  },
  order_shipped: {
    subject: "Your order {{order_id}} is on its way",
    preheader: "It's left us and it's heading to you.",
    doc: {
      theme: defaultTheme,
      blocks: [
        b.heading("It's on its way."),
        b.text("Good news, {{first_name}}. Order **{{order_id}}** has shipped."),
        b.spacer(8),
        b.order(),
        b.button("Keep browsing", "{{store_url}}/shop"),
      ],
    },
  },
  welcome: {
    subject: "Welcome to G4. Here's $10 off.",
    preheader: "Your first-order code is inside.",
    doc: {
      theme: defaultTheme,
      blocks: [
        b.heading("Welcome to G4."),
        b.text("Heavyweight basics, clean cuts. Thanks for joining the list. Here's $10 off your first order of $50 or more."),
        { id: uid(), type: "discount", code: "{{discount_code}}", note: "Applied at checkout" },
        b.button("Start shopping", "{{store_url}}/shop"),
      ],
    },
  },
}

export const DEFAULT_CAMPAIGN: { name: string; subject: string; preheader: string; doc: EmailDoc } = {
  name: "New campaign",
  subject: "New in at G4",
  preheader: "Fresh pieces just landed.",
  doc: {
    theme: defaultTheme,
    blocks: [
      b.heading("New in."),
      b.text("Fresh pieces just landed. Pick your favourites below."),
      { id: uid(), type: "products", ids: [] },
      b.button("Shop the drop", "{{store_url}}/shop"),
    ],
  },
}
