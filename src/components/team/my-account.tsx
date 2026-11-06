"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { changeMyPassword } from "@/app/admin/(panel)/account/actions"
import { CAP_LABEL, ROLE_INFO, capsOf, type Role } from "@/lib/permissions"

export function MyAccount({ email, role }: { email: string; role: Role }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const caps = capsOf(role)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    start(async () => {
      const r = await changeMyPassword({ password, confirm })
      if (r.ok) {
        setPassword("")
        setConfirm("")
        setMsg({ ok: true, text: "Password changed." })
      } else setMsg({ ok: false, text: r.error })
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rise">
        <h1 className="text-2xl font-semibold tracking-tight">My account</h1>
        <p className="mt-1 text-sm text-muted-foreground">{email}</p>
      </div>
      <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle>Your role: {ROLE_INFO[role].label}</CardTitle>
          <CardDescription>{ROLE_INFO[role].summary}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {caps.map((c) => <span key={c} className="rounded-full bg-muted px-2.5 py-1">{CAP_LABEL[c]}</span>)}
            {caps.length === 0 && <span className="text-muted-foreground">View only</span>}
          </div>
        </CardContent>
      </Card>
      <Card className="rise" style={{ "--i": 2 } as React.CSSProperties}>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Use at least 10 characters. A passphrase of a few words works well.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="flex max-w-sm flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">New password<Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">Type it again<Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
            {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-positive" : "text-sm text-negative"}>{msg.text}</p>}
            <Button type="submit" disabled={pending || !password} className="w-fit">{pending ? "Saving…" : "Change password"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
