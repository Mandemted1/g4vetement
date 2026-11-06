/** Checks colour parsing and name detection for the product editor.   npm run test-colors */
import { PALETTE, nearestColor, nearestColorName, parseColor } from "../src/lib/colors"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}

// ---- parsing what people type
ok("#hex", parseColor("#1F2A44") === "#1f2a44")
ok("hex without the #", parseColor("1f2a44") === "#1f2a44")
ok("3-digit hex expands", parseColor("#abc") === "#aabbcc" && parseColor("0f0") === "#00ff00")
ok("rgb()", parseColor("rgb(31, 42, 68)") === "#1f2a44" && parseColor("rgb(31 42 68)") === "#1f2a44")
ok("rgba() ignores the alpha", parseColor("rgba(255, 0, 0, 0.5)") === "#ff0000")
ok("a palette name works ('navy', any case)", parseColor("navy") === "#1f2a44" && parseColor("  SAGE ") === "#9caf88")
ok("spaces around the code are fine", parseColor("  #AABBCC  ") === "#aabbcc")
for (const bad of ["", "   ", "#12", "#12345", "#gggggg", "rgb(300, 0, 0)", "rgb(1,2)", "banana", "#1234567"]) ok(`rejects "${bad}"`, parseColor(bad) === null)

// ---- every palette colour detects as itself
const wrong = PALETTE.filter((c) => nearestColorName(c.hex) !== c.name)
ok(`all ${PALETTE.length} palette colours detect as themselves`, wrong.length === 0, wrong.map((c) => c.name).join(", "))
const names = PALETTE.map((c) => c.name.toLowerCase())
ok("palette names and codes are unique", new Set(names).size === names.length && new Set(PALETTE.map((c) => c.hex)).size === PALETTE.length)

// ---- the colours your catalog already uses keep their names
const existing: [string, string][] = [["#141414", "Black"], ["#f1efe9", "Off White"], ["#d4c5a3", "Sand"], ["#5b6140", "Olive"], ["#1f2a44", "Navy"], ["#a3a3a3", "Heather Grey"], ["#4a3328", "Chocolate"], ["#2f3e5c", "Indigo"]]
ok("existing product colours detect to their current names", existing.every(([hex, name]) => nearestColorName(hex) === name))

// ---- sensible names for colours not in the palette
const cases: [string, string][] = [
  ["#ff0000", "Red"], ["#0000ff", "Blue"], ["#00ff00", "Green"], ["#000000", "Black"], ["#fafafa", "White"],
  ["#222222", "Black"], ["#1c2b4d", "Navy"], ["#7a1330", "Burgundy"], ["#f5deb3", "Sand"], ["#87ceeb", "Sky Blue"],
]
for (const [hex, want] of cases) ok(`${hex} is called ${want}`, nearestColorName(hex) === want, `(got ${nearestColorName(hex)})`)
const near = nearestColor("#1f2a45")
ok("a near-miss reports a tiny distance", near.name === "Navy" && near.distance < 2, near.distance.toFixed(2))
ok("a far colour reports a bigger distance", nearestColor("#00ffd0").distance > near.distance)
