"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, CopyIcon, PlusIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { adjustGiftCard, createGiftCard, setGiftCardActive } from "@/app/admin/(panel)/gift-card-actions"
import type { GiftCardsData } from "@/lib/gift-cards"
import { KIND_LABEL, giftStatus, type GiftCard, type GiftEntry, type GiftStatus } from "@/lib/gift-card-types"
import { money } from "@/lib/format"
import { useMounted } from "@/lib/use-mounted"
import { cn } from "@/lib/utils"

const STATUS: Record<GiftStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-positive/15 text-[oklch(0.42_0.12_155)] dark:text-positive" },
  used_up: { label: "Used up", cls: "bg-muted text-muted-foreground" },
  expired: { label: "Expired", cls: "bg-warning/15 text-[oklch(0.5_0.12_70)] dark:text-warning" },
  disabled: { label: "Off", cls: "bg-muted text-muted-foreground" },
}
const Pill = ({ s }: { s: GiftStatus }) => <Badge variant="secondary" className={cn("border-0", STATUS[s].cls)}>{STATUS[s].label}</Badge>
const lbl = "flex flex-col gap-1.5 text-sm font-medium"
const hint = "text-xs font-normal text-muted-foreground"

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async (e) => {
        e.stopPropagation()
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          window.setTimeout(() => setDone(false), 1800)
        } catch {}
      }}
    >
      {done ? <><CheckIcon /> Copied</> : <><CopyIcon /> {label}</>}
    </Button>
  )
}

