"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { DownloadIcon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { applyProductImport, previewProductImport } from "@/app/admin/(panel)/import-actions"
import type { ImportPlan } from "@/lib/product-import"

const lbl = "flex flex-col gap-1.5 text-sm font-medium"
const STATUS = ["all", "pending", "processing", "shipped", "delivered", "cancelled", "refunded"]

function Download({ href, children, variant = "outline" }: { href: string; children: React.ReactNode; variant?: "outline" | "default" }) {
  return (
    <Button render={<a href={href} download />} variant={variant}>
      <DownloadIcon /> {children}
    </Button>
  )
}

export function DataView({ live, canImport }: { live: boolean; canImport: boolean }) {
  const router = useRouter()
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [status, setStatus] = useState("all")
  const [demo, setDemo] = useState(false)
  const q = new URLSearchParams({ status, ...(from ? { from } : {}), ...(to ? { to } : {}), ...(demo ? { demo: "1" } : {}) }).toString()

  const file = useRef<HTMLInputElement>(null)
  const [csv, setCsv] = useState("")
  const [fileName, setFileName] = useState("")
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [error, setError] = useState("")
  const [done, setDone] = useState("")
  const [pending, start] = useTransition()

  const reset = () => { setCsv(""); setFileName(""); setPlan(null); setError(""); if (file.current) file.current.value = "" }

  const choose = async (f: File | undefined) => {
    setPlan(null); setError(""); setDone("")
    if (!f) return reset()
    if (f.size > 1_000_000) { setError("That file is over 1 MB. Import up to about 500 products at a time."); return }
    const text = await f.text()
    setCsv(text); setFileName(f.name)
    start(async () => {
      const r = await previewProductImport(text)
      if (!r.ok) return setError(r.error)
      setPlan(r.plan)
    })
  }

  const apply = () =>
    start(async () => {
      setError("")
      const r = await applyProductImport(csv)
      if (!r.ok) return setError(r.error)
      const bits = [r.created && `${r.created} added`, r.updated && `${r.updated} updated`, r.unchanged && `${r.unchanged} unchanged`, r.categories && `${r.categories} new categor${r.categories === 1 ? "y" : "ies"}`].filter(Boolean)
      reset()
      setDone(`Import complete: ${bits.join(", ") || "nothing to change"}.`)
      router.refresh()
    })

  const blocked = !plan || !!plan.fatal || plan.errors.length > 0 || plan.counts.create + plan.counts.update === 0

  return (
    <div className="flex flex-col gap-5">
      <div className="rise">
        <h1 className="text-2xl font-semibold tracking-tight">Import &amp; export</h1>
        <p className="mt-1 text-sm text-muted-foreground">Download your data as spreadsheets (CSV), or update your products in bulk from one.</p>
      </div>
      {!live && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Demo mode: connect Supabase to export or import.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
            <CardDescription>Every product with its prices, sizes, stock and photos. Edit it in a spreadsheet and import it back to change many at once.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Download href="/admin/export/products">Export products</Download>
            <Download href="/admin/export/products-template">Blank template</Download>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Customers</CardTitle>
            <CardDescription>Name, email, location, orders, total spent and tier.</CardDescription>
          </CardHeader>
          <CardContent>
            <Download href="/admin/export/customers">Export customers</Download>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>One row per item bought, with the order&apos;s totals, address and tracking. Handy for your accountant.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={lbl}>From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className={lbl}>To<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            <label className={lbl}>Status
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-lg border bg-background px-2.5 text-sm capitalize">
                {STATUS.map((s) => <option key={s} value={s}>{s === "all" ? "All statuses" : s}</option>)}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Include demo orders (not real customers)</label>
          <div><Download href={`/admin/export/orders?${q}`}>Export orders</Download></div>
        </CardContent>
      </Card>

      {canImport && (
        <Card>
          <CardHeader>
            <CardTitle>Import products</CardTitle>
            <CardDescription>
              Upload a CSV. Rows with an <b>id</b> (or <b>sku</b>) update that product, changing only the columns in your file. Rows without one add a new product.
              You&apos;ll see exactly what will happen before anything is saved.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={() => file.current?.click()} disabled={pending || !live}><UploadIcon /> Choose a CSV file</Button>
              <input ref={file} type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" onChange={(e) => choose(e.target.files?.[0])} />
              {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
            </div>
            {done && <p role="status" className="rounded-lg border border-positive/40 bg-positive/10 px-3 py-2 text-sm">{done}</p>}
            {error && <p role="alert" className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p>}
            {pending && !plan && <p className="text-sm text-muted-foreground">Checking the file…</p>}

            {plan?.fatal && <p role="alert" className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">{plan.fatal}</p>}
            {plan && !plan.fatal && (
              <div className="flex flex-col gap-3" data-testid="plan">
                <p className="text-sm">
                  <b>{plan.counts.create}</b> to add, <b>{plan.counts.update}</b> to update, <b>{plan.counts.unchanged}</b> unchanged
                  {plan.errors.length > 0 && <>, <b className="text-negative">{plan.errors.length} with problems</b></>}.
                </p>
                {plan.ignoredColumns.length > 0 && <p className="text-xs text-muted-foreground">Ignored columns: {plan.ignoredColumns.join(", ")}.</p>}
                {plan.newCategories.length > 0 && <p className="text-sm">New categories that will be created: {plan.newCategories.map((c) => c.name).join(", ")}.</p>}
                {plan.errors.length > 0 && (
                  <div className="rounded-lg border border-negative/40 p-3">
                    <p className="text-sm font-medium">Fix these in your file, then choose it again. Nothing is saved until the file is clean.</p>
                    <ul className="mt-2 flex max-h-60 flex-col gap-1 overflow-auto text-sm">
                      {plan.errors.slice(0, 100).map((e, i) => <li key={i}><span className="font-mono text-xs text-muted-foreground">Line {e.line}</span> {e.message}</li>)}
                    </ul>
                    {plan.errors.length > 100 && <p className="mt-2 text-xs text-muted-foreground">…and {plan.errors.length - 100} more.</p>}
                  </div>
                )}
                {plan.rows.some((r) => r.action !== "unchanged") && (
                  <div className="max-h-72 overflow-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted text-left text-xs"><tr><th className="px-3 py-2">Line</th><th className="px-3 py-2">Product</th><th className="px-3 py-2">What happens</th></tr></thead>
                      <tbody>
                        {plan.rows.filter((r) => r.action !== "unchanged").map((r) => (
                          <tr key={r.line} className="border-t">
                            <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{r.line}</td>
                            <td className="px-3 py-1.5">{r.name}</td>
                            <td className="px-3 py-1.5">{r.action === "create" ? "Add new product" : `Update ${r.changes.join(", ")}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={apply} disabled={blocked || pending}>{pending ? "Importing…" : `Import ${plan.counts.create + plan.counts.update} product${plan.counts.create + plan.counts.update === 1 ? "" : "s"}`}</Button>
                  <Button variant="outline" onClick={reset} disabled={pending}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
