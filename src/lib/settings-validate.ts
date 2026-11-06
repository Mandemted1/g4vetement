import { POLICY_META, type Policies, type StoreSettings } from "./settings-types"

type Cleaned<T> = { ok: true; value: T } | { ok: false; error: string }

/** Pasted "@handle", "instagram.com/handle/" or a full profile link all become just the handle. */
export const handle = (v: string) =>
  v
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?(instagram|tiktok)\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")

export function cleanStore(v: StoreSettings): Cleaned<StoreSettings> {
  const name = v.name.trim()
  if (!name || name.length > 40) return { ok: false, error: "Store name must be 1 to 40 characters." }
  const email = v.email.trim()
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "That contact email doesn't look right." }
  const phone = v.phone.trim()
  if (phone.length > 30) return { ok: false, error: "Phone number is too long." }
  const address = v.address.replace(/\r\n/g, "\n").trim()
  if (address.length > 300) return { ok: false, error: "Address is too long (300 characters max)." }
  const instagram = handle(v.instagram)
  const tiktok = handle(v.tiktok)
  if (!/^[A-Za-z0-9._]{0,40}$/.test(instagram) || !/^[A-Za-z0-9._]{0,40}$/.test(tiktok)) return { ok: false, error: "Social handles can only contain letters, numbers, dots and underscores." }
  return { ok: true, value: { name, email, phone, address, instagram, tiktok } }
}

export function cleanPolicies(v: Policies): Cleaned<Policies> {
  const out = {} as Policies
  for (const { slug, title } of POLICY_META) {
    const t = String(v[slug] ?? "").replace(/\r\n/g, "\n").trim()
    if (t.length > 12000) return { ok: false, error: `${title} is too long (12,000 characters max).` }
    out[slug] = t
  }
  return { ok: true, value: out }
}
