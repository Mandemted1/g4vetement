"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, CopyIcon, PlusIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { addTeamMember, removeTeamMember, resetTeamPassword, setTeamRole } from "@/app/admin/(panel)/team-actions"
import { CAP_LABEL, ROLES, ROLE_INFO, capsOf, type Role } from "@/lib/permissions"
import type { TeamMember } from "@/lib/team"
import { useMounted } from "@/lib/use-mounted"

const lbl = "flex flex-col gap-1.5 text-sm font-medium"
const hint = "text-xs font-normal text-muted-foreground"

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button type="button" size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); window.setTimeout(() => setDone(false), 1800) } catch {} }}>
      {done ? <><CheckIcon /> Copied</> : <><CopyIcon /> {label}</>}
    </Button>
  )
}

export function TeamView({ team, you, demo }: { team: TeamMember[]; you: string; demo: boolean }) {
  const router = useRouter()
  const mounted = useMounted()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")
  const [shown, setShown] = useState<{ email: string; password: string } | null>(null)
  const [pending, start] = useTransition()

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError("")
      const r = await fn()
      if (!r.ok) return setError(r.error ?? "Something went wrong.")
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-5">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">Who can sign in to this admin, and what each person can do. Only owners see this page.</p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={demo}><PlusIcon /> Add team member</Button>
      </div>

      {demo && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Demo mode: connect Supabase to manage a team.</p>}
      {error && <p role="alert" className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p>}
      {shown && (
        <div role="status" className="rounded-lg border border-dashed p-4">
          <p className="text-sm font-medium">Temporary password for {shown.email}</p>
          <p className="mt-2 font-mono text-xl font-semibold tracking-wider">{shown.password}</p>
          <p className="mt-2 text-xs text-muted-foreground">Send it to them privately. It&apos;s shown only once. They can change it under My account after signing in.</p>
          <div className="mt-3 flex gap-2"><Copy text={shown.password} label="Copy password" /><Button size="sm" variant="ghost" onClick={() => setShown(null)}>Dismiss</Button></div>
        </div>
      )}

      <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <CardContent>
          <ul className="divide-y rounded-lg border">
            {team.map((m) => {
              const me = m.id === you
              return (
                <li key={m.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{m.email}</span>
                      {me && <Badge variant="secondary" className="border-0 bg-muted text-muted-foreground">You</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{mounted ? `Added ${new Date(m.addedAt).toLocaleDateString()}${m.lastSignIn ? ` · last signed in ${new Date(m.lastSignIn).toLocaleDateString()}` : " · hasn't signed in yet"}` : ""}</div>
                  </div>
                  <select
                    aria-label={`Role for ${m.email}`}
                    value={m.role}
                    disabled={me || pending}
                    onChange={(e) => run(() => setTeamRole(m.id, e.target.value as Role))}
                    className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm disabled:opacity-60"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
                  </select>
                  {!me && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => { if (window.confirm(`Set a new temporary password for ${m.email}? Their old password stops working.`)) run(async () => { const r = await resetTeamPassword(m.id); if (r.ok) setShown({ email: m.email, password: r.password }); return r }) }}>Reset password</Button>
                      <Button size="sm" variant="ghost" className="text-negative hover:text-negative" disabled={pending} onClick={() => { if (window.confirm(`Remove ${m.email} from the team? They'll no longer be able to open the admin.`)) run(() => removeTeamMember(m.id)) }}>Remove</Button>
                    </div>
                  )}
                </li>
              )
            })}
            {team.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No team members yet.</li>}
          </ul>
        </CardContent>
      </Card>

      <Card className="rise" style={{ "--i": 2 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle>What each role can do</CardTitle>
          <CardDescription>Everyone on the team can look at orders, products and customers. The lists below are what each role can also change.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="rounded-lg border p-4">
              <div className="font-medium">{ROLE_INFO[r].label}</div>
              <p className="mt-1 text-sm text-muted-foreground">{ROLE_INFO[r].summary}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {capsOf(r).map((c) => <li key={c} className="rounded-full bg-muted px-2.5 py-1">{CAP_LABEL[c]}</li>)}
                {capsOf(r).length === 0 && <li className="text-muted-foreground">View only</li>}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Sheet open={adding} onOpenChange={(v) => !v && setAdding(false)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">{adding && <AddForm onClose={() => setAdding(false)} onCreated={(email, password) => { if (password) setShown({ email, password }); router.refresh() }} />}</SheetContent>
      </Sheet>
    </div>
  )
}

function AddForm({ onClose, onCreated }: { onClose: () => void; onCreated: (email: string, password?: string) => void }) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("fulfilment")
  const [error, setError] = useState("")
  const [done, setDone] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = () =>
    start(async () => {
      setError("")
      const r = await addTeamMember({ email, role })
      if (!r.ok) return setError(r.error)
      onCreated(r.email, r.password)
      if (r.created) return onClose()
      setDone(`${r.email} already had an account, so it now has ${ROLE_INFO[role].label} access. Their existing password still works.`)
    })

  if (done) {
    return (
      <div className="flex flex-col gap-5 px-4 pb-8">
        <SheetHeader className="px-0"><SheetTitle>Added to the team</SheetTitle><SheetDescription>{done}</SheetDescription></SheetHeader>
        <Button onClick={onClose}>Done</Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-5 px-4 pb-8">
      <SheetHeader className="px-0">
        <SheetTitle>Add a team member</SheetTitle>
        <SheetDescription>We&apos;ll create their sign-in and show you a temporary password to pass on.</SheetDescription>
      </SheetHeader>
      <label className={lbl}>
        Email
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="off" />
        <span className={hint}>If this email already has an account on your store, it keeps its own password and gains this role.</span>
      </label>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-1 text-sm font-medium">Role</legend>
        {ROLES.map((r) => (
          <label key={r} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40">
            <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} className="mt-1 size-4" />
            <span><span className="block text-sm font-medium">{ROLE_INFO[r].label}</span><span className="block text-xs text-muted-foreground">{ROLE_INFO[r].summary}</span></span>
          </label>
        ))}
      </fieldset>
      {error && <p role="alert" className="rounded-md bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending || !email.trim()} className="flex-1">{pending ? "Adding…" : "Add to the team"}</Button>
        <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
      </div>
    </div>
  )
}
