/** Cloudinary delivery helpers (safe to use on the server and in the browser). */

export const isCloudinary = (src: string) => /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(src)

export interface CloudinaryOptions {
  /** target width in px */
  w?: number
  /** "auto" picks WebP/AVIF per browser; use "jpg" for email */
  f?: string
  q?: string
  /** crop to this aspect ratio, centred on the subject. false = keep the original shape */
  ar?: string | false
}

/**
 * Adds Cloudinary transformations to an uploaded image URL: modern format, smart quality, a consistent
 * 4:5 crop and the requested width. Non-Cloudinary URLs are returned unchanged.
 */
export function cloudinaryUrl(src: string, o: CloudinaryOptions = {}): string {
  if (!isCloudinary(src)) return src
  const t = [`f_${o.f ?? "auto"}`, `q_${o.q ?? "auto"}`]
  if (o.ar !== false) t.push("c_fill", `ar_${o.ar ?? "4:5"}`, "g_auto")
  else t.push("c_limit")
  if (o.w) t.push(`w_${Math.round(o.w)}`)
  return src.replace("/image/upload/", `/image/upload/${t.join(",")}/`)
}
