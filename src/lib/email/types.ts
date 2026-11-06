export type Align = "left" | "center" | "right"

export type Block =
  | { id: string; type: "heading"; text: string; align: Align; size: "s" | "m" | "l" }
  | { id: string; type: "text"; text: string; align: Align }
  | { id: string; type: "image"; url: string; alt: string; link: string }
  | { id: string; type: "button"; label: string; url: string; align: Align; style: "solid" | "outline" }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height: number }
  | { id: string; type: "discount"; code: string; note: string }
  | { id: string; type: "products"; ids: string[] }
  | { id: string; type: "order" }

export type BlockType = Block["type"]

export interface EmailTheme {
  bg: string
  card: string
  ink: string
  mute: string
}

export interface EmailDoc {
  theme: EmailTheme
  blocks: Block[]
}

/** Values available to `{{variables}}` in any text. */
export const VARIABLES = [
  { key: "first_name", label: "First name", sample: "Alex" },
  { key: "name", label: "Full name", sample: "Alex Morgan" },
  { key: "order_id", label: "Order number", sample: "G4-2048" },
  { key: "total", label: "Order total", sample: "$96.00" },
  { key: "discount_code", label: "Discount code", sample: "WELCOME10" },
  { key: "store_url", label: "Store link", sample: "https://g4.store" },
] as const

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
  discount: "Discount code",
  products: "Products",
  order: "Order summary",
}

export const defaultTheme: EmailTheme = { bg: "#ebeae6", card: "#f3f2ef", ink: "#0d0d0d", mute: "#7c7a74" }

export const uid = () => Math.random().toString(36).slice(2, 9)

export function newBlock(type: BlockType): Block {
  const id = uid()
  switch (type) {
    case "heading": return { id, type, text: "Your headline", align: "left", size: "m" }
    case "text": return { id, type, text: "Write something here. Use **bold** for emphasis.", align: "left" }
    case "image": return { id, type, url: "", alt: "", link: "" }
    case "button": return { id, type, label: "Shop now", url: "{{store_url}}/shop", align: "left", style: "solid" }
    case "divider": return { id, type }
    case "spacer": return { id, type, height: 24 }
    case "discount": return { id, type, code: "WELCOME10", note: "Use at checkout." }
    case "products": return { id, type, ids: [] }
    case "order": return { id, type }
  }
}
