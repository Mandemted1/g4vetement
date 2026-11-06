import { cloudinaryUrl } from "@/lib/images"
import type { Block, EmailDoc } from "./types"

/** One line of an order, as shown in order emails. */
export interface OrderLine {
  name: string
  color: string
  size: string
  qty: number
  price: number
  image?: string
}
export interface OrderInfo {
  items: OrderLine[]
  subtotal: number
  discount: number
  shipping: number
  total: number
}
export interface ProductLite {
  id: string
  name: string
  price: number
  /** shown struck through when higher than price (a sale) */
  listPrice?: number
  image?: string
  color: string
}

export interface RenderContext {
  vars: Record<string, string>
  storeUrl: string
  address: string
  /** marketing emails carry an unsubscribe link, transactional ones a short reason instead. */
  kind: "marketing" | "transactional"
  unsubscribeUrl?: string
  /** shown as the brand mark and in the footer; defaults to G4 */
  storeName?: string
  products?: ProductLite[]
  order?: OrderInfo
}

const FONT = "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif"
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const usd = (n: number) => `$${n}`

/** Replace {{vars}} (values are escaped) in already-escaped text. */
function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => esc(vars[k] ?? ""))
}
/** Plain text -> safe inline HTML: escapes, fills variables, **bold**, line breaks. */
function rich(text: string, vars: Record<string, string>) {
  return fill(esc(text), vars).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")
}
/** URLs: variables filled raw (not HTML-escaped as text), then attribute-escaped. Only http(s)/mailto/relative allowed. */
function url(u: string, c: RenderContext) {
  const filled = u.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => c.vars[k] ?? "")
  const abs = filled.startsWith("/") ? c.storeUrl + filled : filled
  return /^(https?:|mailto:)/i.test(abs) ? esc(abs) : "#"
}

function block(b: Block, d: EmailDoc, c: RenderContext): string {
  const { ink, mute } = d.theme
  switch (b.type) {
    case "heading": {
      const size = { s: 22, m: 32, l: 44 }[b.size]
      return `<tr><td style="padding:10px 32px;text-align:${b.align};font-family:${FONT};color:${ink};font-size:${size}px;line-height:1.08;letter-spacing:-0.03em;font-weight:600;">${rich(b.text, c.vars)}</td></tr>`
    }
    case "text":
      return `<tr><td style="padding:8px 32px;text-align:${b.align};font-family:${FONT};color:${ink};font-size:15px;line-height:1.6;">${rich(b.text, c.vars)}</td></tr>`
    case "image": {
      if (!b.url) return `<tr><td style="padding:10px 32px;"><div style="background:#e2e1dc;color:${mute};font-family:${MONO};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;text-align:center;padding:60px 0;">Image</div></td></tr>`
      const src = cloudinaryUrl(b.url.startsWith("/") ? c.storeUrl + b.url : b.url, { w: 1072, f: "jpg", ar: false })
      const img = `<img src="${esc(src)}" alt="${esc(b.alt)}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;">`
      return `<tr><td style="padding:10px 32px;">${b.link ? `<a href="${url(b.link, c)}">${img}</a>` : img}</td></tr>`
    }
    case "button": {
      const solid = b.style === "solid"
      return `<tr><td style="padding:14px 32px;text-align:${b.align};"><a href="${url(b.url, c)}" style="display:inline-block;padding:15px 30px;font-family:${MONO};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;${solid ? `background:${ink};color:${d.theme.card};` : `border:1px solid ${ink};color:${ink};`}">${esc(b.label)}</a></td></tr>`
    }
    case "divider":
      return `<tr><td style="padding:14px 32px;"><div style="border-top:1px solid #d9d7d0;font-size:0;line-height:0;">&nbsp;</div></td></tr>`
    case "spacer":
      return `<tr><td style="height:${Math.max(4, Math.min(120, b.height))}px;font-size:0;line-height:0;">&nbsp;</td></tr>`
    case "discount":
      return `<tr><td style="padding:14px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px dashed ${ink};"><tr><td align="center" style="padding:22px 12px;"><div style="font-family:${FONT};font-size:30px;font-weight:600;letter-spacing:-0.02em;color:${ink};">${rich(b.code, c.vars)}</div><div style="margin-top:8px;font-family:${MONO};font-size:10px;letter-spacing:0.09em;text-transform:uppercase;color:${mute};">${rich(b.note, c.vars)}</div></td></tr></table></td></tr>`
    case "products": {
      const list = (b.ids.map((id) => c.products?.find((p) => p.id === id)).filter(Boolean) as ProductLite[]).slice(0, 6)
      if (!list.length) return `<tr><td style="padding:10px 32px;"><div style="background:#e2e1dc;color:${mute};font-family:${MONO};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;text-align:center;padding:40px 0;">Pick products</div></td></tr>`
      const cell = (p: ProductLite) => {
        const href = esc(`${c.storeUrl}/product/${p.id}`)
        const pic = p.image
          ? `<img src="${esc(cloudinaryUrl(p.image.startsWith("/") ? c.storeUrl + p.image : p.image, { w: 512, f: "jpg" }))}" alt="${esc(p.name)}" width="256" style="display:block;width:100%;height:auto;border:0;">`
          : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e2e1dc;"><tr><td align="center" valign="middle" height="220" style="height:220px;"><div style="width:64px;height:64px;background:${esc(p.color)};border:1px solid rgba(13,13,13,0.2);font-size:0;line-height:0;">&nbsp;</div></td></tr></table>`
        return `<td class="col" width="50%" valign="top" style="padding:0 6px 18px;"><a href="${href}" style="text-decoration:none;color:${ink};">${pic}<div style="padding-top:10px;font-family:${FONT};font-size:14px;color:${ink};">${esc(p.name)}</div><div style="padding-top:3px;font-family:${MONO};font-size:11px;letter-spacing:0.06em;color:${mute};">${p.listPrice && p.listPrice > p.price ? `<span style="text-decoration:line-through;opacity:0.6;margin-right:6px;">${usd(p.listPrice)}</span>` : ""}${usd(p.price)}</div></a></td>`
      }
      const rows: string[] = []
      for (let i = 0; i < list.length; i += 2) rows.push(`<tr>${cell(list[i])}${list[i + 1] ? cell(list[i + 1]) : '<td class="col" width="50%"></td>'}</tr>`)
      return `<tr><td style="padding:10px 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table></td></tr>`
    }
    case "order": {
      const o = c.order
      if (!o) return `<tr><td style="padding:10px 32px;"><div style="background:#e2e1dc;color:${mute};font-family:${MONO};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;text-align:center;padding:40px 0;">Order summary appears here</div></td></tr>`
      const line = (l: OrderLine) =>
        `<tr><td style="padding:14px 0;border-bottom:1px solid #d9d7d0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${l.image ? `<td width="64" valign="top"><img src="${esc(cloudinaryUrl(l.image.startsWith("/") ? c.storeUrl + l.image : l.image, { w: 112, f: "jpg" }))}" width="56" alt="" style="display:block;border:0;"></td>` : ""}<td valign="top" style="font-family:${FONT};font-size:14px;color:${ink};">${esc(l.name)}<div style="padding-top:4px;font-family:${MONO};font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:${mute};">${esc(l.color)} / ${esc(l.size)} / Qty ${l.qty}</div></td><td align="right" valign="top" style="font-family:${MONO};font-size:12px;color:${ink};">${usd(l.price * l.qty)}</td></tr></table></td></tr>`
      const sum = (label: string, v: string, bold = false) =>
        `<tr><td style="padding:5px 0;font-family:${MONO};font-size:${bold ? 12 : 11}px;letter-spacing:0.08em;text-transform:uppercase;color:${bold ? ink : mute};">${label}</td><td align="right" style="padding:5px 0;font-family:${MONO};font-size:${bold ? 12 : 11}px;color:${ink};">${v}</td></tr>`
      return `<tr><td style="padding:10px 32px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #d9d7d0;">${o.items.map(line).join("")}</table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">${sum("Subtotal", usd(o.subtotal))}${o.discount ? sum("Discount", "−" + usd(o.discount)) : ""}${sum("Shipping", o.shipping ? usd(o.shipping) : "Free")}${sum("Total", usd(o.total), true)}</table></td></tr>`
    }
  }
}

