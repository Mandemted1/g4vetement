/** Checks product CSV import planning and the order/customer exports.   npm run test-import-export */
import { toCsv } from "../src/lib/csv"
import type { Customer, Order, Product } from "../src/lib/data"
import { customersToCsv, ordersToCsv, selectOrders } from "../src/lib/exports"
import { MAX_IMPORT_ROWS, PRODUCT_COLUMNS, planProductImport, productTemplateCsv, productsToCsv, type ExistingProduct } from "../src/lib/product-import"
import { parseCsv } from "../src/lib/csv"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}

const P = (o: Partial<Product> & { id: string }): Product => ({
  sku: `G4-TEE-${o.id}`, name: "Boxy Tee", category: "Tees", department: "men", type: "tee", price: 38, colors: [{ name: "Black", hex: "#141414" }, { name: "Sand", hex: "#d4c5a3" }], sizes: ["S", "M", "L"],
  stock: 12, sizeStock: { S: 4, M: 5, L: 3 }, reorderLevel: 10, description: "Boxy through the body.", fabric: "100% cotton", fit: "Boxy.", images: ["https://img.example.com/a.jpg"], active: true, ...o,
})
const products: Product[] = [P({ id: "p02" }), P({ id: "p03", name: "Cargo, Wide", category: "Bottoms", type: "cargo", price: 84, sizes: ["28", "30"], sizeStock: { "28": 2, "30": 0 }, stock: 2, colors: [{ name: "Olive", hex: "#5b6140" }], description: 'Say "hi"\nsecond line' })]
const existing: ExistingProduct[] = products.map((p) => ({ ...p }))
const cats = [{ name: "Tees", department: "both" as const }, { name: "Bottoms", department: "men" as const }]
const plan = (csv: string) => planProductImport(csv, existing, cats)
const err = (csv: string) => plan(csv).errors.map((e) => `${e.line}: ${e.message}`).join(" || ")
const HEAD = "name,category,price,colors,sizes\n"

// ---- the export format
const exported = productsToCsv(products)
const rows = parseCsv(exported).rows
ok("the export has every column, in order, and a row per product", rows[0].join() === PRODUCT_COLUMNS.join() && rows.length === 3)
ok("colours, sizes and stock are written in the format the importer reads", rows[1][12] === "Black:#141414|Sand:#d4c5a3" && rows[1][13] === "S|M|L" && rows[1][14] === "S:4|M:5|L:3" && rows[1][15] === "12")
ok("awkward text (commas, quotes, line breaks) survives", rows[2][2] === "Cargo, Wide" && rows[2][9] === 'Say "hi"\nsecond line')

// ---- exporting then importing changes nothing
const round = plan(exported)
ok("export then import: no errors, and every product is 'unchanged'", round.errors.length === 0 && round.counts.unchanged === 2 && round.counts.create === 0 && round.counts.update === 0, JSON.stringify({ e: round.errors, c: round.counts }))
const hostile = products.map((p, i) => (i === 0 ? { ...p, name: "=Tee", description: "+note" } : p))
const round2 = planProductImport(productsToCsv(hostile), hostile.map((p) => ({ ...p })), cats)
ok("a product named '=Tee' is safe in the spreadsheet yet round-trips unchanged", productsToCsv(hostile).includes("'=Tee") && round2.counts.unchanged === 2 && round2.errors.length === 0, JSON.stringify(round2.counts))

// ---- the template
const tpl = plan(productTemplateCsv())
ok("the downloadable template is itself a valid import (one new product)", tpl.errors.length === 0 && tpl.counts.create === 1 && tpl.rows[0].input.name === "Example Tee" && tpl.rows[0].input.department === "women" && tpl.rows[0].input.sizes.join() === "S,M,L" && tpl.rows[0].input.sizeStock.M === 5, err(productTemplateCsv()))

