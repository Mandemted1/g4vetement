import { getUploadTicket, uploadProductPhoto } from "@/app/admin/actions"

const TYPES = /^image\/(jpeg|png|webp|avif)$/
const MAX = 10 * 1024 * 1024

/**
 * Uploads one image from the admin. Goes straight to Cloudinary when it's configured
 * (fast, no Vercel size limit), otherwise falls back to Supabase Storage.
 */
export async function uploadImage(file: File, folder: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!TYPES.test(file.type)) return { ok: false, error: "Use a JPG, PNG, WebP or AVIF image." }
  if (file.size > MAX) return { ok: false, error: "That image is over 10 MB. Try a smaller one." }

  const t = await getUploadTicket(folder)
  if (!t.ok) return t
  if (t.provider === "supabase") {
    const fd = new FormData()
    fd.set("file", file)
    fd.set("productId", folder)
    return uploadProductPhoto(fd)
  }

  const fd = new FormData()
  fd.set("file", file)
  fd.set("api_key", t.apiKey)
  fd.set("timestamp", String(t.timestamp))
  fd.set("folder", t.folder)
  fd.set("signature", t.signature)
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${t.cloudName}/image/upload`, { method: "POST", body: fd })
    const json = (await res.json()) as { secure_url?: string; error?: { message: string } }
    if (!res.ok || !json.secure_url) return { ok: false, error: json.error?.message ?? "Upload failed. Try again." }
    return { ok: true, url: json.secure_url }
  } catch {
    return { ok: false, error: "Couldn't reach the image service. Check your connection and try again." }
  }
}
