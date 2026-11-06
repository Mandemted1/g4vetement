/**
 * Verifies your Cloudinary setup end to end.   Run: npm run test-cloudinary
 * Uploads public/products/p05.jpg with a signed request, checks the 4:5 crop and automatic format,
 * then deletes the test image again.
 */
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { cloudinaryUrl } from "../src/lib/images"

const { uploadTicket, cloudinaryConfigured } = await import("../src/lib/cloudinary")
const ok = (name: string, cond: boolean, extra = "") => console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)

if (!cloudinaryConfigured()) {
  console.error("Cloudinary variables are missing in .env.local")
  process.exit(1)
}
const t = uploadTicket("test")
const fd = new FormData()
fd.set("file", new Blob([readFileSync(join(process.cwd(), "public/products/p05.jpg"))], { type: "image/jpeg" }), "p05.jpg")
fd.set("api_key", t.apiKey)
fd.set("timestamp", String(t.timestamp))
fd.set("folder", t.folder)
fd.set("signature", t.signature)

const up = await fetch(`https://api.cloudinary.com/v1_1/${t.cloudName}/image/upload`, { method: "POST", body: fd })
const j = (await up.json()) as { secure_url?: string; public_id?: string; width?: number; height?: number; error?: { message: string } }
ok("signed upload accepted", up.ok && Boolean(j.secure_url), j.error?.message ?? `${j.width}x${j.height}`)
if (!j.secure_url) process.exit(1)

try {
  // storefront-style delivery: modern format, 4:5 crop, requested width
  const auto = await fetch(cloudinaryUrl(j.secure_url, { w: 400 }), { headers: { Accept: "image/avif,image/webp,image/*" } })
  const type = auto.headers.get("content-type") ?? ""
  ok("automatic modern format", /avif|webp/.test(type), type)
  ok("served from a CDN with caching", /max-age|immutable/.test(auto.headers.get("cache-control") ?? ""), auto.headers.get("cache-control") ?? "")

  const jpg = Buffer.from(await (await fetch(cloudinaryUrl(j.secure_url, { w: 400, f: "jpg" }))).arrayBuffer())
  writeFileSync("/tmp/g4-cloudinary-check.jpg", jpg)
  // read JPEG dimensions from the SOF marker
  let w = 0
  let h = 0
  for (let i = 2; i < jpg.length - 9; ) {
    if (jpg[i] !== 0xff) { i++; continue }
    const m = jpg[i + 1]
    if (m >= 0xc0 && m <= 0xc3) { h = jpg.readUInt16BE(i + 5); w = jpg.readUInt16BE(i + 7); break }
    i += 2 + jpg.readUInt16BE(i + 2)
  }
  ok("cropped to 4:5 at the requested width", w === 400 && h === 500, `${w}x${h}`)
  const email = await fetch(cloudinaryUrl(j.secure_url, { w: 512, f: "jpg" }))
  ok("email-safe JPEG variant", (email.headers.get("content-type") ?? "").includes("jpeg"))
} finally {
  const ts = Math.floor(Date.now() / 1000)
  const sig = createHash("sha1").update(`public_id=${j.public_id}&timestamp=${ts}${process.env.CLOUDINARY_API_SECRET}`).digest("hex")
  const del = new FormData()
  del.set("public_id", j.public_id!)
  del.set("api_key", t.apiKey)
  del.set("timestamp", String(ts))
  del.set("signature", sig)
  const r = await fetch(`https://api.cloudinary.com/v1_1/${t.cloudName}/image/destroy`, { method: "POST", body: del })
  ok("test image deleted", r.ok, JSON.stringify(await r.json()))
}
