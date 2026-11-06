/** Checks CSV reading and writing.   npm run test-csv */
import { neutralise, parseCsv, parseCsvRecords, toCsv } from "../src/lib/csv"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}
const j = (x: unknown) => JSON.stringify(x)

// ---- reading
ok("plain rows and cells", j(parseCsv("a,b,c\n1,2,3").rows) === j([["a", "b", "c"], ["1", "2", "3"]]))
ok("Windows (CRLF), Unix (LF) and old Mac (CR) line ends all work", j(parseCsv("a,b\r\n1,2\r\n").rows) === j([["a", "b"], ["1", "2"]]) && j(parseCsv("a\n1\n").rows) === j([["a"], ["1"]]) && j(parseCsv("a\r1\r").rows) === j([["a"], ["1"]]))
ok("a trailing newline doesn't create an empty row", parseCsv("a,b\n1,2\n").rows.length === 2 && parseCsv("a,b\n1,2").rows.length === 2)
ok("commas inside quotes stay in the cell", j(parseCsv('a,"b,c",d').rows) === j([["a", "b,c", "d"]]))
ok('a doubled quote ("") is a literal quote', j(parseCsv('"say ""hi""",x').rows) === j([['say "hi"', "x"]]))
ok("line breaks inside quotes stay in the cell", j(parseCsv('"line1\nline2",x\n2,y').rows) === j([["line1\nline2", "x"], ["2", "y"]]))
ok("empty cells are kept (a,,c)", j(parseCsv("a,,c").rows) === j([["a", "", "c"]]) && j(parseCsv(",,").rows) === j([["", "", ""]]))
ok("a byte-order mark (Excel) is ignored", j(parseCsv("﻿a,b\n1,2").rows) === j([["a", "b"], ["1", "2"]]))
ok("a quote in the middle of an unquoted cell is just text", j(parseCsv('5" tall,x').rows) === j([['5" tall', "x"]]))
ok("an unclosed quote is reported, not guessed at", !!parseCsv('a,"b\nc').error)
ok("an empty file has no rows", parseCsv("").rows.length === 0 && parseCsv("\n\n").rows.length === 0)
ok("spaces around cells are kept by the raw reader", j(parseCsv(" a , b ").rows) === j([[" a ", " b "]]))

// ---- records with a header row
const rec = parseCsvRecords("Name, Sale Price ,ID\nTee,20,p1\n,,\nCap,30,p2\n")
ok("headers are lower-cased, trimmed and joined with underscores", j(rec.headers) === j(["name", "sale_price", "id"]))
ok("blank rows are skipped but line numbers stay true to the file", rec.records.length === 2 && rec.records[0].line === 2 && rec.records[1].line === 4, j(rec.records.map((r) => r.line)))
ok("values are trimmed, and short rows are padded with empty text", j(parseCsvRecords("a,b,c\n1").records[0].values) === j({ a: "1", b: "", c: "" }))
ok("a file with only a header has no records", parseCsvRecords("a,b").records.length === 0 && !parseCsvRecords("a,b").error)
ok("an empty file is an error", !!parseCsvRecords("").error)

// ---- writing
ok("simple values are not quoted", toCsv(["a", "b"], [["x", 1]]) === "﻿a,b\r\nx,1\r\n")
ok("commas, quotes and line breaks are quoted and escaped", toCsv(["a"], [['he said "hi", then\nleft']]).includes('"he said ""hi"", then\nleft"'))
ok("numbers, booleans, null and undefined", toCsv(["a", "b", "c", "d"], [[5, true, null, undefined]]).includes("5,true,,"))
ok("leading or trailing spaces survive (quoted)", toCsv(["a"], [[" x "]]).includes('" x "'))
ok("non-finite numbers become empty rather than 'NaN'", toCsv(["a", "b"], [[NaN, Infinity]]).includes("\r\n,\r\n"))
ok("accents and emoji pass through", toCsv(["n"], [["Côte d’Ivoire 🧥"]]).includes("Côte d’Ivoire 🧥"))

// ---- spreadsheet formula injection
ok("text starting with = + - @ gets an apostrophe so it can't run as a formula", ["=SUM(A1)", "+1+1", "-2+3", "@cmd", "\tx", "\rx"].every((s) => neutralise(s).startsWith("'")))
ok("normal text is untouched, and so are numbers", neutralise("Alex") === "Alex" && neutralise("a=b") === "a=b" && toCsv(["n"], [[-5]]).includes("-5") && !toCsv(["n"], [[-5]]).includes("'-5"))
ok("a hostile name in an export is neutralised, even when it also needs quoting", toCsv(["n"], [['=HYPERLINK("http://evil","x")']]).includes("\"'=HYPERLINK(\"\"http://evil\"\",\"\"x\"\")\""))
ok("a phone number like +233… is kept readable, with the apostrophe Excel hides", toCsv(["p"], [["+233 24 000 0000"]]).includes("'+233 24 000 0000"))

// ---- round trips
const tricky = [["Plain", "1"], ["with, comma", "2"], ['with "quote"', "3"], ["two\nlines", "4"], ["  padded  ", "5"], ["", "6"], ["émoji 🧥", "7"], ["trailing,", "8"]]
const back = parseCsv(toCsv(["name", "n"], tricky)).rows.slice(1)
ok("what we write, we read back exactly (including awkward cells)", j(back) === j(tricky))
let seed = 12345
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
// (no \r at all: a cell starting with one is deliberately prefixed, see above; and tables are at least 2 columns wide, because
// a one-column row with an empty cell is indistinguishable from a blank line in any CSV)
const alphabet = ['a', 'B', ' ', ',', '"', '\n', 'é', '1', "'", ';']
let good = 0
for (let t = 0; t < 400; t++) {
  const data = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => Array.from({ length: Math.floor(rnd() * 8) }, () => alphabet[Math.floor(rnd() * alphabet.length)]).join("")))
  const width = Math.max(2, ...data.map((r) => r.length))
  const padded = data.map((r) => [...r, ...Array(width - r.length).fill("x")])
  const out = parseCsv(toCsv(Array(width).fill("h"), padded)).rows.slice(1)
  if (j(out) === j(padded)) good++
}
ok("400 random awkward tables survive a round trip", good === 400, `${good}/400`)