// ---- changing existing products: only the columns in the file change
let r = plan("id,price\np02,45")
ok("id + price changes only the price", r.errors.length === 0 && r.rows[0].action === "update" && r.rows[0].changes.join() === "price" && r.rows[0].input.price === 45 && r.rows[0].input.description === "Boxy through the body." && r.rows[0].input.sizeStock.M === 5)
r = plan("sku,fit\nG4-TEE-p03,Relaxed")
ok("a row can be matched by sku instead of id", r.rows[0]?.id === "p03" && r.rows[0].changes.join() === "fit")
r = plan("id,price\np02,38")
ok("a row that changes nothing is reported as unchanged", r.rows[0].action === "unchanged")
r = plan("id,description\np02,")
ok("an empty cell in an existing product's text column leaves it alone (it doesn't wipe it)", r.rows[0].action === "unchanged" && r.rows[0].input.description === "Boxy through the body.")
ok("an unknown id is an error with the file's line number", err("id,price\np02,40\np99,5") === "3: There's no product with the id “p99”. Leave the id empty to add a new product.")
ok("the same product twice is refused", /same product \(p02\)/.test(err("id,price\np02,40\np02,41")))
r = plan("id,sizes\np02,S|M")
ok("dropping a size removes its stock; kept sizes keep theirs", r.rows[0].input.sizes.join() === "S,M" && r.rows[0].input.sizeStock.S === 4 && r.rows[0].input.sizeStock.M === 5 && !("L" in r.rows[0].input.sizeStock) && r.rows[0].changes.includes("sizes"))
r = plan("id,sizes\np02,S|M|L|XL")
ok("adding a size starts it at 0", r.rows[0].input.sizeStock.XL === 0 && r.rows[0].input.sizeStock.S === 4)
r = plan("id,stock_by_size\np02,S:10|L:0")
ok("stock_by_size sets only the sizes named", r.rows[0].input.sizeStock.S === 10 && r.rows[0].input.sizeStock.L === 0 && r.rows[0].input.sizeStock.M === 5 && r.rows[0].changes.join() === "stock")
r = plan("id,stock\np02,9")
ok("a single 'stock' number is split across the sizes (9 over 3 = 3,3,3)", r.rows[0].input.sizeStock.S === 3 && r.rows[0].input.sizeStock.M === 3 && r.rows[0].input.sizeStock.L === 3)
ok("stock for a size the product doesn't have is an error", /isn't one of the sizes/.test(err("id,stock_by_size\np02,XXL:3")))
ok("total_stock in the file is ignored (it's worked out from the sizes)", plan("id,total_stock\np02,999").rows[0].action === "unchanged" && plan("id,total_stock\np02,999").ignoredColumns.length === 0)

// ---- adding new products
r = plan(HEAD + "Slip Dress,Dresses,60,Black:#141414|Pink:#e8a1b5,S|M|L")
ok("a new product needs only the essentials; the rest gets defaults", r.errors.length === 0 && r.counts.create === 1 && r.rows[0].input.department === "men" && r.rows[0].input.type === "other" && r.rows[0].input.reorderLevel === 10 && r.rows[0].input.active === true && r.rows[0].input.sizeStock.M === 0)
for (const need of ["name", "category", "price", "colors", "sizes"]) {
  const cols = ["name", "category", "price", "colors", "sizes"].filter((c) => c !== need)
  const vals: Record<string, string> = { name: "X", category: "Tees", price: "5", colors: "Black:#000000", sizes: "M" }
  ok(`a new product without a ${need} is refused, naming it`, new RegExp(`needs a ${need}`).test(err("id," + cols.join(",") + "\n," + cols.map((c) => vals[c]).join(","))))
}
r = plan(HEAD + "Slip Dress,Dresses,60,Black:#141414,S|M\nHoodie,Hoodies,80,Black:#141414,S")
ok("categories that don't exist are listed to be created", r.newCategories.map((c) => c.name).sort().join() === "Dresses,Hoodies")
r = plan("name,category,price,colors,sizes,department\nA,Dresses,5,Black:#000000,M,women\nB,Dresses,5,Black:#000000,M,men\nC,Skirts,5,Black:#000000,M,women\nD,Tops,5,Black:#000000,M,unisex")
ok("a new category belongs to the department its products are in (both if mixed or unisex)", r.newCategories.find((c) => c.name === "Dresses")?.department === "both" && r.newCategories.find((c) => c.name === "Skirts")?.department === "women" && r.newCategories.find((c) => c.name === "Tops")?.department === "both", JSON.stringify(r.newCategories))
r = plan(HEAD + "Tee 2,tees,40,Black:#000000,M")
ok("a category typed in other capitals uses the existing one's spelling", r.rows[0].input.category === "Tees" && r.newCategories.length === 0)
r = plan("name,category,price,colors,sizes,sku\nA,Tees,5,Black:#000000,M,MY-CODE-1")
ok("a new product can bring its own code", r.rows[0].sku === "MY-CODE-1")
ok("a code that belongs to an existing product updates that product; a code repeated among new products is refused", plan("sku,price\nG4-TEE-p02,41").rows[0].id === "p02" && /already used/.test(err("name,category,price,colors,sizes,sku\nA,Tees,5,Black:#000000,M,SAME\nB,Tees,5,Black:#000000,M,SAME")))

// ---- every kind of mistake is caught, with the line number
const bad = (extra: string, col: string) => err(`name,category,price,colors,sizes,${col}\nA,Tees,5,Black:#000000,M,${extra}`)
ok("price: $ and .00 are fine; decimals and words are not", plan(HEAD + "A,Tees,$40,Black:#000000,M").rows[0].input.price === 40 && plan(HEAD + "A,Tees,40.00,Black:#000000,M").rows[0].input.price === 40 && /whole number/.test(err(HEAD + "A,Tees,40.5,Black:#000000,M")) && /whole number/.test(err(HEAD + "A,Tees,abc,Black:#000000,M")) && /Price must be/.test(err(HEAD + "A,Tees,-5,Black:#000000,M")))
ok("department must be men, women or unisex", /Department must be/.test(bad("kids", "department")) && plan("name,category,price,colors,sizes,department\nA,Tees,5,Black:#000000,M,Women").rows[0].input.department === "women")
ok("an unknown shape lists the choices", /isn't one we draw. Use one of: tee,/.test(bad("spaceship", "type")))
ok("active accepts true/false/yes/no/1/0, and refuses anything else", ["true", "yes", "1", "Y"].every((x) => plan("name,category,price,colors,sizes,active\nA,Tees,5,Black:#000000,M," + x).rows[0].input.active) && ["false", "no", "0", "hidden"].every((x) => !plan("name,category,price,colors,sizes,active\nA,Tees,5,Black:#000000,M," + x).rows[0].input.active) && /true or false/.test(bad("maybe", "active")))
ok("colours: Name:#hex, a bare #hex (named for you), a known name, and Name:name", (() => { const c = plan("name,category,price,colors,sizes\nA,Tees,5,Navy:#1f2a44|#ff0000|sage|Moss:olive,M").rows[0].input.colors; return c.length === 4 && c[0].name === "Navy" && c[1].name === "Red" && c[1].hex === "#ff0000" && c[2].name === "sage" && c[2].hex === "#9caf88" && c[3].name === "Moss" && c[3].hex === "#5b6140" })())
ok("a bad colour says how to write one", /isn't a colour\. Write it as Name:#hex/.test(err(HEAD + "A,Tees,5,Blurple,M")))
ok("two colours with one name are refused", /Two colours are called/.test(err(HEAD + "A,Tees,5,Black:#000000|Black:#111111,M")))
ok("two sizes with one name are refused (any capitals)", /same name/.test(err(HEAD + "A,Tees,5,Black:#000000,M|m")))
ok("photos must be web addresses", /isn't a web address/.test(bad("not-a-url", "images")) && plan("name,category,price,colors,sizes,images\nA,Tees,5,Black:#000000,M,https://x.com/a.jpg|https://x.com/b.jpg").rows[0].input.images.length === 2)
ok("over-long names, descriptions and a negative reorder level are refused", /too long/.test(err("name,category,price,colors,sizes\n" + "x".repeat(121) + ",Tees,5,Black:#000000,M")) && /too long/.test(bad("x".repeat(2001), "description")) && /Reorder level/.test(bad("-1", "reorder_level")))
ok("several mistakes in one file are all reported, each with its own line", plan(HEAD + "A,Tees,abc,Black:#000000,M\nB,Tees,5,Black:#000000,M\nC,Tees,5,Blurple,M").errors.map((e) => e.line).join() === "2,4")
ok("a file with errors still reports the good rows (but the page won't apply it)", plan(HEAD + "A,Tees,abc,Black:#000000,M\nB,Tees,5,Black:#000000,M").counts.create === 1)

// ---- the whole file
ok("a file with no title row for name or id is refused with advice", /column titles/.test(plan("price,fit\n5,x").fatal ?? ""))
ok("an empty file and a title-only file are refused", /empty/.test(plan("").fatal ?? "") && /no products/.test(plan("name,category\n").fatal ?? ""))
const many = HEAD + Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `P${i},Tees,5,Black:#000000,M`).join("\n")
ok(`more than ${MAX_IMPORT_ROWS} rows is refused`, /Import up to 500/.test(plan(many).fatal ?? "") && !plan(many.split("\n").slice(0, 501).join("\n")).fatal)
ok("columns we don't use are listed, not fatal", plan("name,category,price,colors,sizes,wishlist\nA,Tees,5,Black:#000000,M,x").ignoredColumns.join() === "wishlist")
ok("headers are forgiving: capitals and spaces (Reorder Level, ACTIVE)", plan("Name,Category,Price,Colors,Sizes,Reorder Level,ACTIVE\nA,Tees,5,Black:#000000,M,3,no").rows[0].input.reorderLevel === 3)
ok("blank lines in the file are skipped without shifting line numbers", err("name,category,price,colors,sizes\n\nA,Tees,abc,Black:#000000,M").startsWith("3:"))
ok("a broken quote is reported, not guessed", /never closed/.test(plan('name,category\n"A,Tees').fatal ?? ""))
ok("text with HTML in it is kept as plain text (the store never renders it as HTML)", plan("name,category,price,colors,sizes\n<b>Hi</b>,Tees,5,Black:#000000,M").rows[0].input.name === "<b>Hi</b>")

// ---- orders and customers
const O = (o: Partial<Order> & { id: string }): Order => ({
  number: 2001, date: "2026-11-05T10:00:00Z", customerId: "C1", items: [{ productId: "p02", name: "Boxy Tee", size: "M", color: "Black", colorHex: "#141414", qty: 2, price: 38, listPrice: 40 }, { productId: "p03", name: "Cargo, Wide", size: "30", color: "Olive", colorHex: "#5b6140", qty: 1, price: 84 }],
  subtotal: 160, discount: 10, discountCode: "WELCOME10", saleDiscount: 4, shipping: 9, total: 159, status: "shipped", channel: "Direct", payment: "Card", giftAmount: 20,
  ship: { country: "GH", address: "12 Example St", city: "Accra", state: "GA", postcode: "00233", method: "Ghana", estimate: "" }, tracking: { carrier: "UPS", number: "1Z999", url: "" }, ...o,
})
const orders = [O({ id: "G4-2001" }), O({ id: "G4-2002", number: 2002, date: "2026-11-07T10:00:00Z", status: "pending", items: [{ productId: "p02", name: "Boxy Tee", size: "S", color: "Black", colorHex: "#141414", qty: 1, price: 38 }] }), O({ id: "G4-0500", number: 500, date: "2026-10-01T10:00:00Z", sim: true })]
const custs = new Map([["C1", { name: "=cmd|' /C calc'!A0", email: "a@example.com" }]])
const prods = new Map(products.map((p) => [p.id, p]))
const oc = parseCsv(ordersToCsv(orders, custs, prods)).rows
ok("orders: one row per item, and demo orders are left out by default", oc.length === 1 + 2 + 1 && !oc.some((r) => r[0] === "G4-0500"))
ok("…with the order's totals repeated, the sku looked up, and line totals worked out", oc[1][11] === "p02" && oc[1][12] === "G4-TEE-p02" && oc[1][16] === "2" && oc[1][17] === "40" && oc[1][18] === "38" && oc[1][19] === "76" && oc[1][25] === "159" && oc[1][26] === "20" && oc[1][29] === "1Z999", oc[1].join("|"))
ok("…and a hostile customer name is neutralised so the spreadsheet can't run it", oc[1][4].startsWith("'=cmd") && !ordersToCsv(orders, custs, prods).includes(',=cmd'))
ok("the demo switch brings the demo orders in", parseCsv(ordersToCsv(orders, custs, prods, { includeDemo: true })).rows.length === 6)
ok("date range is inclusive and by day", selectOrders(orders, { from: "2026-11-05", to: "2026-11-05" }).map((o) => o.id).join() === "G4-2001" && selectOrders(orders, { from: "2026-11-05", to: "2026-11-07" }).length === 2 && selectOrders(orders, { to: "2026-11-04" }).length === 0)
ok("status filter (and 'all')", selectOrders(orders, { status: "pending" }).map((o) => o.id).join() === "G4-2002" && selectOrders(orders, { status: "all" }).length === 2)
ok("orders sorted oldest first so the file reads like a ledger", parseCsv(ordersToCsv(orders, custs, prods)).rows.slice(1).map((r) => r[0]).join() === "G4-2001,G4-2001,G4-2002")
const cu: Customer[] = [{ id: "C1", name: "Alex, Jr", email: "a@example.com", city: "Accra", state: "GA", orders: 3, spent: 250, firstOrder: "2026-01-01", lastOrder: "2026-11-01", tier: "Loyal" }]
const cc = parseCsv(customersToCsv(cu)).rows
ok("customers export has a row each with spend and tier", cc.length === 2 && cc[1][1] === "Alex, Jr" && cc[1][5] === "3" && cc[1][6] === "250" && cc[1][9] === "Loyal")
ok("an empty export is just the header row", parseCsv(ordersToCsv([], custs, prods)).rows.length === 1 && parseCsv(customersToCsv([])).rows.length === 1)
ok("toCsv is what writes these (sanity)", toCsv(["a"], [["x"]]).startsWith("﻿"))
