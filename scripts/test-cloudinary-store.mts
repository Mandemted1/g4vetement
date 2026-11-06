/**
 * Temporarily points product p05 at a Cloudinary image so you can check the storefront, then restores it.
 *   npm run test-cloudinary-store -- up     (uploads + switches p05)
 *   npm run test-cloudinary-store -- down   (restores p05 and deletes the test image)
 */
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@supabase/supabase-js"

const { uploadTicket } = await import("../src/lib/cloudinary")
const mode = process.argv[2]
const state = "/tmp/g4-cld-test.json"
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

if (mode === "up") {
  const t = uploadTicket("test")
  const fd = new FormData()
  fd.set("file", new Blob([readFileSync(join(process.cwd(), "public/products/p05.jpg"))], { type: "image/jpeg" }), "p05.jpg")
  for (const [k, v] of Object.entries({ api_key: t.apiKey, timestamp: String(t.timestamp), folder: t.folder, signature: t.signature })) fd.set(k, v)
  const j = (await (await fetch(`https://api.cloudinary.com/v1_1/${t.cloudName}/image/upload`, { method: "POST", body: fd })).json()) as { secure_url: string; public_id: string }
  const { data } = await db.from("products").select("images").eq("id", "p05").single()
  writeFileSync(state, JSON.stringify({ publicId: j.public_id, before: data?.images }))
  await db.from("products").update({ images: [j.secure_url] }).eq("id", "p05")
  console.log("p05 now uses", j.secure_url)
} else {
  const s = JSON.parse(readFileSync(state, "utf8")) as { publicId: string; before: string[] }
  await db.from("products").update({ images: s.before }).eq("id", "p05")
  const ts = Math.floor(Date.now() / 1000)
  const fd = new FormData()
  fd.set("public_id", s.publicId)
  fd.set("api_key", process.env.CLOUDINARY_API_KEY!)
  fd.set("timestamp", String(ts))
  fd.set("signature", createHash("sha1").update(`public_id=${s.publicId}&timestamp=${ts}${process.env.CLOUDINARY_API_SECRET}`).digest("hex"))
  const r = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/destroy`, { method: "POST", body: fd })
  console.log("p05 restored:", JSON.stringify(s.before), "| test image deleted:", r.ok)
}
