/** Checks the shipping-zone rules, country list and tracking links.   npm run test-shipping */
import { COUNTRIES, countryName, guessCountry, isCountry } from "../src/lib/countries"
import { DEFAULT_ZONE, WORLD, cleanZone, describeZone, quoteShipping, shippableCountries, shippingSummary, zoneFor, type ShippingZone, type ZoneInput } from "../src/lib/shipping"
import { cleanTracking } from "../src/lib/tracking"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}
const z = (o: Partial<ShippingZone> & { id: string; countries: string[] }): ShippingZone => ({ name: o.id, rate: 10, freeOver: null, estimate: "", active: true, sort: 0, ...o })
const input: ZoneInput = { name: "Ghana", countries: ["GH"], rate: 12, freeOver: 150, estimate: "3–5 business days", active: true }
const err = (r: { ok: boolean; error?: string }) => (r.ok ? "" : (r.error ?? ""))

// ---- countries
ok("country list is complete and unique", COUNTRIES.length >= 230 && new Set(COUNTRIES.map((c) => c.code)).size === COUNTRIES.length, `${COUNTRIES.length}`)
ok("every code is two capital letters", COUNTRIES.every((c) => /^[A-Z]{2}$/.test(c.code) && c.name.length > 1))
ok("sorted by name", COUNTRIES.every((c, i) => i === 0 || COUNTRIES[i - 1].name.localeCompare(c.name, "en") <= 0))
ok("lookups work in any case", countryName("gh") === "Ghana" && isCountry("us") && !isCountry("ZZ") && countryName("US") === "United States")
ok("locale guess: en-GH → GH, fr-FR → FR, plain 'en' → nothing", guessCountry(["en-GH"]) === "GH" && guessCountry(["fr-FR", "en"]) === "FR" && guessCountry(["en"]) === null && guessCountry(["en-ZZ", "en-GB"]) === "GB")

// ---- validating a zone
const good = cleanZone(input, [])
ok("a normal zone is accepted", good.ok && good.value.countries[0] === "GH")
ok("name is required", !cleanZone({ ...input, name: "  " }, []).ok)
ok("needs at least one country", !cleanZone({ ...input, countries: [] }, []).ok)
ok("unknown country codes are refused", /ZZ/.test(err(cleanZone({ ...input, countries: ["GH", "ZZ"] }, []))))
ok("country codes are tidied (case, duplicates)", (() => { const r = cleanZone({ ...input, countries: ["gh", "GH", " ng "] }, []); return r.ok && r.value.countries.join() === "GH,NG" })())
ok("a country can't be in two zones (and the message names both)", /Ghana is already in the zone “Africa”/.test(err(cleanZone(input, [z({ id: "a", name: "Africa", countries: ["GH", "NG"] })]))))
ok("a different country is fine", cleanZone(input, [z({ id: "a", countries: ["NG"] })]).ok)
ok("'everywhere else' works alone", cleanZone({ ...input, name: "World", countries: [WORLD] }, []).ok)
ok("'everywhere else' can't be mixed with countries", !cleanZone({ ...input, countries: [WORLD, "GH"] }, []).ok)
ok("only one 'everywhere else' zone", /already have an “everywhere else”/.test(err(cleanZone({ ...input, countries: [WORLD] }, [z({ id: "w", name: "Rest", countries: [WORLD] })]))))
ok("price must be a whole number, 0 or more", !cleanZone({ ...input, rate: -1 }, []).ok && !cleanZone({ ...input, rate: 4.5 }, []).ok && cleanZone({ ...input, rate: 0 }, []).ok)
ok("free-over must be 1 or more (or empty)", !cleanZone({ ...input, freeOver: 0 }, []).ok && !cleanZone({ ...input, freeOver: 9.5 }, []).ok && cleanZone({ ...input, freeOver: null }, []).ok)
ok("a free zone drops a pointless free-over", (() => { const r = cleanZone({ ...input, rate: 0, freeOver: 100 }, []); return r.ok && r.value.freeOver === null })())
ok("estimate is trimmed and capped", cleanZone({ ...input, estimate: "  2 days " }, []).ok && !cleanZone({ ...input, estimate: "x".repeat(61) }, []).ok)

// ---- which zone serves a country
const zones: ShippingZone[] = [
  z({ id: "eu", name: "Europe", countries: ["FR", "DE"], rate: 15, freeOver: 200, sort: 2 }),
  z({ id: "gh", name: "Ghana", countries: ["GH"], rate: 5, freeOver: 80, sort: 1 }),
  z({ id: "w", name: "World", countries: [WORLD], rate: 30, sort: 0 }),
  z({ id: "off", name: "Off", countries: ["US"], rate: 1, active: false, sort: 3 }),
]
ok("a named country uses its own zone", zoneFor(zones, "GH")?.name === "Ghana" && zoneFor(zones, "de")?.name === "Europe")
ok("anywhere else falls to 'everywhere else' (even if it has the lowest priority)", zoneFor(zones, "JP")?.name === "World")
ok("a switched-off zone is ignored (US falls to the world zone)", zoneFor(zones, "US")?.name === "World")
ok("without 'everywhere else', other countries aren't served", zoneFor(zones.filter((x) => x.id !== "w"), "JP") === null)
ok("no country yet → the first active zone", zoneFor(zones, null)?.name === "World" && zoneFor(zones, "")?.name === "World")
ok("no zones at all → nothing", zoneFor([], "GH") === null)

