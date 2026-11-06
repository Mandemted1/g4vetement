"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAdmin } from "@/components/admin-data"
import { dateLabel } from "@/lib/format"

export function SubscribersView() {
  const { subscribers, mode } = useAdmin()
  return (
    <div className="flex flex-col gap-5">
      <div className="rise">
        <h1 className="text-2xl font-semibold tracking-tight">Subscribers</h1>
        <p className="mt-1 text-sm text-muted-foreground">Emails collected by the storefront welcome popup and newsletter. {subscribers.length} total.</p>
      </div>
      <Card className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((s) => (
                <TableRow key={s.email}>
                  <TableCell className="font-medium">{s.email}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{dateLabel(s.createdAt)}</TableCell>
                </TableRow>
              ))}
              {subscribers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="py-12 text-center text-muted-foreground">
                    {mode === "demo" ? "Demo mode: connect Supabase to collect subscribers." : "No subscribers yet. They appear here as people sign up."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
