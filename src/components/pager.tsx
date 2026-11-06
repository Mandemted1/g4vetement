"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Pager({ page, pages, total, size, onPage }: { page: number; pages: number; total: number; size: number; onPage: (p: number) => void }) {
  const from = total === 0 ? 0 : page * size + 1
  const to = Math.min(total, (page + 1) * size)
  return (
    <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
      <span className="tabular">{from}–{to} of {total}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeftIcon /></Button>
        <span className="tabular">Page {page + 1} / {Math.max(1, pages)}</span>
        <Button variant="outline" size="icon-sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRightIcon /></Button>
      </div>
    </div>
  )
}
