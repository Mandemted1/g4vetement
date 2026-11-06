"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangleIcon, ArrowDownIcon, ArrowUpIcon, CheckIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createCategory, deleteCategory, moveCategory, updateCategory } from "@/app/admin/(panel)/category-actions"
import { useAdmin } from "@/components/admin-data"
import { useStaff } from "@/components/staff-context"
import type { Category } from "@/lib/data"
import { CATEGORY_DEPARTMENT_OPTIONS, categoryDepartmentLabel, type CategoryDepartment } from "@/lib/departments"
import { cn } from "@/lib/utils"

export function CategoriesView() {
  const { categories, products, mode } = useAdmin()
  const canEdit = useStaff().can("products.manage")
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState("")
  const [name, setName] = useState("")
  const [dept, setDept] = useState<CategoryDepartment>("both")
  const [show, setShow] = useState<"all" | CategoryDepartment>("all")
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ name: string; description: string; department: CategoryDepartment }>({ name: "", description: "", department: "both" })
  const [deleting, setDeleting] = useState<string | null>(null)
  const [moveTo, setMoveTo] = useState("")

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    products.forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1))
    return m
  }, [products])
  // products using a category that isn't in the list (e.g. typed before categories were manageable)
  const orphans = useMemo(() => [...counts.keys()].filter((c) => !categories.some((x) => x.name === c)), [counts, categories])

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError("")
      const r = await fn()
      if (!r.ok) return setError(r.error ?? "Something went wrong.")
      after?.()
      router.refresh()
    })

  const startEdit = (c: Category) => {
    setEditing(c.id)
    setDraft({ name: c.name, description: c.description, department: c.department })
    setDeleting(null)
  }
  const startDelete = (c: Category) => {
    setDeleting(c.id)
    setEditing(null)
    setMoveTo(categories.find((x) => x.id !== c.id)?.name ?? "")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rise">
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">The groups shoppers browse by, under Men and Women. Changes show on the store straight away.</p>
      </div>

      {mode === "demo" && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Demo mode: connect Supabase to add or change categories.</p>}
      {error && <p className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p>}

      {orphans.length > 0 && (
        <div className="rise flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm" style={{ "--i": 1 } as React.CSSProperties}>
          <AlertTriangleIcon className="size-4 shrink-0 text-warning" />
          <span>
            {orphans.reduce((s, o) => s + (counts.get(o) ?? 0), 0)} products use {orphans.length === 1 ? "a category" : "categories"} that {orphans.length === 1 ? "isn't" : "aren't"} in this list: <b className="font-medium">{orphans.join(", ")}</b>.
          </span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(async () => { for (const o of orphans) { const r = await createCategory(o); if (!r.ok) return r } return { ok: true } })}>
            Add {orphans.length === 1 ? "it" : "them"}
          </Button>
        </div>
      )}

      <Card className="rise" style={{ "--i": 2 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle>Your categories</CardTitle>
          <CardDescription>Use the arrows to set the order shown in the store menu and filters. A hidden category no longer shows as a filter or in the menu; its products stay visible under &ldquo;All&rdquo; (hide a product itself from its page).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!canEdit && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">View only. Your role can look at categories but not change them.</p>}
          <fieldset disabled={!canEdit} className="contents">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) run(() => createCategory(name), () => setName(""))
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="New category, e.g. Dresses" className="max-w-xs" aria-label="New category name" />
            <select value={dept} onChange={(e) => setDept(e.target.value as CategoryDepartment)} aria-label="Department" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
              {CATEGORY_DEPARTMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Button type="submit" disabled={pending || !name.trim()}><PlusIcon /> Add</Button>
          </form>

          <div className="flex flex-wrap items-center gap-1.5 text-sm" role="group" aria-label="Show categories for">
            <span className="mr-1 text-muted-foreground">Show:</span>
            {([["all", "All"], ["men", "Men"], ["women", "Women"], ["both", "Shared"]] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={show === v} onClick={() => setShow(v)} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", show === v ? "bg-foreground text-background" : "hover:bg-muted")}>{label}</button>
            ))}
            {show !== "all" && <span className="ml-1 text-xs text-muted-foreground">Clear the filter to reorder.</span>}
          </div>

          <ul className="divide-y rounded-lg border">
            {categories.map((c, i) => {
              if (show !== "all" && c.department !== show) return null
              const n = counts.get(c.name) ?? 0
              const isEditing = editing === c.id
              const isDeleting = deleting === c.id
              return (
                <li key={c.id} className={cn("px-3 py-3", !c.active && "bg-muted/40")}>
                  {isEditing ? (
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        run(() => updateCategory(c.id, { name: draft.name, description: draft.description, active: c.active, department: draft.department }), () => setEditing(null))
                      }}
                    >
                      <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={40} aria-label="Category name" className="w-48" />
                      <select value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value as CategoryDepartment })} aria-label="Department" className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                        {CATEGORY_DEPARTMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={200} placeholder="Short description (optional)" aria-label="Description" className="min-w-48 flex-1" />
                      <Button type="submit" size="sm" disabled={pending}><CheckIcon /> Save</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </form>
                  ) : isDeleting ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {n > 0 ? (
                        <>
                          <span>Move its {n} {n === 1 ? "product" : "products"} to</span>
                          <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                            {categories.filter((x) => x.id !== c.id).map((x) => <option key={x.id}>{x.name}</option>)}
                          </select>
                          <span>and delete &ldquo;{c.name}&rdquo;?</span>
                        </>
                      ) : (
                        <span>Delete &ldquo;{c.name}&rdquo;?</span>
                      )}
                      <Button size="sm" variant="destructive" disabled={pending || (n > 0 && !moveTo)} onClick={() => run(() => deleteCategory(c.id, n > 0 ? moveTo : undefined), () => setDeleting(null))}>Delete</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <button type="button" aria-label="Move up" disabled={pending || i === 0 || show !== "all"} onClick={() => run(() => moveCategory(c.id, "up"))} className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-25"><ArrowUpIcon className="size-3.5" /></button>
                        <button type="button" aria-label="Move down" disabled={pending || i === categories.length - 1 || show !== "all"} onClick={() => run(() => moveCategory(c.id, "down"))} className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-25"><ArrowDownIcon className="size-3.5" /></button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{c.name}</span>
                          <Badge variant="secondary" className="border-0 bg-muted text-muted-foreground">{categoryDepartmentLabel(c.department)}</Badge>
                          {!c.active && <Badge variant="secondary" className="border-0 bg-muted text-muted-foreground">Hidden</Badge>}
                        </div>
                        {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
                      </div>
                      <span className="hidden text-sm tabular text-muted-foreground sm:block">{n} {n === 1 ? "product" : "products"}</span>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={c.active} disabled={pending} onChange={(e) => run(() => updateCategory(c.id, { name: c.name, description: c.description, active: e.target.checked, department: c.department }))} className="size-4" />
                        <span className="hidden sm:inline">Visible</span>
                      </label>
                      <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => startEdit(c)}><PencilIcon /></Button>
                      <Button size="icon" variant="ghost" aria-label={`Delete ${c.name}`} disabled={categories.length < 2 && n > 0} onClick={() => startDelete(c)}><Trash2Icon /></Button>
                    </div>
                  )}
                </li>
              )
            })}
            {categories.length === 0 && <li className="px-3 py-10 text-center text-sm text-muted-foreground"><XIcon className="mx-auto mb-2 size-5" />No categories yet. Add your first one above.</li>}
          </ul>
          </fieldset>
        </CardContent>
      </Card>
    </div>
  )
}