export function GiftCardsView({ data }: { data: GiftCardsData }) {
  const mounted = useMounted()
  const [tab, setTab] = useState<"all" | GiftStatus>("all")
  const [q, setQ] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const withStatus = useMemo(() => data.cards.map((c) => ({ c, s: giftStatus(c) })), [data.cards])
  const outstanding = withStatus.filter((x) => x.s === "active").reduce((n, x) => n + x.c.balance, 0)
  const activeCount = withStatus.filter((x) => x.s === "active").length
  const rows = withStatus.filter((x) => (tab === "all" || x.s === tab) && (!q.trim() || `${x.c.code} ${x.c.note} ${x.c.recipient}`.toLowerCase().includes(q.trim().toLowerCase())))
  const open = data.cards.find((c) => c.id === openId) ?? null

  return (
    <div className="flex flex-col gap-5">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gift cards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a code worth some dollars and give it to someone. They enter it at checkout and it pays part or all of their order.
            {activeCount > 0 && <> You currently owe <b className="font-medium text-foreground tabular">{money(outstanding)}</b> across {activeCount} active {activeCount === 1 ? "card" : "cards"}.</>}
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={data.demo || data.missing}><PlusIcon /> New gift card</Button>
      </div>

      {data.demo && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Demo mode: connect Supabase to create gift cards.</p>}
      {data.missing && <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">Gift cards aren&apos;t installed yet. Run <code>npm run migrate</code> first.</p>}

      <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="used_up">Used up</TabsTrigger>
                <TabsTrigger value="expired">Expired</TabsTrigger>
                <TabsTrigger value="disabled">Off</TabsTrigger>
              </TabsList>
            </Tabs>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, note or email" aria-label="Search gift cards" className="w-full lg:w-64" />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Note</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ c, s }) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                  <TableCell className="font-mono text-sm font-medium">{c.code}</TableCell>
                  <TableCell className="text-right tabular">{money(c.balance)}<span className="text-muted-foreground"> / {money(c.initial)}</span></TableCell>
                  <TableCell><Pill s={s} /></TableCell>
                  <TableCell className="hidden max-w-56 truncate text-muted-foreground md:table-cell">{c.note || c.recipient || "–"}</TableCell>
                  <TableCell className="hidden text-right text-muted-foreground sm:table-cell">{mounted ? new Date(c.createdAt).toLocaleDateString() : ""}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-14 text-center text-muted-foreground">{data.cards.length === 0 ? "No gift cards yet. Create one to get started." : "No gift cards match."}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={creating} onOpenChange={(v) => !v && setCreating(false)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">{creating && <NewCard onClose={() => setCreating(false)} />}</SheetContent>
      </Sheet>
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">{open && <CardDetail key={open.id} card={open} entries={data.ledger[open.id] ?? []} mounted={mounted} />}</SheetContent>
      </Sheet>
    </div>
  )
}

function NewCard({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [amount, setAmount] = useState("50")
  const [note, setNote] = useState("")
  const [recipient, setRecipient] = useState("")
  const [expires, setExpires] = useState("")
  const [custom, setCustom] = useState("")
  const [showCustom, setShowCustom] = useState(false)
  const [error, setError] = useState("")
  const [created, setCreated] = useState<{ code: string; amount: number } | null>(null)
  const [pending, start] = useTransition()

  const save = () =>
    start(async () => {
      setError("")
      const n = Number(amount)
      const r = await createGiftCard({ amount: n, note, recipient, expires, code: custom })
      if (!r.ok) return setError(r.error)
      setCreated({ code: r.code, amount: n })
      router.refresh()
    })

  if (created) {
    return (
      <div className="flex flex-col gap-5 px-4 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle>Gift card created</SheetTitle>
          <SheetDescription>Give this code to the customer. It&apos;s worth {money(created.amount)}.</SheetDescription>
        </SheetHeader>
        <div className="rounded-lg border border-dashed p-5 text-center">
          <div className="font-mono text-2xl font-semibold tracking-wider" aria-label="Gift card code">{created.code}</div>
          <div className="mt-4 flex justify-center"><CopyButton text={created.code} label="Copy code" /></div>
        </div>
        <p className={hint}>You can find it again any time in the Gift cards list. Nothing is emailed automatically.</p>
        <div className="flex gap-2">
          <Button onClick={() => { setCreated(null); setNote(""); setRecipient(""); setCustom(""); setShowCustom(false) }} variant="outline" className="flex-1">Create another</Button>
          <Button onClick={onClose} className="flex-1">Done</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-8">
      <SheetHeader className="px-0">
        <SheetTitle>New gift card</SheetTitle>
        <SheetDescription>We&apos;ll generate a secret code for it.</SheetDescription>
      </SheetHeader>
      <div className={lbl}>
        Amount ($)
        <div className="flex flex-wrap gap-2">
          {[25, 50, 100, 200].map((a) => (
            <button key={a} type="button" aria-pressed={amount === String(a)} onClick={() => setAmount(String(a))} className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors", amount === String(a) ? "bg-foreground text-background" : "hover:bg-muted")}>${a}</button>
          ))}
        </div>
        <Input type="number" inputMode="numeric" min={1} max={10000} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
      </div>
      <label className={lbl}>
        Note <span className={hint}>(for you: who it&apos;s for, or why you made it)</span>
        <Input value={note} maxLength={200} placeholder="e.g. Giveaway winner, @username" onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className={lbl}>
        Recipient email <span className={hint}>(optional, kept for your records; nothing is emailed)</span>
        <Input type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
      </label>
      <label className={lbl}>
        Expires <span className={hint}>(optional)</span>
        <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
      </label>
      {showCustom ? (
        <label className={lbl}>
          Your own code
          <Input value={custom} maxLength={32} placeholder="e.g. THANKYOU-2026" onChange={(e) => setCustom(e.target.value.toUpperCase())} className="font-mono" />
          <span className={hint}>8 to 32 letters, numbers or dashes. Easy-to-guess codes can be guessed by others, so prefer a generated one.</span>
        </label>
      ) : (
        <button type="button" onClick={() => setShowCustom(true)} className="w-fit text-xs text-muted-foreground underline-offset-2 hover:underline">Use my own code instead</button>
      )}
      {error && <p className="rounded-md bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending} className="flex-1">{pending ? "Creating…" : "Create gift card"}</Button>
        <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
      </div>
    </div>
  )
}

function CardDetail({ card, entries, mounted }: { card: GiftCard; entries: GiftEntry[]; mounted: boolean }) {
  const router = useRouter()
  const [mode, setMode] = useState<"add" | "remove">("add")
  const [amt, setAmt] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const s = giftStatus(card)

  const adjust = () =>
    start(async () => {
      setError("")
      const n = Number(amt)
      if (!Number.isInteger(n) || n < 1) return setError("Enter a whole number of dollars.")
      const r = await adjustGiftCard(card.id, mode === "add" ? n : -n, note)
      if (!r.ok) return setError(r.error)
      setAmt("")
      setNote("")
      router.refresh()
    })
  const toggle = () =>
    start(async () => {
      setError("")
      const r = await setGiftCardActive(card.id, !card.active)
      if (!r.ok) return setError(r.error)
      router.refresh()
    })

  return (
    <div className="flex flex-col gap-5 px-4 pb-8">
      <SheetHeader className="px-0">
        <SheetTitle className="font-mono">{card.code}</SheetTitle>
        <SheetDescription>{card.note || "Gift card"}</SheetDescription>
      </SheetHeader>
      <div className="flex items-center justify-between">
        <Pill s={s} />
        <span className="text-xl font-semibold tabular">{money(card.balance)} <span className="text-sm font-normal text-muted-foreground">of {money(card.initial)}</span></span>
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={card.code} label="Copy code" />
        <Button size="sm" variant="outline" disabled={pending} onClick={toggle}>{card.active ? "Switch off" : "Switch on"}</Button>
      </div>
      <dl className="flex flex-col gap-1.5 text-sm">
        {card.recipient && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Recipient</dt><dd className="truncate">{card.recipient}</dd></div>}
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Expires</dt><dd>{card.expiresAt ? (mounted ? new Date(card.expiresAt).toLocaleDateString() : "") : "Never"}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Created</dt><dd>{mounted ? new Date(card.createdAt).toLocaleDateString() : ""}</dd></div>
      </dl>

      <div className="flex flex-col gap-3 rounded-lg border p-3">
        <h3 className="text-sm font-medium">Change the balance</h3>
        <div className="flex gap-2">
          {(["add", "remove"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cn("flex-1 rounded-lg border px-3 py-1.5 text-sm transition-colors", mode === m ? "bg-foreground text-background" : "hover:bg-muted")}>{m === "add" ? "Add money" : "Take off"}</button>
          ))}
        </div>
        <div className="grid grid-cols-[6rem_1fr] gap-2">
          <Input type="number" inputMode="numeric" min={1} value={amt} placeholder="$" onChange={(e) => setAmt(e.target.value)} aria-label="Amount" />
          <Input value={note} maxLength={200} placeholder="Reason (optional)" onChange={(e) => setNote(e.target.value)} aria-label="Reason" />
        </div>
        <Button size="sm" onClick={adjust} disabled={pending || !amt}>{pending ? "Saving…" : mode === "add" ? "Add to balance" : "Take off balance"}</Button>
      </div>
      {error && <p className="rounded-md bg-negative/10 px-3 py-2 text-sm text-negative">{error}</p>}

      <div>
        <h3 className="mb-2 text-sm font-medium">History</h3>
        <ul className="divide-y rounded-lg border text-sm">
          {entries.map((e, i) => (
            <li key={i} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div>{KIND_LABEL[e.kind]}{e.orderId ? ` · #${e.orderId}` : ""}</div>
                <div className="truncate text-xs text-muted-foreground">{e.note || ""}{mounted ? `${e.note ? " · " : ""}${new Date(e.createdAt).toLocaleString()}` : ""}</div>
              </div>
              <span className={cn("shrink-0 tabular", e.delta < 0 ? "text-muted-foreground" : "text-[oklch(0.42_0.12_155)] dark:text-positive")}>{e.delta < 0 ? "−" : "+"}{money(Math.abs(e.delta))}</span>
            </li>
          ))}
          {entries.length === 0 && <li className="px-3 py-4 text-muted-foreground">No history.</li>}
        </ul>
      </div>
    </div>
  )
}
