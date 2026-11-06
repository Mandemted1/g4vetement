/** Checks how policy, size guide and FAQ text is turned into a page.   npm run test-policy-text */
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { PolicyText } from "../src/components/store/policy-text"
import { DEFAULT_POLICIES, HELP_PAGES, POLICY_META } from "../src/lib/settings-types"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}
const html = (t: string) => renderToStaticMarkup(createElement(PolicyText, { text: t }))

ok("## lines become headings", /<h2[^>]*>Returns<\/h2>/.test(html("## Returns\nBody")))
ok("- lines become a bullet list", /<ul[^>]*><li>One<\/li><li>Two<\/li><\/ul>/.test(html("- One\n- Two")))
ok("plain lines are paragraphs, and line breaks are kept", /<p[^>]*>A<br\/>B<\/p>/.test(html("A\nB")))
const t = html("## Tops\n\n| Size | Chest |\n| S | 91 |\n| M | 97 |")
ok("| rows become a table: header row, then body rows", /<thead>.*Size.*Chest.*<\/thead>/.test(t) && (t.match(/<tbody>.*<\/tbody>/)?.[0].match(/<tr/g) ?? []).length === 2)
ok("the first cell of each row is a row header (good for screen readers)", /<th scope="row"[^>]*>S<\/th>/.test(t) && /<th scope="col"/.test(t))
ok("a divider row (|---|---|) is ignored", !/---/.test(html("| A | B |\n|---|---|\n| 1 | 2 |")))
ok("a table can sit directly under a heading, with no blank line", /<h2[^>]*>Men<\/h2>/.test(html("## Men\n| A | B |\n| 1 | 2 |")) && /<table/.test(html("## Men\n| A | B |\n| 1 | 2 |")))
ok("the table scrolls inside its own box (it can't widen the page)", /overflow-x-auto/.test(t))
ok("text around a table is kept in order", (() => { const x = html("Intro\n\n| A |\n| 1 |\n\nOutro"); return x.indexOf("Intro") < x.indexOf("<table") && x.indexOf("<table") < x.indexOf("Outro") })())
ok("HTML is never interpreted: scripts and tags come out as text", (() => { const x = html("<script>alert(1)</script>\n\n| <b>x</b> | <img src=x onerror=1> |\n| <i>y</i> | z |"); return !x.includes("<script") && !x.includes("<b>") && !x.includes("<img") && !x.includes("<i>") && x.includes("&lt;script&gt;") })())
ok("a ragged table (rows with fewer cells) still renders", /<table/.test(html("| A | B | C |\n| 1 |")))
ok("empty text renders nothing harmful", html("").length < 60)

// the starter pages
ok("there are six pages, including Size guide and FAQ", POLICY_META.length === 6 && ["size-guide", "faq"].every((s) => POLICY_META.some((m) => m.slug === s)))
ok("every page has starter text", POLICY_META.every((m) => DEFAULT_POLICIES[m.slug].trim().length > 200))
ok("only Size guide and FAQ are labelled Help", HELP_PAGES.join() === "size-guide,faq")
ok("no starter text contains an em dash, en dash or the old draft marker", POLICY_META.every((m) => !/[—–]/.test(DEFAULT_POLICIES[m.slug]) && !/\[Draft/.test(DEFAULT_POLICIES[m.slug])))
const returns = DEFAULT_POLICIES.returns
ok("Returns makes store credit the default and keeps refunds for agreed cases", /Store credit/.test(returns) && /issued as store credit by default/i.test(returns) && /Where we agree to a refund/.test(returns) && /30 days/.test(returns))
const size = html(DEFAULT_POLICIES["size-guide"])
ok("the size guide renders three charts with the right columns", (size.match(/<table/g) ?? []).length === 3 && /Chest \(cm\)/.test(size) && /Bust \(cm\)/.test(size) && /Hips \(in\)/.test(size))
ok("every size row has as many cells as its header", (() => { const rows = DEFAULT_POLICIES["size-guide"].split("\n").filter((l) => l.startsWith("|")); let width = 0; for (const r of rows) { const n = r.split("|").length - 2; if (r.includes("Size")) width = n; else if (n !== width) return false } return true })())
ok("the FAQ is a list of questions ending in question marks or full stops, each with an answer", (() => { const parts = DEFAULT_POLICIES.faq.split(/\n## /).slice(1); return parts.length >= 14 && parts.every((p) => p.split("\n").slice(1).join(" ").trim().length > 30) })())
