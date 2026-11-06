/** Checks gift card code generation and status rules.   npm run test-gift-cards */
import { randomInt } from "node:crypto"
import { CODE_ALPHABET, formatCode, giftStatus, normalizeCode } from "../src/lib/gift-card-types"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}

ok("the alphabet has no look-alike characters (I, O, 0, 1)", !/[IO01]/.test(CODE_ALPHABET) && CODE_ALPHABET.length === 32 && new Set(CODE_ALPHABET).size === 32)
ok("a code looks like GC-XXXX-XXXX-XXXX", /^GC-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(formatCode(Array.from({ length: 12 }, (_, i) => i))), formatCode(Array.from({ length: 12 }, (_, i) => i)))
ok("every index maps to a character (wraps safely)", formatCode(Array.from({ length: 12 }, () => 99)).length === 17)
const seen = new Set<string>()
for (let i = 0; i < 20000; i++) seen.add(formatCode(Array.from({ length: 12 }, () => randomInt(32))))
ok("20,000 generated codes are all different", seen.size === 20000)
const counts = new Map<string, number>()
for (let i = 0; i < 64000; i++) { const ch = CODE_ALPHABET[randomInt(32)]; counts.set(ch, (counts.get(ch) ?? 0) + 1) }
ok("characters are evenly used (no obvious bias)", [...counts.values()].every((n) => n > 1700 && n < 2300), `${Math.min(...counts.values())}–${Math.max(...counts.values())} of 2000 each`)
ok("typed codes are normalised (case, spaces)", normalizeCode(" gc-7k4m 92qx\n-hd3r ") === "GC-7K4M92QX-HD3R" && normalizeCode("ABC") === "ABC")

const now = Date.parse("2026-11-10T12:00:00Z")
const base = { active: true, balance: 20, expiresAt: null as string | null }
ok("status: active", giftStatus(base, now) === "active")
ok("status: switched off wins over everything", giftStatus({ ...base, active: false, balance: 0 }, now) === "disabled")
ok("status: expired", giftStatus({ ...base, expiresAt: "2026-11-01T00:00:00Z" }, now) === "expired")
ok("status: not expired yet", giftStatus({ ...base, expiresAt: "2026-12-01T00:00:00Z" }, now) === "active")
ok("status: used up at $0", giftStatus({ ...base, balance: 0 }, now) === "used_up")
