/**
 * CSV reading and writing (RFC 4180) for the admin's import and export. Pure, so it can be tested thoroughly.
 */

/** Reads CSV text into rows of cells. Handles quoted cells (with commas, quotes and line breaks inside), CRLF/LF/CR line ends, and a byte-order mark. */
export function parseCsv(input: string): { rows: string[][]; lines: number[]; error?: string } {
  const text = input.replace(/^﻿/, "")
  const rows: string[][] = []
  const lines: number[] = [] // the file line each row starts on
  let line = 1
  let startLine = 1
  let row: string[] = []
  let cell = ""
  let quoted = false
  let seen = false // anything on this row yet (so a trailing newline doesn't make an empty row)
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } // "" is a literal quote
        else quoted = false
      } else { cell += c; if (c === "\n") line++ }
      continue
    }
    if (!seen && cell === "") startLine = line
    if (c === '"' && cell === "") { quoted = true; seen = true }
    else if (c === ",") { row.push(cell); cell = ""; seen = true }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      if (seen || cell !== "") { row.push(cell); rows.push(row); lines.push(startLine) }
      line++
      row = []; cell = ""; seen = false
    } else { cell += c; seen = true }
  }
  if (quoted) return { rows, lines, error: "A quoted cell is never closed (a \" is missing)." }
  if (seen || cell !== "") { row.push(cell); rows.push(row); lines.push(startLine) }
  return { rows, lines }
}

/** Reads CSV with a header row into records keyed by lower-cased, trimmed header names. Blank rows are dropped. */
export function parseCsvRecords(input: string): { headers: string[]; records: { line: number; values: Record<string, string> }[]; error?: string } {
  const { rows, lines, error } = parseCsv(input)
  if (error) return { headers: [], records: [], error }
  if (rows.length === 0) return { headers: [], records: [], error: "The file is empty." }
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"))
  const records: { line: number; values: Record<string, string> }[] = []
  rows.slice(1).forEach((r, i) => {
    if (r.every((c) => c.trim() === "")) return
    const values: Record<string, string> = {}
    headers.forEach((h, j) => { if (h) values[h] = (r[j] ?? "").trim() })
    records.push({ line: lines[i + 1], values })
  })
  return { headers, records }
}

/**
 * Makes a text cell safe to open in Excel or Sheets. A cell starting with = + - @ (or a tab or return) can run as a formula,
 * which attackers abuse by typing one into a name or address field, so such cells get a leading apostrophe.
 */
export const neutralise = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s)

/** Undoes `neutralise` when reading a file back in (an exported "'+Tee" is the product "+Tee"). */
export const restore = (s: string) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s)

export type CsvValue = string | number | boolean | null | undefined

function cell(v: CsvValue): string {
  if (v === null || v === undefined) return ""
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : ""
  if (typeof v === "boolean") return v ? "true" : "false"
  const s = neutralise(v)
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s
}

/** Builds CSV text (with a byte-order mark so Excel reads accents correctly). Numbers are written as numbers, text is made formula-safe. */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"
}