export function renderEmail(doc: EmailDoc, ctx: RenderContext, meta: { subject: string; preheader?: string }): { html: string; text: string } {
  const { bg, card, ink, mute } = doc.theme
  const marketing = ctx.kind === "marketing"
  const brand = esc(ctx.storeName || "G4")
  const footer = marketing
    ? `You&apos;re receiving this because you subscribed to ${brand}.${ctx.unsubscribeUrl ? ` <a href="${esc(ctx.unsubscribeUrl)}" style="color:${mute};text-decoration:underline;">Unsubscribe</a>` : ""}`
    : `You&apos;re receiving this because you placed an order at ${brand}.`
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(fill(esc(meta.subject), ctx.vars).replace(/&amp;/g, "&"))}</title><style>@media only screen and (max-width:620px){.wrap{width:100%!important}.col{display:block!important;width:100%!important;box-sizing:border-box}}</style></head><body style="margin:0;padding:0;background:${bg};">${meta.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${rich(meta.preheader, ctx.vars)}&#8199;&#847;&#8199;&#847;</div>` : ""}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};"><tr><td align="center" style="padding:28px 12px;"><table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${card};"><tr><td style="padding:34px 32px 18px;font-family:${FONT};font-size:34px;font-weight:700;letter-spacing:-0.07em;color:${ink};"><a href="${esc(ctx.storeUrl)}" style="color:${ink};text-decoration:none;">${brand}</a></td></tr>${doc.blocks.map((b) => block(b, doc, ctx)).join("")}<tr><td style="padding:34px 32px 30px;font-family:${MONO};font-size:10px;letter-spacing:0.07em;line-height:1.7;text-transform:uppercase;color:${mute};border-top:1px solid #d9d7d0;">${footer}${ctx.address ? `<br>${esc(ctx.address)}` : ""}</td></tr></table></td></tr></table></body></html>`
  return { html, text: toText(doc, ctx, meta.subject) }
}

function toText(doc: EmailDoc, c: RenderContext, subject: string): string {
  const plain = (s: string) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => c.vars[k] ?? "").replace(/\*\*(.+?)\*\*/g, "$1")
  const out: string[] = [plain(subject), ""]
  for (const b of doc.blocks) {
    if (b.type === "heading" || b.type === "text") out.push(plain(b.text), "")
    else if (b.type === "button") out.push(`${b.label}: ${plain(b.url)}`, "")
    else if (b.type === "discount") out.push(`Code: ${plain(b.code)} (${plain(b.note)})`, "")
    else if (b.type === "products") out.push(...(b.ids.map((id) => c.products?.find((p) => p.id === id)).filter(Boolean) as ProductLite[]).map((p) => `${p.name} ${usd(p.price)} ${c.storeUrl}/product/${p.id}`), "")
    else if (b.type === "order" && c.order) out.push(...c.order.items.map((l) => `${l.qty} x ${l.name} (${l.color}/${l.size}) ${usd(l.price * l.qty)}`), `Total ${usd(c.order.total)}`, "")
  }
  out.push(c.kind === "marketing" && c.unsubscribeUrl ? `Unsubscribe: ${c.unsubscribeUrl}` : "", c.address)
  return out.join("\n").trim()
}
