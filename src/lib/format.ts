const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })
export const money = (n: number) => usd2.format(n)
export const moneyShort = (n: number) => usd0.format(n)
export const compact = (n: number) =>
  Math.abs(n) >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(n)}`
export const int = (n: number) => new Intl.NumberFormat("en-US").format(n)
export const pct = (n: number, digits = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`

// Always format in UTC so server and client render identical strings.
const opts = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...o })
const fDay = opts({ month: "short", day: "numeric" })
const fDayYear = opts({ month: "short", day: "numeric", year: "numeric" })
const fTime = opts({ hour: "numeric", minute: "2-digit" })
const fLong = opts({ weekday: "long", month: "long", day: "numeric" })
const fMonth = opts({ month: "short" })

export const dayLabel = (t: number | string) => fDay.format(new Date(t))
export const dateLabel = (t: number | string) => fDayYear.format(new Date(t))
export const timeLabel = (t: number | string) => fTime.format(new Date(t))
export const longDate = (t: number | string) => fLong.format(new Date(t))
export const monthLabel = (t: number | string) => fMonth.format(new Date(t))

export function relativeTime(iso: string, now: number) {
  const diff = now - new Date(iso).getTime()
  const h = diff / 3_600_000
  if (h < 1) return `${Math.max(1, Math.round(diff / 60000))}m ago`
  if (h < 24) return `${Math.round(h)}h ago`
  const d = Math.round(h / 24)
  if (d < 14) return `${d}d ago`
  return dayLabel(iso)
}
export const initials = (name: string) =>
  name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()
