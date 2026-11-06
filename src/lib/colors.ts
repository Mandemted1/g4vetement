/** Colour helpers for the product editor: a named palette, parsing of typed codes, and name detection. */

export interface NamedColor {
  name: string
  hex: string
}

/** Ready-made colours. The first eight are the ones the catalog already uses, so existing products detect to the same names. */
export const PALETTE: NamedColor[] = [
  { name: "Black", hex: "#141414" },
  { name: "Off White", hex: "#f1efe9" },
  { name: "Sand", hex: "#d4c5a3" },
  { name: "Olive", hex: "#5b6140" },
  { name: "Navy", hex: "#1f2a44" },
  { name: "Heather Grey", hex: "#a3a3a3" },
  { name: "Chocolate", hex: "#4a3328" },
  { name: "Indigo", hex: "#2f3e5c" },
  { name: "White", hex: "#ffffff" },
  { name: "Cream", hex: "#efe6d2" },
  { name: "Stone", hex: "#b5ada0" },
  { name: "Tan", hex: "#b89b72" },
  { name: "Khaki", hex: "#9b946b" },
  { name: "Brown", hex: "#6b4a32" },
  { name: "Charcoal", hex: "#36373a" },
  { name: "Grey", hex: "#808080" },
  { name: "Silver", hex: "#c8c8c8" },
  { name: "Red", hex: "#c1272d" },
  { name: "Burgundy", hex: "#6d1f2f" },
  { name: "Rust", hex: "#a4472a" },
  { name: "Orange", hex: "#e07a2f" },
  { name: "Mustard", hex: "#d4a017" },
  { name: "Yellow", hex: "#f2d049" },
  { name: "Sage", hex: "#9caf88" },
  { name: "Green", hex: "#3f8f4f" },
  { name: "Forest Green", hex: "#24402b" },
  { name: "Teal", hex: "#1f7a7a" },
  { name: "Sky Blue", hex: "#8fbfe0" },
  { name: "Blue", hex: "#2f5fb3" },
  { name: "Lilac", hex: "#b7a6d1" },
  { name: "Purple", hex: "#5b3a7a" },
  { name: "Pink", hex: "#e8a1b5" },
]

const HEX6 = /^[0-9a-f]{6}$/i
const HEX3 = /^[0-9a-f]{3}$/i
const RGB = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+\s*)?\)$/i

const byName = new Map(PALETTE.map((c) => [c.name.toLowerCase(), c.hex]))

/**
 * Turns what someone typed into "#rrggbb", or null if it isn't a colour.
 * Accepts: #1f2a44, 1f2a44, #abc, rgb(31, 42, 68), and palette names like "navy".
 */
export function parseColor(input: string): string | null {
  const t = input.trim()
  if (!t) return null
  const named = byName.get(t.toLowerCase())
  if (named) return named
  const bare = t.replace(/^#/, "")
  if (HEX6.test(bare)) return `#${bare.toLowerCase()}`
  if (HEX3.test(bare)) return `#${bare.split("").map((c) => c + c).join("").toLowerCase()}`
  const m = RGB.exec(t)
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map(Number)
    if (r > 255 || g > 255 || b > 255) return null
    return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")
  }
  return null
}

const toRgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

/** sRGB -> CIE Lab, so "nearest" matches how the eye sees colour (not raw RGB distance). */
function lab(hex: string): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = toRgb(hex).map(lin)
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

const paletteLab = PALETTE.map((c) => ({ ...c, lab: lab(c.hex) }))

/** The palette colour closest to a hex, and how far off it is (smaller = closer; under ~6 is practically the same). */
export function nearestColor(hex: string): { name: string; distance: number } {
  const [l, a, b] = lab(hex)
  let best = { name: PALETTE[0].name, distance: Infinity }
  for (const c of paletteLab) {
    const d = Math.sqrt((l - c.lab[0]) ** 2 + (a - c.lab[1]) ** 2 + (b - c.lab[2]) ** 2)
    if (d < best.distance) best = { name: c.name, distance: d }
  }
  return best
}

export const nearestColorName = (hex: string) => nearestColor(hex).name

/** True for dark colours, so text/icons drawn on top can switch to white. */
export const isDark = (hex: string) => lab(hex)[0] < 55
