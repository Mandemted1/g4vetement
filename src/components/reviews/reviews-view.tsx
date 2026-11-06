"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { EyeIcon, EyeOffIcon, StarIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { deleteReview, setReviewStatus } from "@/app/admin/(panel)/reviews-actions"
import type { AdminReview, ReviewsData } from "@/lib/admin-reviews"
import { useMounted } from "@/lib/use-mounted"
import { cn } from "@/lib/utils"

const Stars = ({ n }: { n: number }) => (
  <span role="img" aria-label={`${n} out of 5`} className="inline-flex text-amber-500">
    {[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} className={cn("size-3.5", i <= n ? "fill-current" : "opacity-25")} />)}
  </span>
)

export function ReviewsView({ data }: { data: ReviewsData }) {
  const router = useRouter()
  const mounted = useMounted()
  const [tab, setTab] = useState<"all" | "published" | "hidden" | "low">("all")
  const [q, setQ] = useState("")
  const [error, setError] = useState("")
  const [pending, start] = useTransition()

  const counts = useMemo(
    () => ({ all: data.reviews.length, published: data.reviews.filter((r) => r.status === "published").length, hidden: data.reviews.filter((r) => r.status === "hidden").length, low: data.reviews.filter((r) => r.rating <= 2).length }),
    [data.reviews],
  )
  const average = data.reviews.length ? data.reviews.reduce((s, r) => s + r.rating, 0) / data.reviews.length : 0
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.reviews.filter((r) => (tab === "all" || (tab === "low" ? r.rating <= 2 : r.status === tab)) && (!t || `${r.productName} ${r.author} ${r.title} ${r.body}`.toLowerCase().includes(t)))
  }, [data.reviews, tab, q])

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("")
      const r = await fn()
      if (!r.ok) return setError(r.error ?? "Something went wrong.")
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-5">
      <div className="rise">
        <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customers can review a product once their order for it has shipped. Reviews go live straight away; hide any you don&apos;t want on the store.
          {data.reviews.length > 0 && <> Average so far: <b className="font-medium text-foreground">{average.toFixed(1)}</b> from {data.reviews.length}.</>}
        </p>
      </div>

      {data.demo && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Demo mode: connect Supabase to collect reviews.</p>}
      {data.missing && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Reviews aren&apos;t installed yet. Run <code>npm run migrate</code> first.</p>}
      {error && <p className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p>}

      <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="all">All <span className="ml-1 text-xs text-muted-foreground tabular">{counts.all}</span></TabsTrigger>
                <TabsTrigger value="published">Published <span className="ml-1 text-xs text-muted-foreground tabular">{counts.published}</span></TabsTrigger>
                <TabsTrigger value="hidden">Hidden <span className="ml-1 text-xs text-muted-foreground tabular">{counts.hidden}</span></TabsTrigger>
                <TabsTrigger value="low">1–2 stars <span className="ml-1 text-xs text-muted-foreground tabular">{counts.low}</span></TabsTrigger>
              </TabsList>
            </Tabs>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, name or text" className="w-full lg:w-64" aria-label="Search reviews" />
          </div>

          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{data.reviews.length === 0 ? "No reviews yet. They'll appear here when customers who've received an order write one." : "No reviews match."}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {rows.map((r) => <Row key={r.id} r={r} pending={pending} mounted={mounted} onToggle={() => run(() => setReviewStatus(r.id, r.status === "hidden" ? "published" : "hidden"))} onDelete={() => { if (window.confirm("Delete this review for good?")) run(() => deleteReview(r.id)) }} />)}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ r, pending, mounted, onToggle, onDelete }: { r: AdminReview; pending: boolean; mounted: boolean; onToggle: () => void; onDelete: () => void }) {
  return (
    <li className={cn("flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:gap-4", r.status === "hidden" && "bg-muted/40")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Stars n={r.rating} />
          <span className="text-sm font-medium">{r.productName}</span>
          {r.status === "hidden" && <Badge variant="secondary" className="border-0 bg-muted text-muted-foreground">Hidden</Badge>}
        </div>
        {r.title && <p className="mt-1.5 text-sm font-medium">{r.title}</p>}
        {r.body && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{r.body}</p>}
        <p className="mt-2 text-xs text-muted-foreground">{r.author}{mounted ? ` · ${new Date(r.createdAt).toLocaleDateString()}` : ""}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={onToggle}>
          {r.status === "hidden" ? <><EyeIcon /> Show</> : <><EyeOffIcon /> Hide</>}
        </Button>
        <Button size="icon" variant="ghost" aria-label="Delete review" disabled={pending} onClick={onDelete}><Trash2Icon /></Button>
      </div>
    </li>
  )
}
