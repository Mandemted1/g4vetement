import { Dashboard } from "@/components/dashboard/dashboard"

export default async function Page({ searchParams }: { searchParams: Promise<{ restricted?: string }> }) {
  const { restricted } = await searchParams
  return (
    <>
      {restricted && (
        <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Your role doesn&apos;t include that page. If you need access, ask an owner.
        </p>
      )}
      <Dashboard />
    </>
  )
}
