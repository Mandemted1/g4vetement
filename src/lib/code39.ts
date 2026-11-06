/** Code 39 barcodes (digits, capitals, - . and space) so a packing slip can be scanned. Pure: returns bar geometry. */

// n = narrow, w = wide; each character is 5 bars and 4 spaces, alternating, starting with a bar (3 of the 9 are wide)
const PATTERNS: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn", Z: "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn",
}
export const CODE39_PATTERNS = PATTERNS

export const canCode39 = (s: string) => s.length > 0 && [...s.toUpperCase()].every((c) => c !== "*" && c in PATTERNS)

/** The dark bars as {x, w} in units (narrow = 1, wide = 3), plus the total width. Returns null if the text can't be encoded. */
export function code39(text: string): { bars: { x: number; w: number }[]; width: number } | null {
  if (!canCode39(text)) return null
  const bars: { x: number; w: number }[] = []
  let x = 0
  for (const ch of `*${text.toUpperCase()}*`) {
    ;[...PATTERNS[ch]].forEach((e, i) => {
      const w = e === "w" ? 3 : 1
      if (i % 2 === 0) bars.push({ x, w })
      x += w
    })
    x += 1 // gap between characters
  }
  return { bars, width: x - 1 }
}
