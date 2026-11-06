/**
 * Product search for the storefront and admin: every word you type has to match something on the product
 * (name, category, colour, code, description…). Understands plurals ("tees"), small typos ("hoddie"),
 * and everyday words ("pants", "t-shirt"). Pure and instant, so it runs in the browser over the whole catalog.
 */

export interface Searchable {
  name: string
  sku: string
  category: string
  colors: { name: string }[]
  description: string
  fabric: string
  fit: string
  stock: number
}

/** what shoppers say -> what the catalog says (both sides are stemmed first, so plurals are already handled) */
const SYNONYMS: Record<string, string[]> = {
  tshirt: ["tee"], shirt: ["tee", "longsleeve"], top: ["tee", "hoodie", "sweatshirt"],
  sweater: ["sweatshirt", "crewneck"], jumper: ["sweatshirt", "crewneck"], pullover: ["hoodie", "sweatshirt"],
  pant: ["trouser", "cargo", "jogger", "denim", "jean"], trouser: ["pant"], jean: ["denim"], sweatpant: ["jogger"], bottom: ["trouser", "cargo", "jogger", "denim", "short"],
  hat: ["cap", "beanie"], bag: ["tote"], coat: ["puffer", "jacket", "bomber"], jacket: ["coach", "bomber", "puffer"],
  gray: ["grey"], grey: ["gray"], tan: ["sand"], cream: ["off", "white"],
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/t[\s-]shirt/g, "tshirt")
const stem = (w: string) => (w.length > 3 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w)
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean).map(stem)

/** true when a and b differ by at most one inserted, removed or changed letter (or a swap of two neighbours) */
function withinOne(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true // one letter changed
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2) // two letters swapped
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i)
}

/** 1 = whole word, 0.8 = start of a word, 0.5 = a typo away, 0 = no match */
function wordScore(token: string, w: string): number {
  if (w === token) return 1
  if (w.startsWith(token)) return 0.8
  if (token.length >= 4 && (withinOne(token, w) || withinOne(token, w.slice(0, token.length)))) return 0.5
  return 0
}

interface Field { weight: number; words: string[] }
const fieldsOf = (p: Searchable, codes: boolean): Field[] => [
  { weight: 10, words: words(p.name) },
  { weight: 6, words: words(p.category) },
  { weight: 5, words: p.colors.flatMap((c) => words(c.name)) },
  ...(codes ? [{ weight: 4, words: words(p.sku) }] : []),
  { weight: 2, words: words(`${p.description} ${p.fabric} ${p.fit}`) },
]

function tokenScore(fields: Field[], token: string): number {
  const alternatives = [{ t: token, k: 1 }, ...(SYNONYMS[token] ?? []).map((t) => ({ t, k: 0.8 }))]
  let best = 0
  for (const f of fields) for (const w of f.words) for (const a of alternatives) best = Math.max(best, f.weight * a.k * wordScore(a.t, w))
  return best
}

/**
 * Products matching every word of the query, best match first (in stock before sold out on ties). An empty query matches nothing.
 * Product codes (SKUs) are internal, so only the admin searches them (`codes: true`); shoppers never see them on a card.
 */
export function searchProducts<T extends Searchable>(list: T[], query: string, opts: { codes?: boolean } = {}): T[] {
  const tokens = words(query)
  if (tokens.length === 0) return []
  const phrase = norm(query).trim()
  const scored: { p: T; score: number; i: number }[] = []
  list.forEach((p, i) => {
    const fields = fieldsOf(p, !!opts.codes)
    let total = 0
    for (const t of tokens) {
      const s = tokenScore(fields, t)
      if (s === 0) return // every word must match
      total += s
    }
    if (norm(p.name).startsWith(phrase)) total += 3
    scored.push({ p, score: total, i })
  })
  return scored
    .sort((a, b) => b.score - a.score || Number(b.p.stock > 0) - Number(a.p.stock > 0) || a.i - b.i)
    .map((x) => x.p)
}