// ---- pricing
ok("flat rate below the threshold", quoteShipping(zones, "GH", 60).price === 5)
ok("free at the threshold (inclusive)", quoteShipping(zones, "GH", 80).price === 0 && quoteShipping(zones, "GH", 79).price === 5)
ok("a zone with no free-over is never free by amount", quoteShipping(zones, "JP", 5000).price === 30)
ok("a free-shipping code makes any zone free", quoteShipping(zones, "JP", 10, true).price === 0)
ok("the quote carries the zone name, estimate and threshold", (() => { const q = quoteShipping(zones, "GH", 10); return q.zone === "Ghana" && q.freeOver === 80 && q.error === null })())
ok("an unserved country gets a clear error", /We don't ship to Japan/.test(quoteShipping(zones.filter((x) => x.id !== "w"), "JP", 50).error ?? ""))
ok("the default zone reproduces the old $9 / free over $100 rule", quoteShipping([DEFAULT_ZONE], "US", 99).price === 9 && quoteShipping([DEFAULT_ZONE], "US", 100).price === 0 && quoteShipping([DEFAULT_ZONE], "GH", 50).price === 9)

// ---- what shoppers can pick, and how zones read
ok("with an 'everywhere else' zone, every country can be picked", shippableCountries(zones).length === COUNTRIES.length)
ok("without it, only the zones' countries", shippableCountries(zones.filter((x) => x.id !== "w")).map((c) => c.code).sort().join() === "DE,FR,GH")
ok("zone summary reads naturally", describeZone(zones[1]) === "Ghana · $5 · free over $80", describeZone(zones[1]))
ok("long country lists are shortened", describeZone({ countries: ["FR", "DE", "ES", "IT", "NL"], rate: 15, freeOver: null, estimate: "5–8 days" }) === "France, Germany, Italy +2 more · $15 · 5–8 days" || describeZone({ countries: ["FR", "DE", "ES", "IT", "NL"], rate: 15, freeOver: null, estimate: "5–8 days" }).includes("+2 more"))
ok("'everywhere else' reads naturally", describeZone({ countries: [WORLD], rate: 0, freeOver: null, estimate: "" }) === "Everywhere else · Free shipping")
ok("summary: single flat rule", shippingSummary([DEFAULT_ZONE]) === "Free shipping over $100. $9 flat rate below.")
ok("summary: rates that differ", /^Shipping from \$5\./.test(shippingSummary(zones)))
ok("summary: nothing set up", shippingSummary([]) === "Shipping is calculated at checkout.")

// ---- tracking
const t = (carrier: string, number: string, url?: string) => cleanTracking({ carrier, number, url })
const ups = t("UPS", "1z 999 aa1 0123456784")
ok("UPS link is built and the number tidied", ups.ok && ups.value.number === "1Z999AA10123456784" && ups.value.url === "https://www.ups.com/track?tracknum=1Z999AA10123456784")
ok("USPS, FedEx and DHL links are built", ["USPS", "FedEx", "DHL"].every((c) => { const r = t(c, "9400111899223856"); return r.ok && r.value.url.startsWith("https://") && r.value.url.includes("9400111899223856") }))
ok("'Other' takes the admin's own link", (() => { const r = t("Other", "ABC12345", "https://track.example.com/x?id=1"); return r.ok && r.value.url === "https://track.example.com/x?id=1" })())
ok("'Other' without a link is allowed (number only)", (() => { const r = t("Other", "ABC12345"); return r.ok && r.value.url === "" })())
ok("an unsafe link is refused", !t("Other", "ABC12345", "javascript:alert(1)").ok && !t("Other", "ABC12345", "ftp://x.com/y").ok)
ok("a custom link is ignored for known carriers (we build it)", (() => { const r = t("UPS", "1Z999AA10123456784", "https://evil.example.com"); return r.ok && r.value.url.startsWith("https://www.ups.com/") })())
ok("number is required and must look like one", !t("UPS", "  ").ok && !t("UPS", "12").ok && !t("UPS", "AB CD<script>").ok && !t("UPS", "x".repeat(41)).ok)
ok("unknown carrier is refused", !t("Pigeon", "ABC12345").ok)
ok("symbols in a number can't break out of the link", (() => { const r = t("USPS", "ABC&x=1/../"); return !r.ok })())
