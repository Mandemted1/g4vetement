"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { deleteMyReview, submitReview } from "@/app/(store)/reviews/actions"
import { RATING_WORDS, type Rating, type Review, type ReviewAccess } from "@/lib/review-types"
import { cn } from "@/lib/utils"
import { Stars } from "./stars"

const input = "w-full border-b bg-transparent py-3 text-[15px] outline-none transition-colors placeholder:text-[var(--mute)] focus:border-[var(--ink)]"
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })

/** Ratings summary, the reviews, and (for customers who've received the product) the form to write one. */
export function ReviewsSection({ productId, rating, reviews, access }: { productId: string; rating: Rating | null; reviews: Review[]; access: ReviewAccess }) {
  return (
    <section id="reviews" className="px-5 pt-32 md:px-8 md:pt-40" aria-labelledby="reviews-heading">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <h2 id="reviews-heading" className="text-[clamp(2.4rem,7vw,6rem)] font-medium leading-[0.88] tracking-[-0.055em]">Reviews</h2>
        {rating && (
          <p className="flex items-baseline gap-3">
            <span className="text-4xl font-medium tracking-tight">{rating.average.toFixed(1)}</span>
            <Stars value={rating.average} className="text-lg" />
            <span className="label text-[var(--mute)]">{rating.total} {rating.total === 1 ? "review" : "reviews"}</span>
          </p>
        )}
      </div>

      <div className="grid gap-14 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-7">
          {reviews.length === 0 ? (
            <p className="text-[15px] leading-relaxed text-[var(--mute)]">No reviews yet. Be the first once your order arrives.</p>
          ) : (
            <ul className="divide-y border-y">
              {reviews.map((r) => (
                <li key={r.id} className="py-6">
                  <div className="flex items-center justify-between gap-4">
                    <Stars value={r.rating} />
                    <span className="label text-[var(--mute)]">{day(r.createdAt)}</span>
                  </div>
                  {r.title && <p className="mt-3 text-[15px] font-medium">{r.title}</p>}
                  {r.body && <p className="mt-2 max-w-[60ch] whitespace-pre-line text-[14px] leading-relaxed text-[#2a2a28]">{r.body}</p>}
                  <p className="label mt-3 text-[var(--mute)]">{r.author} · Verified purchase</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="md:col-span-4 md:col-start-9">
          {!access.signedIn ? (
            <>
              <p className="label text-[var(--mute)]">Bought this?</p>
              <p className="mt-3 text-[14px] leading-relaxed">Sign in to review products you&apos;ve received.</p>
              <Link href={`/account/login?next=${encodeURIComponent(`/product/${productId}#reviews`)}`} className="label mt-5 inline-block border border-[var(--ink)] px-6 py-3 transition-colors duration-500 hover:bg-[var(--ink)] hover:text-[var(--paper)]">Sign in</Link>
            </>
          ) : access.canReview ? (
            <ReviewForm productId={productId} mine={access.mine} />
          ) : (
            <>
              <p className="label text-[var(--mute)]">Write a review</p>
              <p className="mt-3 text-[14px] leading-relaxed">You can review this once you&apos;ve received it. Only real customers can leave reviews.</p>
            </>
          )}
        </aside>
      </div>
    </section>
  )
}

function ReviewForm({ productId, mine }: { productId: string; mine: ReviewAccess["mine"] }) {
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState(mine?.title ?? "")
  const [body, setBody] = useState(mine?.body ?? "")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const shown = hover || rating

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (!rating) return setMsg({ ok: false, text: "Choose a rating from 1 to 5 stars." })
    start(async () => {
      const r = await submitReview(productId, rating, title, body)
      setMsg(r.ok ? { ok: true, text: mine ? "Updated. Thanks!" : "Thanks for your review!" } : { ok: false, text: r.error })
    })
  }
  const remove = () => {
    if (!window.confirm("Delete your review?")) return
    start(async () => {
      const r = await deleteMyReview(productId)
      if (r.ok) {
        setRating(0)
        setTitle("")
        setBody("")
        setMsg({ ok: true, text: "Your review was deleted." })
      } else setMsg({ ok: false, text: r.error })
    })
  }

  return (
    <form onSubmit={submit}>
      <p className="label text-[var(--mute)]">{mine ? "Your review" : "Write a review"}</p>
      {mine?.status === "hidden" && <p className="label mt-3 leading-relaxed text-[#b3261e]">This review is currently hidden by the store.</p>}
      <div className="mt-4 flex items-center gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            data-cursor=""
            className={cn("-m-0.5 p-1 text-2xl leading-none transition-colors", n <= shown ? "text-[var(--ink)]" : "text-[var(--ink)]/20")}
          >
            ★
          </button>
        ))}
        <span className="label ml-3 text-[var(--mute)]" aria-live="polite">{RATING_WORDS[shown]}</span>
      </div>
      <div className="mt-4 space-y-1">
        <input className={input} placeholder="Title (optional)" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className={cn(input, "min-h-28 resize-y")} placeholder="How does it fit? How is the quality?" maxLength={1500} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={cn("label mt-4 leading-relaxed", msg.ok ? "" : "text-[#b3261e]")}>{msg.text}</p>}
      <div className="mt-5 flex items-center gap-5">
        <button type="submit" disabled={pending} className="label border border-[var(--ink)] px-6 py-3 transition-colors duration-500 hover:bg-[var(--ink)] hover:text-[var(--paper)] disabled:opacity-60">
          {pending ? "Saving…" : mine ? "Update review" : "Post review"}
        </button>
        {mine && <button type="button" onClick={remove} disabled={pending} className="label text-[var(--mute)]"><span className="u">Delete</span></button>}
      </div>
    </form>
  )
}
