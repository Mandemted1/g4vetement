/** Five stars, filled up to `value` (rounded). Read out as "4.5 out of 5" for screen readers. */
export function Stars({ value, className = "" }: { value: number; className?: string }) {
  const full = Math.round(value)
  return (
    <span role="img" aria-label={`${value} out of 5 stars`} className={`inline-flex tracking-[0.1em] ${className}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden className={i <= full ? "" : "opacity-20"}>★</span>
      ))}
    </span>
  )
}
