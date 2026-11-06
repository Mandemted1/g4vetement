import "server-only"
import { createHash } from "node:crypto"

export const cloudinaryConfigured = () => Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)

/** Cloudinary signs the sorted "key=value&key=value" string plus the API secret with SHA-1. */
export function sign(params: Record<string, string | number>): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&")
  return createHash("sha1").update(toSign + process.env.CLOUDINARY_API_SECRET).digest("hex")
}

/** Everything the browser needs to upload one image straight to Cloudinary. The API secret never leaves the server. */
export function uploadTicket(folder: string) {
  const timestamp = Math.floor(Date.now() / 1000)
  const safe = folder.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "misc"
  const params = { folder: `g4/${safe}`, timestamp }
  return { cloudName: process.env.CLOUDINARY_CLOUD_NAME!, apiKey: process.env.CLOUDINARY_API_KEY!, signature: sign(params), ...params }
}
