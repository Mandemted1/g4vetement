/** Checks the store search.   npm run test-search */
import { searchProducts, type Searchable } from "../src/lib/search"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}
const P = (name: string, category: string, colors: string[], o: Partial<Searchable> = {}): Searchable => ({ name, sku: "G4-X", category, colors: colors.map((n) => ({ name: n })), description: "", fabric: "", fit: "", stock: 10, ...o })
const shop: Searchable[] = [
  P("Essential Heavyweight Tee", "Tees", ["Black", "Off White", "Sand"], { sku: "G4-TEE-001", fabric: "100% cotton" }),
  P("Boxy Graphic Tee", "Tees", ["Black", "Off White"], { sku: "G4-TEE-002" }),
  P("Classic Pullover Hoodie", "Hoodies & Sweats", ["Black", "Heather Grey", "Navy"], { sku: "G4-HDY-001" }),
  P("Crewneck Sweatshirt", "Hoodies & Sweats", ["Heather Grey", "Chocolate", "Black"], { sku: "G4-HDY-003" }),
  P("Utility Cargo Pants", "Bottoms", ["Olive", "Black", "Sand"], { sku: "G4-BTM-001" }),
  P("Straight Fit Denim", "Bottoms", ["Indigo", "Black"], { stock: 0 }),
  P("Wide Leg Trousers", "Bottoms", ["Black", "Chocolate"]),
  P("Coach Jacket", "Outerwear", ["Black", "Navy"]),
  P("Ribbed Beanie", "Accessories", ["Black", "Heather Grey", "Olive"]),
  P("Canvas Tote", "Accessories", ["Sand", "Black"], { description: "Carries a hoodie, a laptop and lunch." }),
]
const names = (q: string) => searchProducts(shop, q).map((p) => p.name)
const has = (q: string, n: string) => names(q).includes(n)

ok("empty or blank search matches nothing", names("").length === 0 && names("   ").length === 0)
ok("matches a word in the name", JSON.stringify(names("hoodie")[0]) === '"Classic Pullover Hoodie"')
ok("partial words work as you type ('hood')", has("hood", "Classic Pullover Hoodie"))
ok("plurals match ('tees')", has("tees", "Boxy Graphic Tee") && has("tees", "Essential Heavyweight Tee"))
ok("matches a category ('bottoms')", names("bottoms").length === 3)
ok("matches a colour ('olive')", names("olive").sort().join() === "Ribbed Beanie,Utility Cargo Pants")
ok("the admin can search product codes ('g4-hdy')", searchProducts(shop, "g4-hdy", { codes: true }).length === 2)
ok("shoppers' search ignores internal codes", names("g4-hdy").length === 0 && names("g4").length === 0)
ok("every word must match ('black tee' = black tees only)", names("black tee").length === 2 && names("olive tee").length === 0)
ok("order of words doesn't matter", names("tee black").join() === names("black tee").join())
ok("case and accents are ignored", has("HOODIE", "Classic Pullover Hoodie") && has("hoodié", "Classic Pullover Hoodie"))
ok("a small typo still finds it ('hoddie')", has("hoddie", "Classic Pullover Hoodie"))
ok("a swapped-letter typo still finds it ('sweatshrit')", has("sweatshrit", "Crewneck Sweatshirt"))
ok("short words aren't fuzzy (no wild guesses for 'tea')", names("tea").length === 0)
ok("'t-shirt' and 'tshirt' find tees", has("t-shirt", "Boxy Graphic Tee") && has("tshirt", "Boxy Graphic Tee"))
ok("'pants' finds trousers, cargo and denim", ["Wide Leg Trousers", "Utility Cargo Pants", "Straight Fit Denim"].every((n) => has("pants", n)))
ok("'jeans' finds the denim", has("jeans", "Straight Fit Denim"))
ok("'sweater' finds the sweatshirt", has("sweater", "Crewneck Sweatshirt"))
ok("'grey' finds heather grey, 'gray' too", has("grey", "Classic Pullover Hoodie") && has("gray", "Classic Pullover Hoodie"))
ok("nonsense matches nothing", names("zzzz").length === 0 && names("banana").length === 0)
ok("a name match ranks above a description mention ('hoodie')", names("hoodie")[0] === "Classic Pullover Hoodie" && names("hoodie").indexOf("Canvas Tote") > 0)
ok("results are exactly the matching products (no duplicates)", new Set(names("black")).size === names("black").length && names("black").length === 10)
ok("in-stock products come before sold-out ones on a tie", names("bottoms").at(-1) === "Straight Fit Denim")
ok("punctuation is ignored ('hoodies & sweats')", names("hoodies & sweats").length === 2)

// ---- departments: "women" / "men"
const dshop: Searchable[] = [
  P("Boxy Tee", "Tees", ["Black"], { department: "men" }),
  P("Fitted Tee", "Tees", ["Black"], { department: "women" }),
  P("Canvas Tote", "Accessories", ["Sand"], { department: "unisex" }),
]
const dn = (q: string) => searchProducts(dshop, q).map((p) => p.name).sort().join()
ok("'women' finds women's pieces and unisex ones", dn("women") === "Canvas Tote,Fitted Tee")
ok("'men' finds men's pieces and unisex ones (and not women's)", dn("men") === "Boxy Tee,Canvas Tote")
ok("'womens tee' combines department and product type", dn("womens tee") === "Fitted Tee")
ok("'mens' works too", dn("mens") === "Boxy Tee,Canvas Tote")
ok("'unisex' finds unisex pieces", dn("unisex") === "Canvas Tote")
